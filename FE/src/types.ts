export type DocumentStatus = "Draft" | "In Review" | "Approved";

export type Project = {
  id: string;
  code: string;
  name: string;
  client: string;
  progress: number;
  openComments: number;
  documents: number;
};

export type ReqBlockData = {
  id: string; // e.g. "REQ-001"
  text: string;
};

export type ProjectDocument = {
  id: string;
  title: string;
  type: string;
  owner: string;
  status: DocumentStatus;
  version: string;
  updatedAt: string;
  projectId?: string;
  fileType?: "docx" | "pdf" | "md";
  size?: string;
  progress?: number;
  reqCount?: number;
  openCommentsCount?: number;
  contentHtml?: string; // Custom HTML/Markdown text content for reading
  blocks?: ReqBlockData[]; // Interactive Requirement blocks
};

export type CommentThread = {
  id: string;
  parentId?: string;
  blockId: string;
  author: string;
  authorRole?: string;
  text: string;
  selectedText?: string;
  status: "open" | "resolved";
  createdAt?: string;
  documentId?: string;
  replies?: CommentThread[];
};

export type ToastMessage = {
  id: string;
  type: "success" | "info" | "warning" | "error";
  title: string;
  message: string;
};

export type UserRole = "ADMIN" | "MANAGER" | "EMPLOYEE";
export type UserStatus = "ACTIVE" | "DISABLED" | "LOCKED";
export type ProjectRole = "VIEWER" | "REVIEWER" | "EDITOR" | "MANAGER";

export type User = {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  status?: UserStatus;
  department?: string;
  createdAt: string;
};

