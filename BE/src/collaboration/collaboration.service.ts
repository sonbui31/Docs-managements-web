import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProjectRole } from "@prisma/client";
import sanitizeHtml = require("sanitize-html");
import { AuthenticatedUser } from "../auth/auth.types";
import { DocumentsService } from "../documents/documents.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRequirementTagDto } from "./dto/create-requirement-tag.dto";
import { CreateTemplateDocumentDto } from "./dto/create-template-document.dto";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { CreateTraceLinkDto } from "./dto/create-trace-link.dto";

type DiffLine = { type: "same" | "added" | "removed"; text: string };
const dashboardProjectRoles: ProjectRole[] = ["VIEWER", "REVIEWER", "EDITOR", "MANAGER"];

@Injectable()
export class CollaborationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly documentsService: DocumentsService,
    private readonly notificationsService: NotificationsService
  ) {}

  async workspaceDashboard(user: AuthenticatedUser) {
    const projectWhere = this.permissions.projectVisibilityWhere(user);
    const projects = await this.prisma.project.findMany({
      where: projectWhere,
      orderBy: { updatedAt: "desc" },
      include: {
        documents: {
          where: this.permissions.documentVisibilityWhere(user, undefined, ["VIEWER"]),
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
      workItems,
      tags,
      traces,
      tagsByProject,
      traceLinks,
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
      this.prisma.workItem.findMany({
        where: this.dashboardWorkItemWhere(user, projectIds),
        include: this.workItemIncludeRelations(),
        orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }]
      }),
      this.prisma.requirementTag.count({ where: { documentId: { in: documentIds } } }),
      this.prisma.traceLink.count({
        where: {
          projectId: { in: projectIds },
          OR: [
            { sourceDocumentId: { in: documentIds } },
            { targetDocumentId: { in: documentIds } }
          ]
        }
      }),
      this.prisma.requirementTag.groupBy({
        by: ["projectId"],
        where: { documentId: { in: documentIds } },
        _count: { _all: true }
      }),
      this.prisma.traceLink.findMany({
        where: {
          projectId: { in: projectIds },
          OR: [
            { sourceDocumentId: { in: documentIds } },
            { targetDocumentId: { in: documentIds } }
          ]
        },
        select: { projectId: true }
      }),
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
    const tagCountByProject = new Map(tagsByProject.map((group) => [group.projectId, group._count._all]));
    const traceCountByProject = traceLinks.reduce((counts, trace) => {
      counts.set(trace.projectId, (counts.get(trace.projectId) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());
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
        tags: tagCountByProject.get(project.id) ?? 0,
        traces: traceCountByProject.get(project.id) ?? 0,
        members: project.members.length,
        updatedAt: project.updatedAt
      })),
      recentDocuments: documents.slice(0, 8),
      workItems,
      notifications,
      recentActivity,
      latestImportJob
    };
  }

  async dashboard(projectId: string, user: AuthenticatedUser) {
    await this.permissions.assertProjectVisible(user, projectId);
    const documentWhere = this.permissions.documentVisibilityWhere(user, projectId, ["VIEWER"]);

    const [documents, openComments, resolvedComments, tags, traces, recentActivity] = await Promise.all([
      this.prisma.document.findMany({
        where: documentWhere,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { comments: { where: { status: "OPEN", parentId: null } }, versions: true } }
        }
      }),
      this.prisma.comment.count({ where: { document: documentWhere, status: "OPEN", parentId: null } }),
      this.prisma.comment.count({ where: { document: documentWhere, status: "RESOLVED", parentId: null } }),
      this.prisma.requirementTag.count({ where: { document: documentWhere } }),
      this.prisma.traceLink.count({
        where: {
          projectId,
          OR: [
            { sourceDocument: documentWhere },
            { targetDocument: documentWhere }
          ]
        }
      }),
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
    await this.permissions.assertProjectVisible(user, projectId);
    const q = query.trim();
    if (!q) return { documents: [], comments: [], tags: [], workItems: [] };
    const documentWhere = this.permissions.documentVisibilityWhere(user, projectId, ["VIEWER"]);

    const [documents, comments, tags, workItems] = await Promise.all([
      this.prisma.document.findMany({
        where: {
          AND: [
            documentWhere,
            {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { type: { contains: q, mode: "insensitive" } },
                { htmlContent: { contains: q, mode: "insensitive" } },
                { sourceFileName: { contains: q, mode: "insensitive" } }
              ]
            }
          ]
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, title: true, type: true, currentVersion: true, updatedAt: true, htmlContent: true }
      }),
      this.prisma.comment.findMany({
        where: {
          document: documentWhere,
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
          AND: [
            { document: documentWhere },
            {
              OR: [
                { code: { contains: q, mode: "insensitive" } },
                { label: { contains: q, mode: "insensitive" } },
                { selectedText: { contains: q, mode: "insensitive" } }
              ]
            }
          ]
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
        include: { document: { select: { title: true } } }
      }),
      this.prisma.workItem.findMany({
        where: {
          projectId,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { assigneeName: { contains: q, mode: "insensitive" } },
            { createdByName: { contains: q, mode: "insensitive" } },
            { document: { title: { contains: q, mode: "insensitive" } } },
            { comments: { some: { content: { contains: q, mode: "insensitive" } } } },
            { labels: { some: { label: { name: { contains: q, mode: "insensitive" } } } } }
          ]
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          projectId: true,
          documentId: true,
          type: true,
          status: true,
          priority: true,
          title: true,
          description: true,
          assigneeName: true,
          updatedAt: true,
          document: { select: { title: true } },
          labels: { include: { label: true }, take: 5 }
        }
      })
    ]);

    return {
      documents: documents.map((document) => ({
        ...document,
        snippet: this.makeSnippet(this.stripHtml(document.htmlContent), q),
        htmlContent: undefined
      })),
      comments,
      tags,
      workItems: workItems.map((item) => ({
        ...item,
        snippet: this.makeSnippet([item.description, item.assigneeName, item.document?.title].filter(Boolean).join(" "), q)
      }))
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
    await this.permissions.assertProjectVisible(user, projectId);
    const documentWhere = this.permissions.documentVisibilityWhere(user, projectId, ["VIEWER"]);
    return this.prisma.traceLink.findMany({
      where: {
        projectId,
        OR: [
          { sourceDocument: documentWhere },
          { targetDocument: documentWhere }
        ]
      },
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

  async markAllNotificationsRead(user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user);
  }

  async activity(projectId: string, user: AuthenticatedUser, take = 30) {
    const canViewProjectActivity = await this.canUseProjectRole(user, projectId, ["VIEWER"]);
    if (!canViewProjectActivity) {
      await this.permissions.assertProjectVisible(user, projectId);
    }
    const documents = await this.prisma.document.findMany({
      where: this.permissions.documentVisibilityWhere(user, projectId, ["VIEWER"]),
      select: { id: true }
    });
    const documentIds = documents.map((document) => document.id);
    return this.prisma.auditLog.findMany({
      where: {
        OR: canViewProjectActivity
          ? [
              { entityType: "Project", entityId: projectId },
              { entityType: "Document", entityId: { in: documentIds } },
              { metadata: { path: ["projectId"], equals: projectId } }
            ]
          : [
              { entityType: "Document", entityId: { in: documentIds } }
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
    await this.notificationsService.notifyDocumentParticipants(documentId, title, message, actorId ? { id: actorId, name: "", email: "" } : null);
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
    const systemTemplates = [
      {
        name: "BRD - Tài liệu yêu cầu nghiệp vụ",
        type: "BRD",
        description: "Chuẩn BA/PM cho dự án Việt Nam: mục tiêu, phạm vi, stakeholder, rule, dữ liệu, phê duyệt.",
        htmlContent: `<h1>BRD - Tài liệu yêu cầu nghiệp vụ</h1>
<h2>1. Thông tin kiểm soát tài liệu</h2>
<table><tbody><tr><th>Dự án</th><td>[Tên dự án]</td><th>Phiên bản</th><td>v0.1</td></tr><tr><th>Đơn vị yêu cầu</th><td>[Phòng ban/Khối]</td><th>Ngày cập nhật</th><td>[dd/mm/yyyy]</td></tr><tr><th>BA phụ trách</th><td>[Họ tên]</td><th>Người phê duyệt</th><td>[Sponsor/PO]</td></tr></tbody></table>
<h2>2. Bối cảnh và vấn đề nghiệp vụ</h2><p>Mô tả hiện trạng vận hành, điểm đau, số liệu nền và lý do cần triển khai thay đổi.</p>
<h2>3. Mục tiêu kinh doanh và KPI</h2><table><thead><tr><th>Mã</th><th>Mục tiêu</th><th>Chỉ số đo</th><th>Mốc kỳ vọng</th></tr></thead><tbody><tr><td>OBJ-001</td><td>Giảm thời gian xử lý hồ sơ</td><td>Thời gian TAT trung bình</td><td>Giảm 30%</td></tr></tbody></table>
<h2>4. Phạm vi triển khai</h2><table><thead><tr><th>Trong phạm vi</th><th>Ngoài phạm vi</th><th>Ghi chú</th></tr></thead><tbody><tr><td>[Module/quy trình]</td><td>[Không triển khai giai đoạn này]</td><td>[Ràng buộc nếu có]</td></tr></tbody></table>
<h2>5. Stakeholder và ma trận trách nhiệm</h2><table><thead><tr><th>Vai trò</th><th>Đơn vị</th><th>Trách nhiệm</th><th>Người đại diện</th></tr></thead><tbody><tr><td>Business Owner</td><td>[Khối nghiệp vụ]</td><td>Chốt yêu cầu và nghiệm thu</td><td>[Tên]</td></tr><tr><td>IT Owner</td><td>[Khối CNTT]</td><td>Đánh giá giải pháp và triển khai</td><td>[Tên]</td></tr></tbody></table>
<h2>6. Yêu cầu nghiệp vụ</h2><table><thead><tr><th>Mã</th><th>Nghiệp vụ</th><th>Mô tả chi tiết</th><th>Ưu tiên</th><th>Tiêu chí chấp nhận</th></tr></thead><tbody><tr><td>BRQ-001</td><td>[Tên yêu cầu]</td><td>[Luồng xử lý, ngoại lệ, rule]</td><td>Must</td><td>AC-001</td></tr></tbody></table>
<h2>7. Quy tắc nghiệp vụ</h2><table><thead><tr><th>Mã rule</th><th>Nội dung rule</th><th>Nguồn quy định</th><th>Tác động</th></tr></thead><tbody><tr><td>RULE-001</td><td>[Điều kiện tính phí/duyệt/hạn mức]</td><td>[Quy trình nội bộ/quy định hiện hành]</td><td>[Module chịu ảnh hưởng]</td></tr></tbody></table>
<h2>8. Dữ liệu, báo cáo và tuân thủ</h2><ul><li>Dữ liệu đầu vào/đầu ra cần lưu vết.</li><li>Yêu cầu phân quyền, nhật ký thao tác, bảo mật dữ liệu cá nhân.</li><li>Báo cáo vận hành/quản trị cần xuất sau go-live.</li></ul>
<h2>9. Giả định, ràng buộc và rủi ro</h2><table><thead><tr><th>Loại</th><th>Nội dung</th><th>Phương án xử lý</th></tr></thead><tbody><tr><td>Ràng buộc</td><td>[Deadline, ngân sách, hệ thống tích hợp]</td><td>[Cách kiểm soát]</td></tr></tbody></table>
<h2>10. Sign-off</h2><table><thead><tr><th>Vai trò</th><th>Họ tên</th><th>Ngày</th><th>Ý kiến</th></tr></thead><tbody><tr><td>Business Owner</td><td></td><td></td><td></td></tr><tr><td>IT Owner</td><td></td><td></td><td></td></tr></tbody></table>`
      },
      {
        name: "SRS - Đặc tả yêu cầu phần mềm",
        type: "SRS",
        description: "Đặc tả cho đội dev/test: chức năng, màn hình, API, dữ liệu, phân quyền và xử lý lỗi.",
        htmlContent: `<h1>SRS - Đặc tả yêu cầu phần mềm</h1>
<h2>1. Tổng quan giải pháp</h2><p>Mô tả phạm vi hệ thống, kênh sử dụng, nhóm người dùng và hệ thống liên quan.</p>
<h2>2. Kiến trúc chức năng</h2><table><thead><tr><th>Module</th><th>Mục đích</th><th>Người dùng</th><th>Ghi chú</th></tr></thead><tbody><tr><td>[Module]</td><td>[Mục đích]</td><td>[Vai trò]</td><td>[Ràng buộc]</td></tr></tbody></table>
<h2>3. Functional requirements</h2><table><thead><tr><th>ID</th><th>Chức năng</th><th>Mô tả xử lý</th><th>Rule</th><th>AC</th></tr></thead><tbody><tr><td>FR-001</td><td>[Tên chức năng]</td><td>[Input, xử lý, output]</td><td>RULE-001</td><td>AC-001</td></tr></tbody></table>
<h2>4. Màn hình và tương tác</h2><table><thead><tr><th>Màn hình</th><th>Trường dữ liệu</th><th>Validation</th><th>Hành động</th></tr></thead><tbody><tr><td>SCR-001</td><td>[Tên trường]</td><td>[Required/format/range]</td><td>[Tạo/Cập nhật/Duyệt]</td></tr></tbody></table>
<h2>5. Phân quyền</h2><table><thead><tr><th>Vai trò</th><th>Xem</th><th>Tạo/Sửa</th><th>Duyệt</th><th>Xuất dữ liệu</th></tr></thead><tbody><tr><td>Nhân viên</td><td>Có</td><td>Có</td><td>Không</td><td>Không</td></tr><tr><td>Quản lý</td><td>Có</td><td>Có</td><td>Có</td><td>Có</td></tr></tbody></table>
<h2>6. API và tích hợp</h2><p>Liệt kê API nội bộ/đối tác, cơ chế xác thực, retry, timeout và mapping dữ liệu.</p>
<h2>7. Xử lý lỗi và audit log</h2><table><thead><tr><th>Mã lỗi</th><th>Điều kiện</th><th>Thông báo người dùng</th><th>Log cần ghi</th></tr></thead><tbody><tr><td>ERR-001</td><td>[Điều kiện lỗi]</td><td>[Thông báo tiếng Việt]</td><td>[Actor, thời gian, dữ liệu liên quan]</td></tr></tbody></table>
<h2>8. Traceability</h2><table><thead><tr><th>BRD</th><th>FR</th><th>API</th><th>Test case</th></tr></thead><tbody><tr><td>BRQ-001</td><td>FR-001</td><td>API-001</td><td>TC-001</td></tr></tbody></table>`
      },
      {
        name: "User Story - Backlog nghiệp vụ",
        type: "USER_STORY",
        description: "Backlog thực dụng cho Scrum/Kanban: persona Việt hóa, rule, AC, dependency và estimate.",
        htmlContent: `<h1>User Story - Backlog nghiệp vụ</h1>
<h2>1. Thông tin story</h2><table><tbody><tr><th>Epic</th><td>EPIC-001</td><th>Priority</th><td>Must/Should/Could</td></tr><tr><th>Persona</th><td>[Nhân viên nghiệp vụ/Quản lý/Khách hàng]</td><th>Sprint/Release</th><td>[Sprint]</td></tr><tr><th>Owner</th><td>[PO/BA]</td><th>Estimate</th><td>[Story point]</td></tr></tbody></table>
<h2>2. User story</h2><p>Là [vai trò], tôi muốn [khả năng/chức năng] để [giá trị nghiệp vụ đạt được].</p>
<h2>3. Bối cảnh nghiệp vụ</h2><p>Mô tả tình huống sử dụng tại doanh nghiệp Việt Nam: chi nhánh/phòng ban/kênh giao dịch/quy trình phê duyệt.</p>
<h2>4. Acceptance criteria</h2><table><thead><tr><th>ID</th><th>Given</th><th>When</th><th>Then</th><th>Priority</th></tr></thead><tbody><tr><td>AC-001</td><td>[Dữ liệu/hồ sơ hợp lệ]</td><td>[Người dùng thực hiện]</td><td>[Kết quả mong đợi]</td><td>Must</td></tr></tbody></table>
<h2>5. Quy tắc và validation</h2><ul><li>RULE-001: [Quy tắc tính toán/duyệt/hạn mức]</li><li>VAL-001: [Kiểm tra bắt buộc/định dạng/logic ngày]</li></ul>
<h2>6. Dependency và rủi ro</h2><table><thead><tr><th>Loại</th><th>Nội dung</th><th>Người xử lý</th></tr></thead><tbody><tr><td>Dependency</td><td>[API/dữ liệu/phê duyệt]</td><td>[Team/Owner]</td></tr></tbody></table>`
      },
      {
        name: "Use Case - Luồng nghiệp vụ",
        type: "USE_CASE",
        description: "Mô tả luồng vận hành có actor, tiền điều kiện, main flow, ngoại lệ và hậu kiểm.",
        htmlContent: `<h1>Use Case - Luồng nghiệp vụ</h1>
<h2>1. Tóm tắt use case</h2><table><tbody><tr><th>Mã</th><td>UC-001</td><th>Tên luồng</th><td>[Tên luồng nghiệp vụ]</td></tr><tr><th>Actor chính</th><td>[Vai trò]</td><th>Actor phụ</th><td>[Hệ thống/đơn vị liên quan]</td></tr><tr><th>Tần suất</th><td>[Hàng ngày/tháng]</td><th>Kênh</th><td>[Web/Mobile/Backoffice]</td></tr></tbody></table>
<h2>2. Tiền điều kiện</h2><ul><li>Người dùng đã đăng nhập và có quyền phù hợp.</li><li>Dữ liệu/hồ sơ đã được khởi tạo theo quy trình.</li></ul>
<h2>3. Main flow</h2><table><thead><tr><th>Bước</th><th>Actor</th><th>Thao tác</th><th>Hệ thống xử lý</th><th>Output</th></tr></thead><tbody><tr><td>1</td><td>[Người dùng]</td><td>[Nhập/chọn dữ liệu]</td><td>[Validate và lưu]</td><td>[Trạng thái mới]</td></tr></tbody></table>
<h2>4. Alternate flow</h2><table><thead><tr><th>Mã</th><th>Điều kiện rẽ nhánh</th><th>Xử lý</th><th>Quay lại bước</th></tr></thead><tbody><tr><td>AF-001</td><td>[Không đủ điều kiện]</td><td>[Yêu cầu bổ sung]</td><td>Bước 1</td></tr></tbody></table>
<h2>5. Exception flow</h2><table><thead><tr><th>Mã lỗi</th><th>Tình huống</th><th>Thông báo</th><th>Hành động tiếp theo</th></tr></thead><tbody><tr><td>EX-001</td><td>[API timeout]</td><td>[Không thể hoàn tất, vui lòng thử lại]</td><td>Cho phép retry</td></tr></tbody></table>
<h2>6. Hậu điều kiện và kiểm soát</h2><ul><li>Trạng thái hồ sơ được cập nhật.</li><li>Audit log ghi nhận người thao tác, thời gian, dữ liệu thay đổi.</li><li>Thông báo được gửi tới vai trò liên quan nếu cần.</li></ul>`
      },
      {
        name: "UAT Plan - Kế hoạch nghiệm thu",
        type: "UAT",
        description: "Kế hoạch UAT cho business: phạm vi, dữ liệu, nhân sự, lịch test, tiêu chí go-live.",
        htmlContent: `<h1>UAT Plan - Kế hoạch nghiệm thu</h1>
<h2>1. Mục tiêu UAT</h2><p>Xác nhận hệ thống đáp ứng yêu cầu nghiệp vụ đã thống nhất trước khi triển khai chính thức.</p>
<h2>2. Phạm vi nghiệm thu</h2><table><thead><tr><th>Module/Luồng</th><th>Trong phạm vi</th><th>Ngoài phạm vi</th><th>Ghi chú</th></tr></thead><tbody><tr><td>[Module]</td><td>[Luồng cần test]</td><td>[Luồng chưa test]</td><td>[Ràng buộc]</td></tr></tbody></table>
<h2>3. Nhân sự tham gia</h2><table><thead><tr><th>Vai trò</th><th>Họ tên</th><th>Đơn vị</th><th>Trách nhiệm</th></tr></thead><tbody><tr><td>Business Tester</td><td></td><td></td><td>Thực hiện test và xác nhận kết quả</td></tr><tr><td>BA</td><td></td><td></td><td>Điều phối, ghi nhận issue</td></tr><tr><td>Dev/QA</td><td></td><td></td><td>Hỗ trợ xử lý lỗi</td></tr></tbody></table>
<h2>4. Môi trường và dữ liệu test</h2><ul><li>Môi trường: UAT/Staging.</li><li>Tài khoản test theo vai trò.</li><li>Dữ liệu test có che/mã hóa thông tin nhạy cảm nếu lấy từ production.</li></ul>
<h2>5. Lịch UAT</h2><table><thead><tr><th>Ngày</th><th>Nội dung</th><th>Người phụ trách</th><th>Kết quả mong đợi</th></tr></thead><tbody><tr><td>[dd/mm]</td><td>Kickoff và hướng dẫn test</td><td>BA/PM</td><td>Business nắm phạm vi test</td></tr></tbody></table>
<h2>6. Tiêu chí pass/fail và sign-off</h2><ul><li>100% test case mức Must được pass hoặc có workaround được business chấp nhận.</li><li>Không còn lỗi blocker/critical trước go-live.</li><li>Business Owner xác nhận biên bản nghiệm thu.</li></ul>`
      },
      {
        name: "UAT Test Case - Chi tiết ca kiểm thử",
        type: "UAT_TEST_CASE",
        description: "Ca kiểm thử UAT chi tiết theo requirement, dữ liệu, bước test, expected/actual và defect.",
        htmlContent: `<h1>UAT Test Case - Chi tiết ca kiểm thử</h1>
<h2>1. Thông tin bộ test</h2><table><tbody><tr><th>Release</th><td>[Release]</td><th>Môi trường</th><td>UAT</td></tr><tr><th>Người test</th><td>[Tên]</td><th>Ngày test</th><td>[dd/mm/yyyy]</td></tr></tbody></table>
<h2>2. Danh sách test case</h2><table><thead><tr><th>TC ID</th><th>Requirement</th><th>Module</th><th>Precondition</th><th>Test data</th><th>Steps</th><th>Expected result</th><th>Actual result</th><th>Status</th><th>Defect ID</th></tr></thead><tbody><tr><td>TC-001</td><td>BRQ-001/FR-001</td><td>[Module]</td><td>[Điều kiện trước]</td><td>[Dữ liệu test]</td><td>1. Mở màn hình<br>2. Nhập dữ liệu<br>3. Bấm lưu</td><td>[Kết quả mong đợi]</td><td></td><td>Not Run</td><td></td></tr></tbody></table>
<h2>3. Quy ước trạng thái</h2><ul><li>Pass: đúng expected result.</li><li>Fail: sai expected result, cần log defect.</li><li>Blocked: không test được do môi trường/dữ liệu/dependency.</li><li>N/A: không áp dụng cho phạm vi release.</li></ul>`
      },
      {
        name: "UAT Script - Script nghiệm thu",
        type: "UAT_SCRIPT",
        description: "Script chạy phiên UAT theo ngày: kịch bản, checklist, issue log và xác nhận nghiệp vụ.",
        htmlContent: `<h1>UAT Script - Script nghiệm thu</h1>
<h2>1. Thông tin phiên test</h2><table><tbody><tr><th>Phiên UAT</th><td>[UAT round 1/2]</td><th>Build version</th><td>[v]</td></tr><tr><th>Người điều phối</th><td>[BA/PM]</td><th>Business tester</th><td>[Danh sách]</td></tr><tr><th>Môi trường</th><td>UAT</td><th>Thời gian</th><td>[dd/mm/yyyy]</td></tr></tbody></table>
<h2>2. Kịch bản chạy test</h2><table><thead><tr><th>Thứ tự</th><th>Test case</th><th>Dữ liệu chuẩn bị</th><th>Người test</th><th>Thời lượng</th><th>Ghi chú</th></tr></thead><tbody><tr><td>1</td><td>TC-001</td><td>[Tài khoản/hồ sơ]</td><td>[Tên]</td><td>15 phút</td><td></td></tr></tbody></table>
<h2>3. Issue log trong phiên</h2><table><thead><tr><th>ID</th><th>Mô tả</th><th>Mức độ</th><th>Owner</th><th>ETA</th><th>Trạng thái</th></tr></thead><tbody><tr><td>BUG-001</td><td>[Lỗi phát hiện]</td><td>High</td><td>[Dev/QA]</td><td>[dd/mm]</td><td>Open</td></tr></tbody></table>
<h2>4. Kết luận phiên UAT</h2><p>[Pass có điều kiện/Chưa đạt/Cần retest]. Ghi rõ điều kiện còn treo nếu có.</p>`
      },
      {
        name: "Meeting Minutes - Biên bản họp",
        type: "MEETING_MINUTES",
        description: "Biên bản họp dự án: quyết định, vấn đề mở, action item, owner, deadline và xác nhận.",
        htmlContent: `<h1>Meeting Minutes - Biên bản họp</h1>
<h2>1. Thông tin cuộc họp</h2><table><tbody><tr><th>Chủ đề</th><td>[Tên cuộc họp]</td><th>Ngày giờ</th><td>[dd/mm/yyyy hh:mm]</td></tr><tr><th>Hình thức</th><td>[Online/Offline]</td><th>Người ghi biên bản</th><td>[Tên]</td></tr><tr><th>Thành phần</th><td>[Business, IT, Vendor, QA, vận hành]</td><th>Người chủ trì</th><td>[Tên]</td></tr></tbody></table>
<h2>2. Mục tiêu họp</h2><p>[Chốt yêu cầu / xử lý issue / review thiết kế / nghiệm thu].</p>
<h2>3. Nội dung trao đổi</h2><table><thead><tr><th>STT</th><th>Nội dung</th><th>Ý kiến/Phản hồi</th><th>Kết luận</th></tr></thead><tbody><tr><td>1</td><td>[Vấn đề]</td><td>[Ý kiến các bên]</td><td>[Kết luận]</td></tr></tbody></table>
<h2>4. Quyết định đã chốt</h2><table><thead><tr><th>Mã</th><th>Quyết định</th><th>Ảnh hưởng</th><th>Người xác nhận</th></tr></thead><tbody><tr><td>DEC-001</td><td>[Nội dung quyết định]</td><td>[Yêu cầu/timeline/scope]</td><td>[Tên]</td></tr></tbody></table>
<h2>5. Action items</h2><table><thead><tr><th>Action</th><th>Owner</th><th>Deadline</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody><tr><td>ACTION-001</td><td>[Tên]</td><td>[dd/mm]</td><td>Open</td><td></td></tr></tbody></table>
<h2>6. Vấn đề còn mở</h2><table><thead><tr><th>ID</th><th>Vấn đề</th><th>Người phụ trách</th><th>Ngày cần phản hồi</th></tr></thead><tbody><tr><td>OPEN-001</td><td>[Nội dung]</td><td>[Tên]</td><td>[dd/mm]</td></tr></tbody></table>`
      },
      {
        name: "Change Request - Yêu cầu thay đổi",
        type: "CR",
        description: "Mẫu CR sát quy trình Việt Nam: lý do, phạm vi, effort, chi phí, rủi ro, CAB/approval.",
        htmlContent: `<h1>Change Request - Yêu cầu thay đổi</h1>
<h2>1. Thông tin CR</h2><table><tbody><tr><th>Mã CR</th><td>CR-001</td><th>Ngày tạo</th><td>[dd/mm/yyyy]</td></tr><tr><th>Người yêu cầu</th><td>[Tên/Đơn vị]</td><th>Mức ưu tiên</th><td>High/Medium/Low</td></tr><tr><th>Release ảnh hưởng</th><td>[Release]</td><th>Loại thay đổi</th><td>Scope/Rule/UI/API/Data</td></tr></tbody></table>
<h2>2. Mô tả thay đổi</h2><p>Mô tả hiện trạng, yêu cầu thay đổi, lý do phát sinh và giá trị kỳ vọng.</p>
<h2>3. Impact analysis</h2><table><thead><tr><th>Nhóm tác động</th><th>Chi tiết</th><th>Mức độ</th><th>Ghi chú</th></tr></thead><tbody><tr><td>Nghiệp vụ</td><td>[Quy trình, phòng ban, SLA]</td><td>Medium</td><td></td></tr><tr><td>Kỹ thuật</td><td>[Module/API/DB]</td><td>High</td><td></td></tr><tr><td>Dữ liệu</td><td>[Migration/report]</td><td>Low</td><td></td></tr></tbody></table>
<h2>4. Ước lượng và kế hoạch</h2><table><thead><tr><th>Hạng mục</th><th>Effort</th><th>Owner</th><th>ETA</th></tr></thead><tbody><tr><td>Phân tích</td><td>[MD]</td><td>BA</td><td>[dd/mm]</td></tr><tr><td>Phát triển</td><td>[MD]</td><td>Dev</td><td>[dd/mm]</td></tr><tr><td>Test/UAT</td><td>[MD]</td><td>QA/Business</td><td>[dd/mm]</td></tr></tbody></table>
<h2>5. Rủi ro và phương án rollback</h2><p>[Rủi ro vận hành, dữ liệu, tích hợp, kế hoạch khôi phục nếu triển khai thất bại].</p>
<h2>6. Phê duyệt</h2><table><thead><tr><th>Vai trò</th><th>Người duyệt</th><th>Kết quả</th><th>Ngày</th></tr></thead><tbody><tr><td>Business Owner</td><td></td><td>Approve/Reject</td><td></td></tr><tr><td>IT Owner/CAB</td><td></td><td>Approve/Reject</td><td></td></tr></tbody></table>`
      },
      {
        name: "API Spec - Đặc tả API",
        type: "API_SPEC",
        description: "Đặc tả API đủ cho dev/vendor: auth, request/response, validation, error, retry, audit.",
        htmlContent: `<h1>API Spec - Đặc tả API</h1>
<h2>1. Thông tin endpoint</h2><table><tbody><tr><th>API ID</th><td>API-001</td><th>Version</th><td>v1</td></tr><tr><th>Method</th><td>POST</td><th>Path</th><td>/api/v1/[resource]</td></tr><tr><th>Owner</th><td>[Team]</td><th>SLA</th><td>P95 &lt; 2s</td></tr></tbody></table>
<h2>2. Xác thực và bảo mật</h2><ul><li>Authentication: JWT/OAuth2/API key theo chuẩn dự án.</li><li>Authorization: kiểm tra role/scope theo nghiệp vụ.</li><li>Dữ liệu nhạy cảm phải mask trong log.</li></ul>
<h2>3. Request headers</h2><table><thead><tr><th>Header</th><th>Bắt buộc</th><th>Mô tả</th><th>Ví dụ</th></tr></thead><tbody><tr><td>Authorization</td><td>Có</td><td>Bearer token</td><td>Bearer xxx</td></tr><tr><td>X-Request-ID</td><td>Có</td><td>Mã trace giao dịch</td><td>REQ-...</td></tr></tbody></table>
<h2>4. Request body</h2><pre>{
  "customerId": "CIF001",
  "amount": 1500000,
  "note": "Giao dich mau"
}</pre>
<h2>5. Response body</h2><pre>{
  "code": "SUCCESS",
  "message": "Xu ly thanh cong",
  "data": {}
}</pre>
<h2>6. Validation và error codes</h2><table><thead><tr><th>Code</th><th>HTTP</th><th>Điều kiện</th><th>Thông báo</th><th>Hướng xử lý</th></tr></thead><tbody><tr><td>VAL-001</td><td>400</td><td>Thiếu trường bắt buộc</td><td>Dữ liệu không hợp lệ</td><td>Kiểm tra request</td></tr><tr><td>AUTH-001</td><td>403</td><td>Không đủ quyền</td><td>Bạn không có quyền thực hiện</td><td>Kiểm tra role</td></tr></tbody></table>
<h2>7. Tích hợp, timeout và retry</h2><table><thead><tr><th>Hệ thống</th><th>Timeout</th><th>Retry</th><th>Fallback</th></tr></thead><tbody><tr><td>[Core/CRM/ERP]</td><td>30s</td><td>3 lần</td><td>Ghi pending để xử lý lại</td></tr></tbody></table>`
      },
      {
        name: "Process Flow - Quy trình nghiệp vụ",
        type: "PROCESS_FLOW",
        description: "Quy trình nghiệp vụ dạng swimlane: bước xử lý, đầu vào/ra, SLA, kiểm soát và ngoại lệ.",
        htmlContent: `<h1>Process Flow - Quy trình nghiệp vụ</h1>
<h2>1. Mục tiêu quy trình</h2><p>Nêu mục tiêu vận hành, phạm vi áp dụng, chi nhánh/phòng ban/kênh xử lý liên quan.</p>
<h2>2. Swimlane/Actor</h2><table><thead><tr><th>Actor</th><th>Vai trò trong quy trình</th><th>Hệ thống sử dụng</th></tr></thead><tbody><tr><td>[Nhân viên]</td><td>Khởi tạo hồ sơ</td><td>[Web/App/Core]</td></tr><tr><td>[Quản lý]</td><td>Kiểm tra và phê duyệt</td><td>[Backoffice]</td></tr></tbody></table>
<h2>3. Quy trình chi tiết</h2><table><thead><tr><th>Step</th><th>Actor</th><th>Input</th><th>Action</th><th>Output</th><th>SLA</th><th>Rule</th></tr></thead><tbody><tr><td>FLOW-001</td><td>[Actor]</td><td>[Hồ sơ/Dữ liệu]</td><td>[Thao tác]</td><td>[Trạng thái]</td><td>[T+1]</td><td>RULE-001</td></tr></tbody></table>
<h2>4. Điểm kiểm soát</h2><ul><li>Kiểm tra dữ liệu bắt buộc trước khi chuyển bước.</li><li>Ghi nhận người duyệt, thời gian duyệt, lý do từ chối.</li><li>Cảnh báo quá hạn SLA cho owner.</li></ul>
<h2>5. Ngoại lệ và xử lý thủ công</h2><table><thead><tr><th>Mã</th><th>Ngoại lệ</th><th>Cách xử lý</th><th>Người quyết định</th></tr></thead><tbody><tr><td>EX-001</td><td>[Thiếu dữ liệu/tích hợp lỗi]</td><td>[Bổ sung/retry/xử lý tay]</td><td>[Vai trò]</td></tr></tbody></table>`
      },
      {
        name: "Acceptance Criteria - Điều kiện nghiệm thu",
        type: "AC",
        description: "AC rõ để BA/QA/Business nghiệm thu: Given/When/Then, dữ liệu, negative case, traceability.",
        htmlContent: `<h1>Acceptance Criteria - Điều kiện nghiệm thu</h1>
<h2>1. Nguyên tắc nghiệm thu</h2><ul><li>AC phải đo được, test được và liên kết với BRD/SRS/User Story.</li><li>Bao gồm happy path, validation, phân quyền và ngoại lệ nghiệp vụ.</li></ul>
<h2>2. Danh sách AC</h2><table><thead><tr><th>AC ID</th><th>Requirement/Story</th><th>Given</th><th>When</th><th>Then</th><th>Loại case</th><th>Priority</th></tr></thead><tbody><tr><td>AC-001</td><td>US-001</td><td>Người dùng có quyền và hồ sơ hợp lệ</td><td>Người dùng gửi yêu cầu duyệt</td><td>Hệ thống chuyển trạng thái sang Chờ duyệt và gửi thông báo</td><td>Happy path</td><td>Must</td></tr><tr><td>AC-002</td><td>US-001</td><td>Thiếu trường bắt buộc</td><td>Người dùng bấm lưu</td><td>Hệ thống hiển thị lỗi tiếng Việt tại đúng trường</td><td>Validation</td><td>Must</td></tr></tbody></table>
<h2>3. Dữ liệu nghiệm thu</h2><table><thead><tr><th>Data set</th><th>Mục đích</th><th>Nguồn dữ liệu</th><th>Lưu ý bảo mật</th></tr></thead><tbody><tr><td>DATA-001</td><td>Hồ sơ hợp lệ</td><td>UAT seed</td><td>Không dùng dữ liệu cá nhân thật nếu chưa mask</td></tr></tbody></table>
<h2>4. Traceability</h2><table><thead><tr><th>AC</th><th>BRD/SRS</th><th>Test case</th><th>Người xác nhận</th></tr></thead><tbody><tr><td>AC-001</td><td>BRQ-001/FR-001</td><td>TC-001</td><td>[Business]</td></tr></tbody></table>`
      },
      {
        name: "NFR - Yêu cầu phi chức năng",
        type: "NFR",
        description: "NFR sát vận hành doanh nghiệp: hiệu năng, bảo mật, audit, backup, HA, tuân thủ dữ liệu.",
        htmlContent: `<h1>NFR - Yêu cầu phi chức năng</h1>
<h2>1. Phạm vi NFR</h2><p>Áp dụng cho các module, API, batch job, báo cáo và tích hợp thuộc phạm vi release.</p>
<h2>2. Danh sách yêu cầu</h2><table><thead><tr><th>ID</th><th>Nhóm</th><th>Yêu cầu</th><th>Tiêu chí đo</th><th>Ưu tiên</th><th>Cách kiểm chứng</th></tr></thead><tbody><tr><td>NFR-001</td><td>Performance</td><td>Màn hình chính phản hồi nhanh trong giờ cao điểm</td><td>P95 &lt; 2s với [x] người dùng đồng thời</td><td>High</td><td>Load test</td></tr><tr><td>NFR-002</td><td>Security</td><td>Phân quyền theo vai trò và đơn vị</td><td>Không truy cập dữ liệu ngoài phạm vi</td><td>Must</td><td>Security test</td></tr><tr><td>NFR-003</td><td>Audit</td><td>Lưu lịch sử thao tác quan trọng</td><td>Actor, thời gian, dữ liệu trước/sau</td><td>Must</td><td>Kiểm tra audit log</td></tr></tbody></table>
<h2>3. Bảo mật và dữ liệu cá nhân</h2><ul><li>Mask thông tin nhạy cảm trên UI, log và export.</li><li>Kiểm soát quyền xem/tải/xóa dữ liệu.</li><li>Tuân thủ quy định nội bộ và quy định hiện hành về bảo vệ dữ liệu.</li></ul>
<h2>4. Vận hành</h2><table><thead><tr><th>Hạng mục</th><th>Yêu cầu</th><th>Owner</th><th>Ghi chú</th></tr></thead><tbody><tr><td>Backup</td><td>[RPO/RTO]</td><td>Infra</td><td></td></tr><tr><td>Monitoring</td><td>Alert lỗi API/batch/SLA</td><td>DevOps</td><td></td></tr></tbody></table>`
      },
      {
        name: "Data Mapping - Mapping dữ liệu",
        type: "DATA_MAPPING",
        description: "Mapping dữ liệu cho tích hợp/migration/report: nguồn, đích, transform, validation, owner.",
        htmlContent: `<h1>Data Mapping - Mapping dữ liệu</h1>
<h2>1. Phạm vi mapping</h2><table><tbody><tr><th>Nguồn</th><td>[Core/CRM/Excel/API]</td><th>Đích</th><td>[DWH/App/Report]</td></tr><tr><th>Tần suất</th><td>[Realtime/Batch]</td><th>Owner dữ liệu</th><td>[Đơn vị]</td></tr></tbody></table>
<h2>2. Mapping field</h2><table><thead><tr><th>ID</th><th>Source system</th><th>Source field</th><th>Target field</th><th>Kiểu dữ liệu</th><th>Transform rule</th><th>Validation</th><th>Ghi chú</th></tr></thead><tbody><tr><td>MAP-001</td><td>CRM</td><td>customer.fullName</td><td>customer_name</td><td>String(255)</td><td>Trim, chuẩn hóa khoảng trắng</td><td>Required</td><td></td></tr><tr><td>MAP-002</td><td>Core</td><td>amount</td><td>transaction_amount</td><td>Decimal(18,2)</td><td>Giữ nguyên VND</td><td>&gt;= 0</td><td></td></tr></tbody></table>
<h2>3. Quy tắc chất lượng dữ liệu</h2><ul><li>Không import bản ghi thiếu khóa định danh bắt buộc.</li><li>Ghi file reject/error report cho bản ghi lỗi.</li><li>Đối soát số lượng bản ghi nguồn/đích sau xử lý.</li></ul>
<h2>4. Đối soát và sign-off</h2><table><thead><tr><th>Chỉ tiêu</th><th>Nguồn</th><th>Đích</th><th>Chênh lệch</th><th>Người xác nhận</th></tr></thead><tbody><tr><td>Số bản ghi</td><td></td><td></td><td></td><td></td></tr></tbody></table>`
      }
    ].map((template) => ({ ...template, isSystem: true }));

    const existing = await this.prisma.documentTemplate.findMany({
      where: { isSystem: true },
      select: { type: true, name: true, description: true, htmlContent: true }
    });
    const existingByType = new Map(existing.map((template) => [template.type, template]));

    const templateWrites = [
      ...systemTemplates
        .filter((template) => {
          const current = existingByType.get(template.type);
          return current && (
            current.name !== template.name ||
            current.description !== template.description ||
            current.htmlContent !== template.htmlContent
          );
        })
        .map((template) =>
          this.prisma.documentTemplate.updateMany({
            where: { isSystem: true, type: template.type },
            data: template
          })
        ),
      ...systemTemplates
        .filter((template) => !existingByType.has(template.type))
        .map((template) => this.prisma.documentTemplate.create({ data: template }))
    ];

    if (templateWrites.length > 0) {
      await this.prisma.$transaction(templateWrites);
    }
  }

  private async canUseProjectRole(user: AuthenticatedUser, projectId: string, allowedRoles: ProjectRole[]) {
    try {
      await this.permissions.assertProjectRole(user, projectId, allowedRoles);
      return true;
    } catch {
      return false;
    }
  }

  private workItemIncludeRelations() {
    return {
      document: { select: { id: true, title: true, type: true, currentVersion: true } },
      column: true,
      sourceComment: { select: { id: true, blockId: true, selectedText: true, content: true, status: true } },
      assignee: { select: { id: true, name: true, email: true } },
      assignees: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" }
      },
      checklistItems: { orderBy: { position: "asc" } },
      labels: {
        include: { label: true },
        orderBy: { createdAt: "asc" }
      },
      blockingLinks: {
        include: { blockerItem: { select: { id: true, title: true, status: true } } },
        orderBy: { createdAt: "asc" }
      },
      createdBy: { select: { id: true, name: true, email: true } }
    } satisfies Prisma.WorkItemInclude;
  }

  private dashboardWorkItemWhere(user: AuthenticatedUser, projectIds: string[]): Prisma.WorkItemWhereInput {
    const projectScope = { projectId: { in: projectIds } };
    if (user.externalRole === "sadmin" || user.role === "ADMIN" || user.role === "MANAGER") {
      return projectScope;
    }

    return {
      AND: [
        projectScope,
        {
          OR: [
            {
              project: {
                members: {
                  some: {
                    userId: user.id,
                    OR: [
                      { role: { in: dashboardProjectRoles } },
                      { roles: { hasSome: dashboardProjectRoles } }
                    ]
                  }
                }
              }
            },
            { document: this.permissions.documentVisibilityWhere(user, undefined, ["VIEWER"]) },
            { assigneeId: user.id },
            { assignees: { some: { userId: user.id } } },
            { createdById: user.id },
            { createdByEmail: user.email }
          ]
        }
      ]
    };
  }
}
