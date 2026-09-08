import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

type NotifyInput = {
  userIds: string[];
  actor?: Pick<AuthenticatedUser, "id" | "name" | "email"> | null;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  emailSubject?: string;
  emailBody?: string;
  emailUrl?: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async createForUsers(input: NotifyInput) {
    const recipientIds = this.uniqueIds(input.userIds).filter((userId) => userId !== input.actor?.id);
    if (!recipientIds.length) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: recipientIds }, deletedAt: null, status: "ACTIVE" },
      select: { id: true, name: true, email: true }
    });
    if (!users.length) return [];

    await this.prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        title: input.title,
        message: input.message,
        entityType: input.entityType,
        entityId: input.entityId
      })),
      skipDuplicates: true
    });

    this.sendEmailsInBackground(
      users.map((user) => user.email),
      input.emailSubject ?? input.title,
      input.emailBody ?? input.message,
      input.emailUrl
    );

    return users;
  }

  async notifyDocumentParticipants(
    documentId: string,
    title: string,
    message: string,
    actor?: Pick<AuthenticatedUser, "id" | "name" | "email"> | null
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        projectId: true,
        ownerId: true,
        permissions: { select: { userId: true } },
        project: { select: { members: { select: { userId: true } } } }
      }
    });
    if (!document) return [];

    return this.createForUsers({
      userIds: [
        document.ownerId,
        ...document.permissions.map((permission) => permission.userId),
        ...document.project.members.map((member) => member.userId)
      ].filter(Boolean) as string[],
      actor,
      title,
      message,
      entityType: "Document",
      entityId: documentId,
      emailUrl: this.entityUrl({ projectId: document.projectId, documentId }),
      emailBody: `${message}\n\nTài liệu: ${document.title}`
    });
  }

  async notifyMentionedUsers(content: string, actor: AuthenticatedUser, base: Omit<NotifyInput, "userIds" | "actor">) {
    const users = await this.findMentionedUsers(content);
    if (!users.length) return [];

    return this.createForUsers({
      ...base,
      userIds: users.map((user) => user.id),
      actor,
      title: base.title || "Bạn được nhắc đến",
      message: base.message || `${actor.name || actor.email} đã nhắc đến bạn.`
    });
  }

  async mentionedUsers(content: string) {
    return this.findMentionedUsers(content);
  }

  async markAllRead(user: AuthenticatedUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() }
    });
    return { ok: true, count: result.count };
  }

  entityUrl(params: { projectId?: string | null; documentId?: string | null; workItemId?: string | null }) {
    const base = this.config.get<string>("APP_PUBLIC_URL") || this.config.get<string>("FRONTEND_URL") || "";
    if (!base) return undefined;
    const url = new URL(base);
    if (params.projectId) url.searchParams.set("projectId", params.projectId);
    if (params.documentId) url.searchParams.set("documentId", params.documentId);
    if (params.workItemId) url.searchParams.set("workItemId", params.workItemId);
    return url.toString();
  }

  private sendEmailsInBackground(to: string[], subject: string, text: string, url?: string) {
    if (!this.isEnabled("MAIL_ENABLED")) return;
    const recipients = this.normalizeEmails(to);
    if (!recipients.length) return;

    const redirectTo = this.normalizeEmails(this.config.get<string>("MAIL_REDIRECT_TO")?.split(",") ?? []);
    const effectiveRecipients = redirectTo.length ? redirectTo : recipients;
    const redirectNote = redirectTo.length ? `\n\nNgười nhận gốc: ${recipients.join(", ")}` : "";
    const body = `${text}${url ? `\n\nMở chi tiết: ${url}` : ""}${redirectNote}`;

    void Promise.allSettled(
      effectiveRecipients.map((email) => this.sendEmail([email], subject, body))
    ).then((results) => {
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          const error = result.reason;
          this.logger.warn(
            `Email notification failed for ${effectiveRecipients[index]}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      });
    });
  }

  private async sendEmail(to: string[], subject: string, text: string) {
    const provider = (this.config.get<string>("MAIL_PROVIDER") ?? "").toLowerCase();
    if (provider === "resend") return this.sendResend(to, subject, text);
    if (provider === "sendgrid") return this.sendSendGrid(to, subject, text);
    if (provider === "webhook") return this.sendWebhook(to, subject, text);
    this.logger.warn("MAIL_ENABLED=true but MAIL_PROVIDER is not configured");
  }

  private async sendResend(to: string[], subject: string, text: string) {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    const from = this.config.get<string>("MAIL_FROM");
    if (!apiKey || !from) throw new Error("Missing RESEND_API_KEY or MAIL_FROM");
    await this.postJson("https://api.resend.com/emails", {
      from,
      to,
      subject,
      text
    }, { Authorization: `Bearer ${apiKey}` });
  }

  private async sendSendGrid(to: string[], subject: string, text: string) {
    const apiKey = this.config.get<string>("SENDGRID_API_KEY");
    const from = this.config.get<string>("MAIL_FROM");
    if (!apiKey || !from) throw new Error("Missing SENDGRID_API_KEY or MAIL_FROM");
    await this.postJson("https://api.sendgrid.com/v3/mail/send", {
      personalizations: [{ to: to.map((email) => ({ email })) }],
      from: { email: from },
      subject,
      content: [{ type: "text/plain", value: text }]
    }, { Authorization: `Bearer ${apiKey}` });
  }

  private async sendWebhook(to: string[], subject: string, text: string) {
    const url = this.config.get<string>("MAIL_WEBHOOK_URL");
    if (!url) throw new Error("Missing MAIL_WEBHOOK_URL");
    await this.postJson(url, { to, subject, text });
  }

  private async postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Mail provider returned ${response.status}${detail ? `: ${detail.slice(0, 500)}` : ""}`);
    }
  }

  private extractMentionEmails(content: string) {
    return Array.from(new Set(
      Array.from(content.matchAll(/@([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g))
        .map((match) => match[1].toLowerCase())
    ));
  }

  private async findMentionedUsers(content: string) {
    if (!content.includes("@")) return [];
    const emails = this.extractMentionEmails(content);
    const normalizedContent = this.normalizeMentionText(content);
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true, name: true, email: true }
    });
    const emailSet = new Set(emails);
    return users.filter((user) =>
      emailSet.has(user.email.toLowerCase()) ||
      Boolean(user.name?.trim() && normalizedContent.includes(`@${this.normalizeMentionText(user.name)}`))
    );
  }

  private uniqueIds(ids: string[]) {
    return Array.from(new Set(ids.map((id) => id?.trim()).filter((id): id is string => Boolean(id))));
  }

  private normalizeEmails(emails: string[]) {
    return Array.from(new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean)));
  }

  private isEnabled(key: string) {
    return (this.config.get<string>(key) ?? "").trim().replace(/^"|"$/g, "").toLowerCase() === "true";
  }

  private normalizeMentionText(value: string) {
    return value
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\u00A0/g, " ")
      .normalize("NFC")
      .toLocaleLowerCase("vi-VN")
      .replace(/\s+/g, " ")
      .trim();
  }
}
