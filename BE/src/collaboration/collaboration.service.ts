import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import sanitizeHtml = require("sanitize-html");
import { AuthenticatedUser } from "../auth/auth.types";
import { DocumentsService } from "../documents/documents.service";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRequirementTagDto } from "./dto/create-requirement-tag.dto";
import { CreateTemplateDocumentDto } from "./dto/create-template-document.dto";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { CreateTraceLinkDto } from "./dto/create-trace-link.dto";

type DiffLine = { type: "same" | "added" | "removed"; text: string };

@Injectable()
export class CollaborationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly documentsService: DocumentsService
  ) {}

  async workspaceDashboard(user: AuthenticatedUser) {
    const projectWhere = this.permissions.projectVisibilityWhere(user);
    const projects = await this.prisma.project.findMany({
      where: projectWhere,
      orderBy: { updatedAt: "desc" },
      include: {
        documents: {
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            currentVersion: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { comments: { where: { status: "OPEN", parentId: null } }, versions: true } }
          }
        },
        members: { select: { userId: true } },
        _count: { select: { importJobs: true, requirementTags: true, traceLinks: true } }
      }
    });
    const projectIds = projects.map((project) => project.id);
    const documentIds = projects.flatMap((project) => project.documents.map((document) => document.id));

    const [
      openComments,
      resolvedComments,
      myOpenComments,
      notifications,
      recentActivity,
      tags,
      traces,
      latestImportJob
    ] = await Promise.all([
      this.prisma.comment.count({ where: { documentId: { in: documentIds }, status: "OPEN", parentId: null } }),
      this.prisma.comment.count({ where: { documentId: { in: documentIds }, status: "RESOLVED", parentId: null } }),
      this.prisma.comment.count({
        where: {
          documentId: { in: documentIds },
          status: "OPEN",
          parentId: null,
          OR: [
            { createdByEmail: user.email },
            { createdBy: user.email },
            { createdBy: user.name }
          ]
        }
      }),
      this.prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 8
      }),
      this.prisma.auditLog.findMany({
        where: {
          OR: [
            { entityType: "Project", entityId: { in: projectIds } },
            { entityType: "Document", entityId: { in: documentIds } }
          ]
        },
        include: { actor: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 12
      }),
      this.prisma.requirementTag.count({ where: { projectId: { in: projectIds } } }),
      this.prisma.traceLink.count({ where: { projectId: { in: projectIds } } }),
      this.prisma.importJob.findFirst({
        where: { projectId: { in: projectIds }, status: "COMPLETED" },
        orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
        select: { id: true, sourceFileName: true, completedAt: true, createdAt: true }
      })
    ]);

    const documents = projects.flatMap((project) =>
      project.documents.map((document) => ({
        ...document,
        projectId: project.id,
        projectCode: project.code,
        projectName: project.name
      }))
    );
    const draftDocuments = documents.filter((document) => document.status !== "DEPLOYED").length;
    const deployedDocuments = documents.filter((document) => document.status === "DEPLOYED").length;
    const projectsWithOpenComments = projects.filter((project) => {
      const projectOpenComments = project.documents.reduce((total, document) => total + (document._count?.comments ?? 0), 0);
      return projectOpenComments > 0;
    }).length;
    const unreadNotifications = notifications.filter((notification) => !notification.readAt).length;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const updatedToday = documents.filter((document) => document.updatedAt >= startOfToday).length;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const documentsCreatedThisMonth = documents.filter((document) => document.createdAt >= startOfMonth).length;
    const documentsUpdatedThisMonth = documents.filter((document) => document.updatedAt >= startOfMonth).length;

    return {
      role: user.role,
      scopeLabel: this.dashboardScopeLabel(user),
      totals: {
        projects: projects.length,
        documents: documents.length,
        draftDocuments,
        deployedDocuments,
        openComments,
        openCommentThreads: openComments,
        resolvedComments,
        myOpenComments,
        unreadNotifications,
        tags,
        traces,
        updatedToday,
        documentsCreatedThisMonth,
        documentsUpdatedThisMonth,
        importJobs: projects.reduce((total, project) => total + project._count.importJobs, 0),
        projectsWithOpenComments,
        versions: documents.reduce((total, document) => total + (document._count?.versions ?? 0), 0)
      },
      projectBreakdown: projects.map((project) => ({
        id: project.id,
        code: project.code,
        name: project.name,
        client: project.client,
        documents: project.documents.length,
        openComments: project.documents.reduce((total, document) => total + (document._count?.comments ?? 0), 0),
        tags: project._count.requirementTags,
        traces: project._count.traceLinks,
        members: project.members.length,
        updatedAt: project.updatedAt
      })),
      recentDocuments: documents.slice(0, 8),
      notifications,
      recentActivity,
      latestImportJob
    };
  }

  async dashboard(projectId: string, user: AuthenticatedUser) {
    await this.permissions.assertProjectRole(user, projectId, ["VIEWER"]);

    const [documents, openComments, resolvedComments, tags, traces, recentActivity] = await Promise.all([
      this.prisma.document.findMany({
        where: { projectId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, type: true, status: true, createdAt: true, updatedAt: true, _count: { select: { comments: true, versions: true } } }
      }),
      this.prisma.comment.count({ where: { document: { projectId }, status: "OPEN", parentId: null } }),
      this.prisma.comment.count({ where: { document: { projectId }, status: "RESOLVED", parentId: null } }),
      this.prisma.requirementTag.count({ where: { projectId } }),
      this.prisma.traceLink.count({ where: { projectId } }),
      this.activity(projectId, user, 6)
    ]);

    return {
      documents: documents.length,
      openComments,
      resolvedComments,
      tags,
      traces,
      versions: documents.reduce((total, document) => total + document._count.versions, 0),
      recentDocuments: documents.slice(0, 6),
      recentActivity
    };
  }

  private dashboardScopeLabel(user: AuthenticatedUser) {
    if (user.role === "ADMIN") return user.externalCompanyId ? "Toàn bộ công ty" : "Toàn hệ thống";
    if (user.role === "MANAGER") return user.externalDepartmentId ? "Phòng ban quản lý" : "Dự án được quản lý";
    return "Tài liệu được phân quyền";
  }

  async search(projectId: string, query: string, user: AuthenticatedUser) {
    await this.permissions.assertProjectRole(user, projectId, ["VIEWER"]);
    const q = query.trim();
    if (!q) return { documents: [], comments: [], tags: [] };

    const [documents, comments, tags] = await Promise.all([
      this.prisma.document.findMany({
        where: {
          projectId,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { type: { contains: q, mode: "insensitive" } },
            { htmlContent: { contains: q, mode: "insensitive" } },
            { sourceFileName: { contains: q, mode: "insensitive" } }
          ]
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, title: true, type: true, currentVersion: true, updatedAt: true, htmlContent: true }
      }),
      this.prisma.comment.findMany({
        where: {
          document: { projectId },
          OR: [
            { content: { contains: q, mode: "insensitive" } },
            { selectedText: { contains: q, mode: "insensitive" } },
            { blockId: { contains: q, mode: "insensitive" } }
          ]
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { document: { select: { title: true } } }
      }),
      this.prisma.requirementTag.findMany({
        where: {
          projectId,
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { label: { contains: q, mode: "insensitive" } },
            { selectedText: { contains: q, mode: "insensitive" } }
          ]
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
        include: { document: { select: { title: true } } }
      })
    ]);

    return {
      documents: documents.map((document) => ({
        ...document,
        snippet: this.makeSnippet(this.stripHtml(document.htmlContent), q),
        htmlContent: undefined
      })),
      comments,
      tags
    };
  }

  async versionDiff(documentId: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, documentId, ["VIEWER"]);
    const versions = await this.prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
      take: 2
    });

    if (!versions.length) throw new NotFoundException("Document version not found");
    if (versions.length === 1) {
      return {
        current: versions[0],
        previous: null,
        summary: { added: 0, removed: 0, unchanged: this.textLines(versions[0].htmlContent).length },
        lines: this.textLines(versions[0].htmlContent).map((text) => ({ type: "same", text }))
      };
    }

    const currentLines = this.textLines(versions[0].htmlContent);
    const previousLines = this.textLines(versions[1].htmlContent);
    const lines = this.diffLines(previousLines, currentLines);
    return {
      current: versions[0],
      previous: versions[1],
      summary: {
        added: lines.filter((line) => line.type === "added").length,
        removed: lines.filter((line) => line.type === "removed").length,
        unchanged: lines.filter((line) => line.type === "same").length
      },
      lines
    };
  }

  async tagsForDocument(documentId: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, documentId, ["VIEWER"]);
    const document = await this.prisma.document.findUnique({ where: { id: documentId }, select: { projectId: true, htmlContent: true } });
    if (!document) throw new NotFoundException("Document not found");

    const existing = await this.prisma.requirementTag.findMany({ where: { documentId }, orderBy: [{ kind: "asc" }, { code: "asc" }] });
    const inferred = this.inferRequirementTags(document.htmlContent, documentId, document.projectId);
    const knownCodes = new Set(existing.map((tag) => tag.code.toLowerCase()));
    return {
      saved: existing,
      inferred: inferred.filter((tag) => !knownCodes.has(tag.code.toLowerCase()))
    };
  }

  async createTag(documentId: string, dto: CreateRequirementTagDto, user: AuthenticatedUser) {
    const document = await this.permissions.assertDocumentRole(user, documentId, ["EDITOR", "MANAGER"]);
    const tag = await this.prisma.requirementTag.upsert({
      where: { documentId_code: { documentId, code: dto.code.trim().toUpperCase() } },
      create: {
        projectId: document.projectId,
        documentId,
        code: dto.code.trim().toUpperCase(),
        kind: dto.kind,
        label: dto.label.trim(),
        selectedText: dto.selectedText?.trim(),
        selector: dto.selector?.trim(),
        createdBy: user.id
      },
      update: {
        kind: dto.kind,
        label: dto.label.trim(),
        selectedText: dto.selectedText?.trim(),
        selector: dto.selector?.trim()
      }
    });
    await this.log(user, "TAG_UPSERTED", "RequirementTag", tag.id, { documentId, code: tag.code });
    return tag;
  }

  async removeTag(id: string, user: AuthenticatedUser) {
    const tag = await this.prisma.requirementTag.findUnique({ where: { id }, select: { id: true, documentId: true } });
    if (!tag) throw new NotFoundException("Requirement tag not found");
    await this.permissions.assertDocumentRole(user, tag.documentId, ["EDITOR", "MANAGER"]);
    await this.prisma.requirementTag.delete({ where: { id } });
    await this.log(user, "TAG_DELETED", "RequirementTag", id, { documentId: tag.documentId });
    return { ok: true };
  }

  async traceLinks(projectId: string, user: AuthenticatedUser) {
    await this.permissions.assertProjectRole(user, projectId, ["VIEWER"]);
    return this.prisma.traceLink.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        sourceDocument: { select: { title: true } },
        targetDocument: { select: { title: true } }
      }
    });
  }

  async createTrace(projectId: string, dto: CreateTraceLinkDto, user: AuthenticatedUser) {
    await this.permissions.assertProjectRole(user, projectId, ["EDITOR", "MANAGER"]);
    if (dto.sourceDocumentId) await this.permissions.assertDocumentRole(user, dto.sourceDocumentId, ["VIEWER"]);
    if (dto.targetDocumentId) await this.permissions.assertDocumentRole(user, dto.targetDocumentId, ["VIEWER"]);

    const trace = await this.prisma.traceLink.create({
      data: {
        projectId,
        sourceDocumentId: dto.sourceDocumentId,
        targetDocumentId: dto.targetDocumentId,
        sourceCode: dto.sourceCode.trim().toUpperCase(),
        sourceLabel: dto.sourceLabel.trim(),
        targetCode: dto.targetCode.trim().toUpperCase(),
        targetLabel: dto.targetLabel.trim(),
        relation: dto.relation?.trim() || "traces",
        createdBy: user.id
      }
    });
    await this.log(user, "TRACE_CREATED", "TraceLink", trace.id, { projectId });
    return trace;
  }

  async removeTrace(id: string, user: AuthenticatedUser) {
    const trace = await this.prisma.traceLink.findUnique({ where: { id }, select: { id: true, projectId: true } });
    if (!trace) throw new NotFoundException("Trace link not found");
    await this.permissions.assertProjectRole(user, trace.projectId, ["EDITOR", "MANAGER"]);
    await this.prisma.traceLink.delete({ where: { id } });
    await this.log(user, "TRACE_DELETED", "TraceLink", id, { projectId: trace.projectId });
    return { ok: true };
  }

  async notifications(user: AuthenticatedUser) {
    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50
    });
  }

  async markNotificationRead(id: string, user: AuthenticatedUser) {
    return this.prisma.notification.update({
      where: { id, userId: user.id },
      data: { readAt: new Date() }
    });
  }

  async activity(projectId: string, user: AuthenticatedUser, take = 30) {
    await this.permissions.assertProjectRole(user, projectId, ["VIEWER"]);
    const documents = await this.prisma.document.findMany({ where: { projectId }, select: { id: true } });
    const documentIds = documents.map((document) => document.id);
    return this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: "Project", entityId: projectId },
          { entityType: "Document", entityId: { in: documentIds } },
          { metadata: { path: ["projectId"], equals: projectId } }
        ]
      },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take
    });
  }

  async templates(user: AuthenticatedUser) {
    await this.ensureSystemTemplates();
    return this.prisma.documentTemplate.findMany({
      where: {
        OR: [
          { isSystem: true },
          { createdById: user.id }
        ]
      },
      orderBy: [{ isSystem: "desc" }, { type: "asc" }, { name: "asc" }]
    });
  }

  async createTemplate(dto: CreateTemplateDto, user: AuthenticatedUser) {
    const template = await this.prisma.documentTemplate.create({
      data: {
        name: dto.name.trim(),
        type: dto.type.trim().toUpperCase(),
        description: dto.description?.trim(),
        htmlContent: this.cleanHtml(dto.htmlContent),
        createdById: user.id
      }
    });
    await this.log(user, "TEMPLATE_CREATED", "DocumentTemplate", template.id, { type: template.type });
    return template;
  }

  async createDocumentFromTemplate(templateId: string, dto: CreateTemplateDocumentDto, user: AuthenticatedUser) {
    const template = await this.prisma.documentTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException("Template not found");
    const document = await this.documentsService.create({
      projectId: dto.projectId,
      title: dto.title?.trim() || template.name,
      type: dto.type?.trim() || template.type,
      htmlContent: template.htmlContent,
      sourceType: "template"
    }, user);
    await this.log(user, "DOCUMENT_CREATED_FROM_TEMPLATE", "Document", document.id, { projectId: dto.projectId, templateId });
    return document;
  }

  async notifyDocumentParticipants(documentId: string, title: string, message: string, actorId?: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        projectId: true,
        permissions: { select: { userId: true } },
        project: { select: { members: { select: { userId: true } } } }
      }
    });
    if (!document) return;
    const userIds = Array.from(new Set([
      ...document.permissions.map((permission) => permission.userId),
      ...document.project.members.map((member) => member.userId)
    ])).filter((userId) => userId !== actorId);
    if (!userIds.length) return;

    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title,
        message,
        entityType: "Document",
        entityId: documentId
      }))
    });
  }

  async log(user: AuthenticatedUser, action: string, entityType?: string, entityId?: string, metadata?: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action,
        entityType,
        entityId,
        metadata
      }
    });
  }

  private inferRequirementTags(html: string, documentId: string, projectId: string) {
    const text = this.stripHtml(html);
    const matches = Array.from(text.matchAll(/\b(BRQ|FR|REQ|API|RULE|FLOW|TEST)[-_]?[A-Z0-9]{2,}(?:[-_]\d{1,4})?\b/gi));
    const seen = new Set<string>();
    return matches
      .map((match) => match[0].replace("_", "-").toUpperCase())
      .filter((code) => {
        if (seen.has(code)) return false;
        seen.add(code);
        return true;
      })
      .slice(0, 80)
      .map((code) => ({
        id: `inferred-${documentId}-${code}`,
        projectId,
        documentId,
        code,
        kind: code.split("-")[0],
        label: code,
        selectedText: code,
        selector: null,
        inferred: true
      }));
  }

  private diffLines(previous: string[], current: string[]): DiffLine[] {
    const rows = previous.length + 1;
    const cols = current.length + 1;
    const dp = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
    for (let i = previous.length - 1; i >= 0; i -= 1) {
      for (let j = current.length - 1; j >= 0; j -= 1) {
        dp[i][j] = previous[i] === current[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    const lines: DiffLine[] = [];
    let i = 0;
    let j = 0;
    while (i < previous.length && j < current.length) {
      if (previous[i] === current[j]) {
        lines.push({ type: "same", text: current[j] });
        i += 1;
        j += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        lines.push({ type: "removed", text: previous[i] });
        i += 1;
      } else {
        lines.push({ type: "added", text: current[j] });
        j += 1;
      }
    }
    while (i < previous.length) lines.push({ type: "removed", text: previous[i++] });
    while (j < current.length) lines.push({ type: "added", text: current[j++] });
    return lines;
  }

  private textLines(html: string) {
    return this.stripHtml(html)
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private stripHtml(html: string) {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<\/(p|div|h[1-6]|li|tr|table|blockquote)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+\n/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  private makeSnippet(text: string, query: string) {
    const lower = text.toLowerCase();
    const index = lower.indexOf(query.toLowerCase());
    if (index < 0) return text.slice(0, 180);
    const start = Math.max(0, index - 70);
    const end = Math.min(text.length, index + query.length + 110);
    return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
  }

  private cleanHtml(html: string) {
    return sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "table", "thead", "tbody", "tr", "th", "td", "span", "section", "article"]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        "*": ["class", "id", "style", "data-block-id", "data-source", "data-page"],
        img: ["src", "alt", "width", "height", "loading", "class"]
      }
    });
  }

  private async ensureSystemTemplates() {
    const existing = await this.prisma.documentTemplate.count({ where: { isSystem: true } });
    if (existing) return;

    await this.prisma.documentTemplate.createMany({
      data: [
        {
          name: "BRD - Tài liệu yêu cầu nghiệp vụ",
          type: "BRD",
          description: "Khung chuẩn để mô tả mục tiêu, phạm vi, quy tắc và yêu cầu nghiệp vụ.",
          isSystem: true,
          htmlContent: "<h1>BRD - Business Requirement Document</h1><h2>1. Mục tiêu</h2><p>Mô tả mục tiêu nghiệp vụ.</p><h2>2. Phạm vi</h2><p>Xác định phạm vi triển khai.</p><h2>3. Yêu cầu nghiệp vụ</h2><table><thead><tr><th>Mã</th><th>Nội dung</th><th>Ưu tiên</th></tr></thead><tbody><tr><td>BRQ-001</td><td>Yêu cầu nghiệp vụ đầu tiên.</td><td>Bắt buộc</td></tr></tbody></table>"
        },
        {
          name: "SRS - Đặc tả yêu cầu phần mềm",
          type: "SRS",
          description: "Khung SRS cho chức năng, API, dữ liệu và luồng xử lý.",
          isSystem: true,
          htmlContent: "<h1>SRS - Software Requirement Specification</h1><h2>1. Tổng quan</h2><p>Mô tả hệ thống và đối tượng sử dụng.</p><h2>2. Functional Requirements</h2><table><thead><tr><th>ID</th><th>Tên</th><th>Mô tả</th></tr></thead><tbody><tr><td>FR-001</td><td>Chức năng mẫu</td><td>Mô tả xử lý chính.</td></tr></tbody></table><h2>3. API</h2><p>API-001 - Endpoint mẫu.</p>"
        },
        {
          name: "UAT - Kịch bản kiểm thử nghiệm thu",
          type: "UAT",
          description: "Khung test case nghiệm thu liên kết yêu cầu.",
          isSystem: true,
          htmlContent: "<h1>UAT - User Acceptance Test</h1><h2>1. Phạm vi kiểm thử</h2><p>Mô tả phạm vi nghiệm thu.</p><h2>2. Test cases</h2><table><thead><tr><th>ID</th><th>Yêu cầu</th><th>Bước kiểm thử</th><th>Kết quả mong đợi</th></tr></thead><tbody><tr><td>TEST-001</td><td>FR-001</td><td>Thực hiện thao tác chính.</td><td>Hệ thống xử lý thành công.</td></tr></tbody></table>"
        }
      ]
    });
  }
}
