export type DocumentStatus = "Draft" | "Triển khai";
export type DocumentSourceType = "manual" | "template" | "imported";
export type ProjectRole = "VIEWER" | "REVIEWER" | "EDITOR" | "MANAGER";

export type DocumentEditingSession = {
  userId: string;
  userName: string;
  userEmail: string;
  startedAt: string;
  heartbeatAt: string;
  expiresAt: string;
  isCurrentUser: boolean;
};

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
  createdAt?: string;
  updatedAt?: string;
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
  ownerId?: string | null;
  status: DocumentStatus;
  sourceType?: DocumentSourceType;
  effectiveRole?: ProjectRole | null;
  editingSession?: DocumentEditingSession | null;
  version: string;
  updatedAt: string;
  updatedAtIso?: string;
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

export type WorkItemType = "TASK" | "BUG" | "REVIEW" | "CHANGE_REQUEST" | "QUESTION";
export type WorkItemStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "BLOCKED" | "DONE";
export type WorkItemPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type WorkboardColumnType =
  | "INTAKE"
  | "READY"
  | "OPEN"
  | "IN_PROGRESS"
  | "REVIEW"
  | "QA"
  | "WAITING"
  | "BLOCKED"
  | "REWORK"
  | "APPROVED"
  | "DONE"
  | "ARCHIVED";

export type WorkboardColumn = {
  id: string;
  projectId: string;
  key: string;
  name: string;
  color: string;
  type: WorkboardColumnType;
  position: number;
  isDefault: boolean;
  isDone: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectMemberOption = {
  id: string;
  name: string;
  email: string;
  role?: string;
  projectRole?: string;
  projectRoles?: string[];
  documentIds?: string[];
  documentRoles?: string[];
  source?: "PROJECT" | "DOCUMENT";
};

export type WorkItem = {
  id: string;
  projectId: string;
  documentId?: string | null;
  sourceCommentId?: string | null;
  type: WorkItemType;
  status: WorkItemStatus;
  columnId?: string | null;
  column?: WorkboardColumn | null;
  priority: WorkItemPriority;
  title: string;
  description?: string | null;
  attachments?: Array<{
    url: string;
    name?: string | null;
    mimeType?: string | null;
  }> | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  assignees?: Array<{
    id: string;
    userId: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  checklistItems?: Array<{
    id: string;
    title: string;
    done: boolean;
    position: number;
  }>;
  labels?: Array<{
    id: string;
    label: {
      id: string;
      name: string;
      color?: string | null;
    };
  }>;
  blockingLinks?: Array<{
    id: string;
    blockerItemId: string;
    blockerItem: {
      id: string;
      title: string;
      status: WorkItemStatus;
    };
  }>;
  dueDate?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  createdAt: string;
  updatedAt: string;
  document?: {
    id: string;
    title: string;
    type: string;
    currentVersion: string;
  } | null;
  sourceComment?: {
    id: string;
    blockId: string;
    selectedText?: string | null;
    content: string;
    status: "OPEN" | "RESOLVED";
  } | null;
  assignee?: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export type WorkItemComment = {
  id: string;
  workItemId: string;
  parentId?: string | null;
  content: string;
  createdByName?: string | null;
  createdByEmail?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  replies?: WorkItemComment[];
};

export type WorkItemActivity = {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actor?: {
    name?: string | null;
    email?: string | null;
  } | null;
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
  workItems: Array<{
    id: string;
    projectId: string;
    documentId?: string | null;
    type: WorkItemType;
    status: WorkItemStatus;
    priority: WorkItemPriority;
    title: string;
    description?: string | null;
    assigneeName?: string | null;
    updatedAt: string;
    snippet: string;
    document?: { title: string } | null;
  }>;
};

export type VersionDiff = {
  current: { version: string; createdAt: string };
  previous: { version: string; createdAt: string } | null;
  summary: { added: number; removed: number; unchanged: number };
  lines: Array<{ type: "same" | "added" | "removed"; text: string }>;
};

export type DocumentVersion = {
  id: string;
  documentId: string;
  version: string;
  changeNote?: string | null;
  createdBy?: string | null;
  createdAt: string;
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

export type DocumentCommentContext = {
  id: string;
  parentId?: string | null;
  documentId: string;
  projectId: string;
  blockId: string;
  selectedText?: string | null;
  document?: { id: string; projectId: string; title: string };
};

export type WorkItemCommentContext = {
  id: string;
  parentId?: string | null;
  workItemId: string;
  projectId: string;
  documentId?: string | null;
  workItem?: { id: string; projectId: string; documentId?: string | null; title: string };
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
