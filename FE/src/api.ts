import type { CommentThread, DocumentStatus, Project, ProjectDocument } from "./types";
import { getAccessToken, refreshSession } from "./authApi";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

type BackendProject = {
  id: string;
  code: string;
  name: string;
  client: string | null;
  description?: string | null;
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
  status: "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "SIGNED_OFF" | "ARCHIVED";
  currentVersion: string;
  htmlContent: string;
  sourceFileName?: string | null;
  sourceType?: string;
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
  createdAt: string;
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

export function mapProject(project: BackendProject): Project {
  return {
    id: project.id,
    code: project.code,
    name: project.name,
    client: project.client ?? "Internal Team",
    progress: 0,
    openComments: 0,
    documents: project._count?.documents ?? 0
  };
}

export function mapDocument(document: BackendDocument): ProjectDocument {
  const fileType = inferFileType(document.sourceFileName);

  return {
    id: document.id,
    title: document.title,
    type: document.type,
    owner: document.sourceType === "imported" ? "Imported File" : "BA Lead",
    status: mapDocumentStatus(document.status),
    version: document.currentVersion,
    updatedAt: new Date(document.updatedAt).toLocaleDateString("vi-VN"),
    projectId: document.projectId,
    fileType,
    size: document.sourceFileName ? "Imported" : "Manual",
    progress: document.status === "APPROVED" || document.status === "SIGNED_OFF" ? 100 : 25,
    reqCount: countRequirements(document.htmlContent),
    openCommentsCount: document._count?.comments ?? 0,
    contentHtml: document.htmlContent
  };
}

export function mapComment(comment: BackendComment): CommentThread {
  return {
    id: comment.id,
    documentId: comment.documentId,
    parentId: comment.parentId ?? undefined,
    blockId: comment.blockId,
    author: comment.createdBy || "BA User",
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

export async function createProject(payload: { code: string; name: string; client?: string }) {
  const project = await apiFetch<BackendProject>("/projects", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return mapProject(project);
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

export async function importDocument(file: File, projectId: string) {
  const body = new FormData();
  body.append("file", file);
  body.append("projectId", projectId);

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
  createdBy?: string;
}) {
  const comment = await apiFetch<BackendComment>("/comments", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return mapComment(comment);
}

export function getExportUrl(documentId: string, type: "pdf" | "docx") {
  return `${API_BASE}/exports/documents/${documentId}/${type}`;
}

function mapDocumentStatus(status: BackendDocument["status"]): DocumentStatus {
  if (status === "APPROVED" || status === "SIGNED_OFF") return "Approved";
  if (status === "IN_REVIEW" || status === "CHANGES_REQUESTED") return "In Review";
  return "Draft";
}

function inferFileType(fileName?: string | null): ProjectDocument["fileType"] {
  if (!fileName) return "md";
  if (fileName.toLowerCase().endsWith(".pdf")) return "pdf";
  if (fileName.toLowerCase().endsWith(".docx")) return "docx";
  return "md";
}

function countRequirements(html: string) {
  const matches = html.match(/REQ-\d+/g);
  return new Set(matches ?? []).size || 1;
}
