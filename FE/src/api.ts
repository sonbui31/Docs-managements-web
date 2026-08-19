import type {
  ActivityLog,
  CommentThread,
  DocumentStatus,
  DocumentTemplate,
  DocumentVersion,
  NotificationItem,
  Project,
  ProjectDashboard,
  ProjectDocument,
  ProjectMemberOption,
  RequirementTag,
  RoleDashboard,
  SearchResult,
  TraceLink,
  VersionDiff,
  WorkItem,
  WorkItemActivity,
  WorkItemComment,
  WorkItemPriority,
  WorkItemStatus,
  WorkboardColumn,
  WorkboardColumnType,
  WorkItemType
} from "./types";
import { getAccessToken, refreshSession } from "./authApi";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

type BackendProject = {
  id: string;
  code: string;
  name: string;
  client: string | null;
  description?: string | null;
  externalCompanyId?: string | null;
  externalDepartmentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    documents?: number;
    importJobs?: number;
  };
};

type BackendDocument = {
  id: string;
  projectId: string;
  title: string;
  type: string;
  status: "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "DEPLOYED" | "APPROVED" | "SIGNED_OFF" | "ARCHIVED";
  currentVersion: string;
  htmlContent: string;
  sourceFileName?: string | null;
  sourceType?: string;
  externalCompanyId?: string | null;
  externalDepartmentId?: string | null;
  createdBy?: string | null;
  createdByEmail?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    comments?: number;
    versions?: number;
  };
};

type BackendComment = {
  id: string;
  documentId: string;
  parentId?: string | null;
  blockId: string;
  selectedText?: string | null;
  content: string;
  status: "OPEN" | "RESOLVED";
  createdBy?: string | null;
  createdByEmail?: string | null;
  createdAt: string;
};

type BackendWorkItem = WorkItem;

type MediaAsset = {
  id: string;
  projectId: string;
  documentId?: string | null;
  url: string;
  mimeType?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
};

export async function apiFetch<T>(path: string, options?: RequestInit, retry = true): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: options?.body instanceof FormData
      ? {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
      : {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers
      }
  });

  if (response.status === 401 && retry) {
    const refreshed = await refreshSession().catch(() => null);
    if (refreshed) return apiFetch<T>(path, options, false);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `API error ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function apiFetchBlob(path: string, options?: RequestInit, retry = true): Promise<Blob> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers
    }
  });

  if (response.status === 401 && retry) {
    const refreshed = await refreshSession().catch(() => null);
    if (refreshed) return apiFetchBlob(path, options, false);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `API error ${response.status}`);
  }

  return response.blob();
}

export function mapProject(project: BackendProject): Project {
  return {
    id: project.id,
    code: project.code,
    name: project.name,
    client: project.client ?? "Internal Team",
    externalCompanyId: project.externalCompanyId ?? null,
    externalDepartmentId: project.externalDepartmentId ?? null,
    progress: 0,
    openComments: 0,
    documents: project._count?.documents ?? 0,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

export function mapDocument(document: BackendDocument): ProjectDocument {
  const fileType = inferFileType(document.sourceFileName);
  const title = normalizeVietnameseText(document.title);
  const importOwner = document.createdBy?.trim() || document.createdByEmail?.trim();

  return {
    id: document.id,
    title,
    type: document.type,
    owner: importOwner || (document.sourceType === "imported" ? "Người import tài liệu" : "Người tạo tài liệu"),
    status: mapDocumentStatus(document.status),
    version: document.currentVersion,
    createdAt: document.createdAt,
    updatedAt: new Date(document.updatedAt).toLocaleDateString("vi-VN"),
    projectId: document.projectId,
    externalCompanyId: document.externalCompanyId ?? null,
    externalDepartmentId: document.externalDepartmentId ?? null,
    fileType,
    size: document.sourceFileName ? "Imported" : "Manual",
    progress: document.status === "DRAFT" ? 25 : 100,
    reqCount: countRequirements(document.htmlContent),
    openCommentsCount: document._count?.comments ?? 0,
    contentHtml: document.htmlContent
  };
}

function normalizeVietnameseText(str: string): string {
  if (!str) return "";

  let result = recoverUtf8Mojibake(str).normalize("NFC");

  result = result
    .replace(/Mò̀\s*Ì\s*rò̀i£ì\s*ng/gi, "Mô hình hệ thống")
    .replace(/tỉ̀\s*nh\s*nà̀\s*ng/gi, "tính năng")
    .replace(/quả̀\s*n\s*lý̀/gi, "quản lý")
    .replace(/tà̀\s*m/gi, "tâm")
    .replace(/Ä̀\s*aì\s*o/gi, "đào")
    .replace(/tài£o/gi, "tạo")
    .replace(/ò̀/g, "ô")
    .replace(/à̀/g, "à")
    .replace(/ỉ̀/g, "ỉ")
    .replace(/ý̀/g, "ý");

  result = result
    .replace(
      /([àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ])[\u0300-\u036F]+/g,
      "$1"
    )
    .replace(/[\u0300-\u036F]/g, "");

  return result.normalize("NFC");
}

function recoverUtf8Mojibake(value: string): string {
  if (!looksLikeUtf8Mojibake(value)) return value;

  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return scoreUtf8Mojibake(decoded) < scoreUtf8Mojibake(value) ? decoded : value;
  } catch {
    return value;
  }
}

function looksLikeUtf8Mojibake(value: string): boolean {
  return /[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàâ€šƒ„…†‡ˆ‰Š‹ŒŽ]/.test(value)
    || /[\u0080-\u009F]/.test(value);
}

function scoreUtf8Mojibake(value: string): number {
  return value.match(/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàâ€šƒ„…†‡ˆ‰Š‹ŒŽ]|[\u0080-\u009F]|�/g)?.length ?? 0;
}

export function mapComment(comment: BackendComment): CommentThread {
  return {
    id: comment.id,
    documentId: comment.documentId,
    parentId: comment.parentId ?? undefined,
    blockId: comment.blockId,
    author: comment.createdBy || "Thành viên",
    authorEmail: comment.createdByEmail ?? undefined,
    authorRole: "Reviewer",
    text: comment.content,
    selectedText: comment.selectedText ?? undefined,
    status: comment.status === "RESOLVED" ? "resolved" : "open",
    createdAt: new Date(comment.createdAt).toLocaleString("vi-VN")
  };
}

export async function fetchProjects() {
  const projects = await apiFetch<BackendProject[]>("/projects");
  return projects.map(mapProject);
}

export async function createProject(payload: { code?: string; name: string; client?: string }) {
  const project = await apiFetch<BackendProject>("/projects", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return mapProject(project);
}

export async function updateProject(
  projectId: string,
  payload: Partial<{ code: string; name: string; client: string; description: string }>
) {
  const project = await apiFetch<BackendProject>(`/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  return mapProject(project);
}

export async function deleteProject(projectId: string) {
  return apiFetch<{ ok: boolean }>(`/projects/${projectId}`, {
    method: "DELETE"
  });
}

export async function fetchDocumentsByProject(projectId: string) {
  const documents = await apiFetch<BackendDocument[]>(`/documents/project/${projectId}`);
  return documents.map(mapDocument);
}

export async function createDocument(payload: {
  projectId: string;
  title: string;
  type: string;
  htmlContent: string;
}) {
  const document = await apiFetch<BackendDocument>("/documents", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return mapDocument(document);
}

export async function updateDocument(
  documentId: string,
  payload: Partial<{
    title: string;
    type: string;
    status: DocumentStatus;
    currentVersion: string;
    htmlContent: string;
    changeNote: string;
  }>
) {
  const document = await apiFetch<BackendDocument>(`/documents/${documentId}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...payload,
      status: payload.status ? toBackendDocumentStatus(payload.status) : undefined
    })
  });
  return mapDocument(document);
}

export async function deleteDocument(documentId: string) {
  return apiFetch<{ ok: boolean }>(`/documents/${documentId}`, {
    method: "DELETE"
  });
}

export async function fetchDocumentVersions(documentId: string) {
  return apiFetch<DocumentVersion[]>(`/documents/${documentId}/versions`);
}

export async function restoreDocumentVersion(documentId: string, versionId: string) {
  const document = await apiFetch<BackendDocument>(`/documents/${documentId}/versions/${versionId}/restore`, {
    method: "POST"
  });
  return mapDocument(document);
}

export async function importDocument(file: File, projectId: string, documentId?: string) {
  const body = new FormData();
  body.append("file", file);
  body.append("projectId", projectId);
  if (documentId) body.append("documentId", documentId);

  const document = await apiFetch<BackendDocument>("/imports/documents", {
    method: "POST",
    body
  });

  return mapDocument(document);
}

export async function fetchComments(documentId: string) {
  const comments = await apiFetch<BackendComment[]>(`/comments/document/${documentId}`);
  return comments.map(mapComment);
}

export async function createComment(payload: {
  documentId: string;
  parentId?: string;
  blockId: string;
  selectedText?: string;
  content: string;
}) {
  const comment = await apiFetch<BackendComment>("/comments", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return mapComment(comment);
}

export async function deleteComment(commentId: string) {
  return apiFetch<{ ok: boolean }>(`/comments/${commentId}`, {
    method: "DELETE"
  });
}

export async function updateComment(commentId: string, payload: Partial<{ content: string; selectedText: string; blockId: string }>) {
  const comment = await apiFetch<BackendComment>(`/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  return mapComment(comment);
}

export async function resolveComment(commentId: string) {
  const comment = await apiFetch<BackendComment>(`/comments/${commentId}/resolve`, {
    method: "PATCH"
  });
  return mapComment(comment);
}

export async function fetchProjectWorkItems(projectId: string) {
  return apiFetch<BackendWorkItem[]>(`/work-items/project/${projectId}`);
}

export async function fetchProjectMembers(projectId: string) {
  return apiFetch<ProjectMemberOption[]>(`/projects/${projectId}/members`);
}

export async function fetchWorkboardColumns(projectId: string) {
  return apiFetch<WorkboardColumn[]>(`/projects/${projectId}/workboard-columns`);
}

export async function createWorkboardColumn(projectId: string, payload: {
  name: string;
  key?: string;
  color?: string;
  type?: WorkboardColumnType;
  position?: number;
  isDefault?: boolean;
  isDone?: boolean;
}) {
  return apiFetch<WorkboardColumn>(`/projects/${projectId}/workboard-columns`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateWorkboardColumn(projectId: string, columnId: string, payload: Partial<{
  name: string;
  color: string;
  type: WorkboardColumnType;
  position: number;
  isDefault: boolean;
  isDone: boolean;
}>) {
  return apiFetch<WorkboardColumn>(`/projects/${projectId}/workboard-columns/${columnId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteWorkboardColumn(projectId: string, columnId: string) {
  return apiFetch<{ ok: boolean }>(`/projects/${projectId}/workboard-columns/${columnId}`, {
    method: "DELETE"
  });
}

export async function reorderWorkboardColumns(projectId: string, columnIds: string[]) {
  return apiFetch<WorkboardColumn[]>(`/projects/${projectId}/workboard-columns/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ columnIds })
  });
}

export async function createWorkItem(payload: {
  projectId: string;
  documentId?: string;
  sourceCommentId?: string;
  type?: WorkItemType;
  status?: WorkItemStatus;
  columnId?: string;
  priority?: WorkItemPriority;
  title: string;
  description?: string;
  attachments?: Array<{ url: string; name?: string; mimeType?: string }>;
  assigneeId?: string;
  assigneeIds?: string[];
  assigneeName?: string;
  dueDate?: string;
  checklistItems?: Array<{ title: string; done?: boolean }>;
  labelNames?: string[];
  dependencyIds?: string[];
}) {
  return apiFetch<BackendWorkItem>("/work-items", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createWorkItemFromComment(commentId: string, payload: {
  type?: WorkItemType;
  status?: WorkItemStatus;
  columnId?: string;
  priority?: WorkItemPriority;
  title: string;
  description?: string;
  attachments?: Array<{ url: string; name?: string; mimeType?: string }>;
  assigneeId?: string;
  assigneeIds?: string[];
  assigneeName?: string;
  dueDate?: string;
  checklistItems?: Array<{ title: string; done?: boolean }>;
  labelNames?: string[];
  dependencyIds?: string[];
}) {
  return apiFetch<BackendWorkItem>(`/work-items/from-comment/${commentId}`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateWorkItem(workItemId: string, payload: Partial<{
  documentId: string | null;
  sourceCommentId: string | null;
  type: WorkItemType;
  status: WorkItemStatus;
  columnId: string | null;
  priority: WorkItemPriority;
  title: string;
  description: string | null;
  attachments: Array<{ url: string; name?: string; mimeType?: string }> | null;
  assigneeId: string | null;
  assigneeIds: string[] | null;
  assigneeName: string | null;
  dueDate: string | null;
  checklistItems: Array<{ title: string; done?: boolean }> | null;
  labelNames: string[] | null;
  dependencyIds: string[] | null;
}>) {
  return apiFetch<BackendWorkItem>(`/work-items/${workItemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteWorkItem(workItemId: string) {
  return apiFetch<{ ok: boolean }>(`/work-items/${workItemId}`, {
    method: "DELETE"
  });
}

export async function uploadWorkItemAttachment(workItemId: string, file: File) {
  const body = new FormData();
  body.append("file", file);
  return apiFetch<BackendWorkItem>(`/work-items/${workItemId}/attachments`, {
    method: "POST",
    body
  });
}

export async function uploadMediaAsset(payload: { projectId: string; documentId?: string; file: File }) {
  const body = new FormData();
  body.append("file", payload.file);
  body.append("projectId", payload.projectId);
  if (payload.documentId) body.append("documentId", payload.documentId);
  return apiFetch<MediaAsset>("/media/upload", {
    method: "POST",
    body
  });
}

export async function fetchWorkItemComments(workItemId: string) {
  return apiFetch<WorkItemComment[]>(`/work-items/${workItemId}/comments`);
}

export async function fetchWorkItemActivity(workItemId: string) {
  return apiFetch<WorkItemActivity[]>(`/work-items/${workItemId}/activity`);
}

export async function createWorkItemComment(workItemId: string, payload: { content: string; parentId?: string }) {
  return apiFetch<WorkItemComment>(`/work-items/${workItemId}/comments`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateWorkItemComment(workItemId: string, commentId: string, payload: { content: string }) {
  return apiFetch<WorkItemComment>(`/work-items/${workItemId}/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteWorkItemComment(workItemId: string, commentId: string) {
  return apiFetch<{ ok: boolean }>(`/work-items/${workItemId}/comments/${commentId}`, {
    method: "DELETE"
  });
}

export async function fetchProjectDashboard(projectId: string) {
  return apiFetch<ProjectDashboard>(`/collaboration/projects/${projectId}/dashboard`);
}

export async function fetchRoleDashboard() {
  return apiFetch<RoleDashboard>("/collaboration/dashboard");
}

export async function searchProject(projectId: string, query: string) {
  return apiFetch<SearchResult>(`/collaboration/projects/${projectId}/search?q=${encodeURIComponent(query)}`);
}

export async function fetchProjectActivity(projectId: string) {
  return apiFetch<ActivityLog[]>(`/collaboration/projects/${projectId}/activity`);
}

export async function fetchDocumentDiff(documentId: string) {
  return apiFetch<VersionDiff>(`/collaboration/documents/${documentId}/diff`);
}

export async function fetchDocumentTags(documentId: string) {
  return apiFetch<{ saved: RequirementTag[]; inferred: RequirementTag[] }>(`/collaboration/documents/${documentId}/tags`);
}

export async function createRequirementTag(documentId: string, payload: {
  code: string;
  kind: string;
  label: string;
  selectedText?: string;
  selector?: string;
}) {
  return apiFetch<RequirementTag>(`/collaboration/documents/${documentId}/tags`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function deleteRequirementTag(tagId: string) {
  return apiFetch<{ ok: boolean }>(`/collaboration/tags/${tagId}`, { method: "DELETE" });
}

export async function fetchTraceLinks(projectId: string) {
  return apiFetch<TraceLink[]>(`/collaboration/projects/${projectId}/traces`);
}

export async function createTraceLink(projectId: string, payload: {
  sourceDocumentId?: string;
  targetDocumentId?: string;
  sourceCode: string;
  sourceLabel: string;
  targetCode: string;
  targetLabel: string;
  relation?: string;
}) {
  return apiFetch<TraceLink>(`/collaboration/projects/${projectId}/traces`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function deleteTraceLink(traceId: string) {
  return apiFetch<{ ok: boolean }>(`/collaboration/traces/${traceId}`, { method: "DELETE" });
}

export async function fetchNotifications() {
  return apiFetch<NotificationItem[]>("/collaboration/notifications");
}

export async function markNotificationRead(notificationId: string) {
  return apiFetch<NotificationItem>(`/collaboration/notifications/${notificationId}/read`, { method: "PATCH" });
}

export async function fetchDocumentTemplates() {
  return apiFetch<DocumentTemplate[]>("/collaboration/templates");
}

export async function createDocumentFromTemplate(templateId: string, payload: { projectId: string; title?: string; type?: string }) {
  const document = await apiFetch<BackendDocument>(`/collaboration/templates/${templateId}/documents`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return mapDocument(document);
}

export async function downloadExport(documentId: string, type: "pdf" | "docx") {
  const { blob, filename } = await apiFetchDownload(`/exports/documents/${documentId}/${type}`);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || `document-${documentId}.${type}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function apiFetchDownload(path: string, retry = true): Promise<{ blob: Blob; filename?: string }> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (response.status === 401 && retry) {
    const refreshed = await refreshSession().catch(() => null);
    if (refreshed) return apiFetchDownload(path, false);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `API error ${response.status}`);
  }

  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(response.headers.get("Content-Disposition"))
  };
}

function filenameFromDisposition(disposition: string | null) {
  if (!disposition) return undefined;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const asciiMatch = disposition.match(/filename="?([^"]+)"?/i);
  return asciiMatch?.[1];
}

function mapDocumentStatus(status: BackendDocument["status"]): DocumentStatus {
  return status === "DRAFT" || status === "IN_REVIEW" || status === "CHANGES_REQUESTED" ? "Draft" : "Triển khai";
}

function toBackendDocumentStatus(status: DocumentStatus): BackendDocument["status"] {
  return status === "Triển khai" ? "DEPLOYED" : "DRAFT";
}

function inferFileType(fileName?: string | null): ProjectDocument["fileType"] {
  if (!fileName) return "md";
  if (fileName.toLowerCase().endsWith(".pdf")) return "pdf";
  if (fileName.toLowerCase().endsWith(".doc") || fileName.toLowerCase().endsWith(".docx")) return "docx";
  return "md";
}

function countRequirements(html: string) {
  const matches = html.match(/REQ-\d+/g);
  return new Set(matches ?? []).size || 1;
}
