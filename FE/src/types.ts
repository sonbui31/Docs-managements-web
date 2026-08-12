export type DocumentStatus = "Draft" | "Triển khai";

export type Project = {
  id: string;
  code: string;
  name: string;
  client: string;
  externalCompanyId?: string | null;
  externalDepartmentId?: string | null;
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
  createdAt?: string;
  projectId?: string;
  externalCompanyId?: string | null;
  externalDepartmentId?: string | null;
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
  authorEmail?: string;
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

export type ProjectDashboard = {
  documents: number;
  openComments: number;
  resolvedComments: number;
  tags: number;
  traces: number;
  versions: number;
  recentDocuments: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    createdAt?: string;
    updatedAt: string;
    _count?: { comments?: number; versions?: number };
  }>;
  recentActivity: ActivityLog[];
};

export type RoleDashboard = {
  role: UserRole;
  scopeLabel: string;
  totals: {
    projects: number;
    documents: number;
    draftDocuments: number;
    deployedDocuments: number;
    openComments: number;
    openCommentThreads: number;
    resolvedComments: number;
    myOpenComments: number;
    unreadNotifications: number;
    tags: number;
    traces: number;
    updatedToday: number;
    documentsCreatedThisMonth?: number;
    documentsUpdatedThisMonth?: number;
    importJobs: number;
    projectsWithOpenComments: number;
    versions: number;
  };
  projectBreakdown: Array<{
    id: string;
    code: string;
    name: string;
    client?: string | null;
    documents: number;
    openComments: number;
    tags: number;
    traces: number;
    members: number;
    updatedAt: string;
  }>;
  recentDocuments: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    currentVersion: string;
    createdAt?: string;
    updatedAt: string;
    projectId: string;
    projectCode: string;
    projectName: string;
    _count?: { comments?: number; versions?: number };
  }>;
  notifications: NotificationItem[];
  recentActivity: ActivityLog[];
  latestImportJob?: {
    id: string;
    sourceFileName: string;
    completedAt?: string | null;
    createdAt: string;
  } | null;
};

export type SearchResult = {
  documents: Array<{ id: string; title: string; type: string; currentVersion: string; updatedAt: string; snippet: string }>;
  comments: Array<{ id: string; documentId: string; blockId: string; content: string; selectedText?: string | null; document?: { title: string } }>;
  tags: RequirementTag[];
};

export type VersionDiff = {
  current: { version: string; createdAt: string };
  previous: { version: string; createdAt: string } | null;
  summary: { added: number; removed: number; unchanged: number };
  lines: Array<{ type: "same" | "added" | "removed"; text: string }>;
};

export type RequirementTag = {
  id: string;
  documentId: string;
  projectId: string;
  code: string;
  kind: string;
  label: string;
  selectedText?: string | null;
  selector?: string | null;
  inferred?: boolean;
};

export type TraceLink = {
  id: string;
  projectId: string;
  sourceDocumentId?: string | null;
  targetDocumentId?: string | null;
  sourceCode: string;
  sourceLabel: string;
  targetCode: string;
  targetLabel: string;
  relation: string;
  createdAt: string;
  sourceDocument?: { title: string } | null;
  targetDocument?: { title: string } | null;
};

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export type ActivityLog = {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  actor?: {
    name?: string | null;
    email?: string | null;
  } | null;
  createdAt: string;
};

export type DocumentTemplate = {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  htmlContent: string;
  isSystem: boolean;
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
  externalRole?: string | null;
  externalCompanyId?: string | null;
  externalDepartmentId?: string | null;
  status?: UserStatus;
  department?: string;
  createdAt: string;
};
