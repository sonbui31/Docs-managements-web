import {
  Activity as ActivityIcon,
  AlertTriangle,
  BarChart2,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Eye,
  File,
  FileCheck2,
  FileCode,
  FileDiff,
  FilePlus,
  FileText,
  FolderKanban,
  FolderPlus,
  GitBranch,
  Layers,
  LayoutDashboard,
  ListTree,
  LogOut,
  Maximize2,
  MessageSquarePlus,
  MessageSquareText,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  Search,
  Send,
  Share2,
  Sparkles,
  Tags,
  Trash2,
  UploadCloud,
  UserCheck,
  Users,
  X
} from "lucide-react";
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  createComment,
  createDocument,
  createDocumentFromTemplate,
  createProject,
  createRequirementTag,
  createTraceLink,
  deleteComment,
  deleteDocument,
  deleteProject,
  deleteRequirementTag,
  deleteTraceLink,
  downloadExport,
  fetchComments,
  fetchDocumentDiff,
  fetchDocumentTags,
  fetchDocumentTemplates,
  fetchDocumentsByProject,
  fetchNotifications,
  fetchProjectActivity,
  fetchProjectDashboard,
  fetchProjects,
  fetchRoleDashboard,
  fetchTraceLinks,
  importDocument,
  markNotificationRead,
  resolveComment,
  searchProject,
  updateComment,
  updateDocument,
  updateProject
} from "./api";
import { AuthPage } from "./AuthPage";
import { clearAuthSession, fetchCurrentUser, getAccessToken, getStoredUser, logout } from "./authApi";
import { initialComments, documents as initialDocuments, projects as initialProjects } from "./data";
import type {
  ActivityLog,
  CommentThread,
  DocumentStatus,
  DocumentTemplate,
  NotificationItem,
  Project,
  ProjectDashboard,
  ProjectDocument,
  RequirementTag,
  RoleDashboard,
  SearchResult,
  ToastMessage,
  TraceLink,
  User,
  VersionDiff
} from "./types";

const AdminPanel = lazy(() => import("./AdminPanel").then((module) => ({ default: module.AdminPanel })));
const ShareAccessModal = lazy(() => import("./ShareAccessModal").then((module) => ({ default: module.ShareAccessModal })));

type MermaidRenderer = typeof import("mermaid").default;

const mermaidConfig = {
  startOnLoad: false,
  theme: "base",
  securityLevel: "loose",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  themeVariables: {
    primaryColor: "#ffffff",
    primaryTextColor: "#0f172a",
    primaryBorderColor: "#111827",
    lineColor: "#111827",
    secondaryColor: "#f8fafc",
    tertiaryColor: "#f1f5f9",
    nodeBorder: "#111827",
    clusterBkg: "#ffffff",
    clusterBorder: "#94a3b8",
    defaultLinkColor: "#111827",
    titleColor: "#0f172a",
    edgeLabelBackground: "transparent",
    nodeTextColor: "#0f172a",
    fontSize: "18px"
  },
  flowchart: {
    htmlLabels: true,
    nodeSpacing: 54,
    rankSpacing: 64,
    padding: 28,
    curve: "linear"
  },
  state: {
    nodeSpacing: 54,
    rankSpacing: 64,
    padding: 28
  }
} as const;

let mermaidRendererPromise: Promise<MermaidRenderer> | null = null;

function loadMermaidRenderer() {
  if (!mermaidRendererPromise) {
    mermaidRendererPromise = import("mermaid").then((module) => {
      module.default.initialize(mermaidConfig);
      return module.default;
    });
  }
  return mermaidRendererPromise;
}

export function normalizeVietnameseText(str: string): string {
  if (!str) return "";

  // 1. Standard NFC normalization
  let result = recoverUtf8Mojibake(str).normalize("NFC");

  // 2. Fix TCVN3 / VNI corrupted title patterns & legacy font artifacts
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

  // 3. Clean up orphan/duplicate combining diacritic marks (\u0300-\u036F)
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

// Standard formatted reading document template
const DEFAULT_DOC_CONTENT = `
<h3>1. Mục tiêu Nghiệp vụ (Business Objective)</h3>
<div class="req-block" data-req="REQ-001">
  <div class="req-block-header">
    <span class="req-tag">REQ-001</span>
  </div>
  <p>Hệ thống quản lý tài liệu CRM cần cung cấp một nguồn dữ liệu duy nhất (Single Source of Truth) cho các thành viên trong team xem và tham chiếu yêu cầu đã phê duyệt.</p>
</div>

<h3>2. Yêu cầu Chức năng (Functional Requirements)</h3>
<div class="req-block" data-req="REQ-002">
  <div class="req-block-header">
    <span class="req-tag">REQ-002</span>
  </div>
  <p>Mọi người trong team có thể xem các thư mục theo từng giai đoạn dự án, dễ dàng đọc nội dung từ tệp import đã chuẩn hóa sang giao diện HTML rõ ràng và tiện theo dõi.</p>
</div>

<h3>3. Ma trận Bảng Yêu cầu & Trạng thái Kiểm duyệt (Requirements Matrix)</h3>
<div class="req-block" data-req="REQ-004">
  <div class="req-block-header">
    <span class="req-tag">REQ-004</span>
  </div>
  <p>Bảng ma trận phân công nghiệp vụ và trạng thái phê duyệt tính năng:</p>
  <table class="doc-table">
    <thead>
      <tr>
        <th>Mã Yêu Cầu</th>
        <th>Tên Chức Năng</th>
        <th>Mô Tả Chi Tiết</th>
        <th>Độ Ưu Tiên</th>
        <th>Trạng Thái</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>REQ-001</code></td>
        <td>Single Source of Truth</td>
        <td>Cung cấp dữ liệu chuẩn cho cả team tham chiếu.</td>
        <td><span class="badge high">Cao</span></td>
        <td><span class="status-pill deployed"><span class="status-dot"></span>Triển khai</span></td>
      </tr>
      <tr>
        <td><code>REQ-002</code></td>
        <td>Import & Xem File</td>
        <td>Đọc và hiển thị nội dung tệp Markdown/Word/PDF.</td>
        <td><span class="badge high">Cao</span></td>
        <td><span class="status-pill deployed"><span class="status-dot"></span>Triển khai</span></td>
      </tr>
      <tr>
        <td><code>REQ-003</code></td>
        <td>Bảng Ma Trận Động</td>
        <td>Hiển thị sắc nét các dòng, cột và dữ liệu bảng kiểm thử.</td>
        <td><span class="badge high">Cao</span></td>
        <td><span class="status-pill draft"><span class="status-dot"></span>Draft</span></td>
      </tr>
      <tr>
        <td><code>REQ-004</code></td>
        <td>Comment & Review</td>
        <td>Gắn nhận xét trực tiếp vào từng block yêu cầu.</td>
        <td><span class="badge medium">Trung bình</span></td>
        <td><span class="status-pill draft"><span class="status-dot"></span>Draft</span></td>
      </tr>
    </tbody>
  </table>
</div>

<h3>4. Sơ đồ Quy trình Luồng Nghiệp vụ (Mermaid System Diagram)</h3>
<div class="req-block" data-req="REQ-005">
  <div class="req-block-header">
    <span class="req-tag">REQ-005</span>
  </div>
  <p>Sơ đồ kiến trúc xử lý tệp và hiển thị sơ đồ Mermaid đồ họa trực quan:</p>
  <div class="mermaid">
    graph TD
      A[📥 Import File Tài Liệu] --> B[⚙️ Parser Đọc Văn Bản HTML/Markdown]
      B --> C{Loại dữ liệu}
      C -->|Bảng Ma Trận| D[📊 Render Bảng HTML Sắc Nét]
      C -->|Sơ Đồ Mermaid| E[🎨 Visual Mermaid Diagram SVG]
      D --> F[💬 Team Đọc, Gắn REQ Tag & Comment Review]
      E --> F
      F --> G[✅ Lưu trữ & Quản lý tài liệu]

      style A fill:#e0e7ff,stroke:#4f46e5,stroke-width:2px;
      style D fill:#fef3c7,stroke:#d97706,stroke-width:2px;
      style E fill:#d1fae5,stroke:#059669,stroke-width:2px;
      style G fill:#dbeafe,stroke:#0284c7,stroke-width:2px;
  </div>
</div>
`;

const EMPTY_DOCUMENT: ProjectDocument = {
  id: "empty-document",
  title: "Chưa có tài liệu",
  type: "DOC",
  owner: "BA Team",
  status: "Draft",
  version: "v0.1",
  updatedAt: "Hôm nay",
  projectId: "",
  fileType: "md",
  size: "0 KB",
  progress: 0,
  reqCount: 0,
  openCommentsCount: 0,
  contentHtml: `<h3>Chưa có tài liệu trong dự án</h3><p>Hãy tạo tài liệu mới hoặc import file Word, Markdown, PDF để xem nội dung HTML tại đây.</p>`
};

const PROJECT_CUSTOMER_OPTIONS = [
  "Internal Team",
  "Ngân hàng",
  "Tài chính tiêu dùng",
  "Bảo hiểm",
  "Chứng khoán",
  "Bán lẻ",
  "Thương mại điện tử",
  "Giáo dục",
  "Y tế",
  "Bất động sản",
  "Logistics",
  "Sản xuất",
  "Viễn thông",
  "Du lịch - Khách sạn",
  "F&B",
  "ERP / Back-office",
  "CRM / Sales",
  "HRM / Nhân sự",
  "Kế toán / Tài chính doanh nghiệp",
  "Quản lý chuỗi cung ứng",
  "SaaS / Công nghệ",
  "Nhà nước / Hành chính công"
];

const BUSINESS_UNIT_OPTIONS = [
  "Vận hành nội bộ",
  "Khối Kinh doanh",
  "Khối Chăm sóc khách hàng",
  "Khối Marketing",
  "Khối Sản phẩm",
  "Khối Công nghệ",
  "Khối Dữ liệu",
  "Khối Tài chính - Kế toán",
  "Khối Nhân sự",
  "Khối Pháp chế - Tuân thủ",
  "Khối Rủi ro",
  "Khối Vận hành",
  "Khối Chuỗi cung ứng",
  "Khối Đào tạo",
  "Khối Trung tâm",
  "Khối Dịch vụ sau bán"
];

const CLIENT_SCOPE_SEPARATOR = " • ";

function buildProjectClientLabel(customer: string, businessUnit: string) {
  const safeCustomer = customer.trim() || "Internal Team";
  const safeBusinessUnit = businessUnit.trim() || "Vận hành nội bộ";
  return `${safeCustomer}${CLIENT_SCOPE_SEPARATOR}${safeBusinessUnit}`;
}

function parseProjectClientLabel(value: string) {
  const [customer, businessUnit] = value.split(CLIENT_SCOPE_SEPARATOR).map((part) => part.trim());
  return {
    customer: customer || value || "Internal Team",
    businessUnit: businessUnit || "Vận hành nội bộ"
  };
}

function generateProjectCode(name: string, existingCodes: string[]) {
  const words = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .match(/[A-Z0-9]+/g) ?? [];
  const base = (words.length > 1 ? words.map((word) => word[0]).join("") : words[0] ?? "PRJ")
    .slice(0, 8)
    .padEnd(3, "X");
  const existing = new Set(existingCodes.map((code) => code.toUpperCase()));
  let candidate = base;
  let suffix = 1;
  while (existing.has(candidate)) {
    candidate = `${base}-${String(suffix).padStart(2, "0")}`;
    suffix += 1;
  }
  return candidate;
}

interface TocItem {
  id: string;
  index: number;
  text: string;
  level: number;
}

function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());

  // State for dynamic projects & documents lists
  const [projectsList, setProjectsList] = useState<Project[]>(initialProjects);

  const [documentsList, setDocumentsList] = useState<ProjectDocument[]>(() =>
    initialDocuments.map((doc) => ({
      ...doc,
      contentHtml: doc.contentHtml || DEFAULT_DOC_CONTENT
    }))
  );
  const [documentCommentCounts, setDocumentCommentCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialDocuments.map((doc) => [doc.id, doc.openCommentsCount ?? 0]))
  );

  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectsList[0]?.id ?? "");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>(documentsList[0]?.id ?? "");
  const [activeTabNav, setActiveTabNav] = useState<"dashboard" | "projects" | "review" | "admin">("dashboard");
  
  // Left Panel Tab Mode ("docs" vs "toc")
  const [leftPanelMode, setLeftPanelMode] = useState<"docs" | "toc">("docs");
  // Interactive Table of Contents (Outline) State
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [activeTocId, setActiveTocId] = useState<string>("");
  const [isTocPopoverOpen, setIsTocPopoverOpen] = useState<boolean>(false);

  // Grouped Actions Dropdown State
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState<boolean>(false);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target as Node)) {
        setIsActionsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [statusFilter, setStatusFilter] = useState<"All" | DocumentStatus>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchShortcutLabel, setSearchShortcutLabel] = useState<string>("Ctrl K");

  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const platform = `${nav.userAgentData?.platform ?? navigator.platform ?? ""} ${navigator.userAgent ?? ""}`.toLowerCase();
    const isApplePlatform = /mac|iphone|ipad|ipod/.test(platform);
    setSearchShortcutLabel(isApplePlatform ? "⌘K" : "Ctrl K");
  }, []);

  // Metric Scope Switcher State ("project" vs "document")
  const [metricScope, setMetricScope] = useState<"project" | "document">("project");
  // Show / Hide top metrics strip (default hidden for clean reading focus)
  const [showMetrics, setShowMetrics] = useState<boolean>(false);

  // Layout View Controls for Maximum Reading Focus
  const [showLibraryPanel, setShowLibraryPanel] = useState<boolean>(true);
  const [showCommentsPanel, setShowCommentsPanel] = useState<boolean>(true);
  const [fontSize, setFontSize] = useState<"sm" | "md" | "lg">("md");
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  function toggleSidebar() {
    setIsSidebarCollapsed((value) => !value);
  }

  // Interactive Block selection
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [selectedCommentTarget, setSelectedCommentTarget] = useState<{
    blockId: string;
    selectedText: string;
  } | null>(null);
  const [selectionPopover, setSelectionPopover] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [selectionHighlightRects, setSelectionHighlightRects] = useState<Array<{
    top: number;
    left: number;
    width: number;
    height: number;
  }>>([]);
  const [isSelectionComposerOpen, setIsSelectionComposerOpen] = useState<boolean>(false);

  // Comments state
  const [commentsList, setCommentsList] = useState<CommentThread[]>(initialComments);
  const [commentFilter, setCommentFilter] = useState<"all" | "open" | "resolved" | "mine">("all");
  const [collabPanelTab, setCollabPanelTab] = useState<"comments" | "diff" | "tags" | "trace" | "activity" | "notifications">("comments");
  const [projectDashboard, setProjectDashboard] = useState<ProjectDashboard | null>(null);
  const [roleDashboard, setRoleDashboard] = useState<RoleDashboard | null>(null);
  const [advancedSearchResults, setAdvancedSearchResults] = useState<SearchResult | null>(null);
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState<boolean>(false);
  const [documentDiff, setDocumentDiff] = useState<VersionDiff | null>(null);
  const [savedTags, setSavedTags] = useState<RequirementTag[]>([]);
  const [inferredTags, setInferredTags] = useState<RequirementTag[]>([]);
  const [traceLinks, setTraceLinks] = useState<TraceLink[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [documentTemplates, setDocumentTemplates] = useState<DocumentTemplate[]>([]);
  const [newTagCode, setNewTagCode] = useState<string>("");
  const [newTagKind, setNewTagKind] = useState<string>("REQ");
  const [newTagLabel, setNewTagLabel] = useState<string>("");
  const [newTraceSource, setNewTraceSource] = useState<string>("");
  const [newTraceTarget, setNewTraceTarget] = useState<string>("");
  const [newCommentText, setNewCommentText] = useState<string>("");
  const [isLoadingBackend, setIsLoadingBackend] = useState<boolean>(true);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);

  // Comment Editing state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>("");
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>("");

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importTargetProjectId, setImportTargetProjectId] = useState<string>(selectedProjectId);
  const [importMode, setImportMode] = useState<"create" | "update">("create");
  const [importTargetDocumentId, setImportTargetDocumentId] = useState<string>(selectedDocumentId);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importStatusText, setImportStatusText] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportType, setExportType] = useState<"pdf" | "docx">("pdf");
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Create Project Modal state
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState<boolean>(false);
  const [newProjCode, setNewProjCode] = useState<string>("");
  const [newProjName, setNewProjName] = useState<string>("");
  const [newProjCustomer, setNewProjCustomer] = useState<string>("Internal Team");
  const [newProjBusinessUnit, setNewProjBusinessUnit] = useState<string>("Vận hành nội bộ");

  // Edit Project Modal state
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjCode, setEditProjCode] = useState<string>("");
  const [editProjName, setEditProjName] = useState<string>("");
  const [editProjCustomer, setEditProjCustomer] = useState<string>("Internal Team");
  const [editProjBusinessUnit, setEditProjBusinessUnit] = useState<string>("Vận hành nội bộ");

  // Create Document Modal state
  const [isCreateDocModalOpen, setIsCreateDocModalOpen] = useState<boolean>(false);
  const [newDocProjectId, setNewDocProjectId] = useState<string>(selectedProjectId);
  const [newDocTitle, setNewDocTitle] = useState<string>("");
  const [newDocType, setNewDocType] = useState<string>("BRD");
  const [newDocOwner, setNewDocOwner] = useState<string>("BA Lead");

  // Edit Document Metadata Modal state
  const [isEditDocModalOpen, setIsEditDocModalOpen] = useState<boolean>(false);
  const [editingDoc, setEditingDoc] = useState<ProjectDocument | null>(null);
  const [editDocTitle, setEditDocTitle] = useState<string>("");
  const [editDocType, setEditDocType] = useState<string>("BRD");
  const [editDocOwner, setEditDocOwner] = useState<string>("");
  const [editDocStatus, setEditDocStatus] = useState<DocumentStatus>("Draft");
  const [editDocVersion, setEditDocVersion] = useState<string>("v1.0");

  // Confirmation Delete Popup Modal state
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    type: "project" | "document" | "comment" | null;
    id: string | null;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: null,
    id: null,
    title: "",
    message: ""
  });
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState<boolean>(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  function setSyncedDocumentCommentCount(documentId: string, count: number) {
    const safeCount = Math.max(0, count);
    setDocumentCommentCounts((prev) => ({ ...prev, [documentId]: safeCount }));
    setDocumentsList((prev) =>
      prev.map((document) =>
        document.id === documentId ? { ...document, openCommentsCount: safeCount } : document
      )
    );
  }

  function adjustDocumentCommentCount(documentId: string | undefined, delta: number) {
    if (!documentId) return;
    const current =
      documentCommentCounts[documentId] ??
      documentsList.find((document) => document.id === documentId)?.openCommentsCount ??
      0;
    const nextCount = Math.max(0, current + delta);
    setDocumentCommentCounts((prev) => ({ ...prev, [documentId]: nextCount }));
    setDocumentsList((prev) =>
      prev.map((document) =>
        document.id === documentId ? { ...document, openCommentsCount: nextCount } : document
      )
    );
  }

  // Update importTargetProjectId when selectedProjectId changes
  useEffect(() => {
    setImportTargetProjectId(selectedProjectId);
    setNewDocProjectId(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    const projectDocs = documentsList.filter((document) => document.projectId === importTargetProjectId);
    const selectedDocInProject = projectDocs.some((document) => document.id === selectedDocumentId);
    setImportTargetDocumentId((current) => {
      if (projectDocs.some((document) => document.id === current)) return current;
      if (selectedDocInProject) return selectedDocumentId;
      return projectDocs[0]?.id ?? "";
    });
    if (!projectDocs.length) setImportMode("create");
  }, [documentsList, importTargetProjectId, selectedDocumentId]);

  useEffect(() => {
    if (!currentUser) {
      setIsBackendConnected(false);
      setIsLoadingBackend(false);
      return;
    }

    void loadWorkspaceFromBackend();
  }, [currentUser?.id]);

  useEffect(() => {
    if (!getAccessToken()) return;
    void fetchCurrentUser()
      .then((user) => {
        setCurrentUser(user);
        void loadWorkspaceFromBackend();
      })
      .catch(() => {
        setIsBackendConnected(false);
      });
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.role !== "ADMIN" && currentUser.role !== "MANAGER" && activeTabNav === "admin") {
      setActiveTabNav("projects");
    }
  }, [currentUser?.role, activeTabNav]);

  useEffect(() => {
    if (activeTabNav !== "projects" || !selectedProjectId) return;
    const currentDocument = documentsList.find((document) => document.id === selectedDocumentId);
    if (currentDocument?.projectId === selectedProjectId) return;

    const firstProjectDocument = documentsList.find((document) => document.projectId === selectedProjectId);
    setSelectedDocumentId(firstProjectDocument?.id ?? "empty-document");
  }, [activeTabNav, documentsList, selectedDocumentId, selectedProjectId]);

  useEffect(() => {
    if (activeTabNav !== "review") return;
    const currentDocumentHasComments = (documentCommentCounts[selectedDocumentId] ?? 0) > 0;
    if (currentDocumentHasComments) return;

    const firstReviewDocument = documentsList.find((document) => {
      const openCount = documentCommentCounts[document.id] ?? document.openCommentsCount ?? 0;
      return openCount > 0;
    });
    if (firstReviewDocument?.projectId) setSelectedProjectId(firstReviewDocument.projectId);
    setSelectedDocumentId(firstReviewDocument?.id ?? "empty-document");
  }, [activeTabNav, documentCommentCounts, documentsList, selectedDocumentId]);

  useEffect(() => {
    if (!isBackendConnected || !selectedDocumentId || selectedDocumentId === "empty-document") return;
    setSelectedCommentTarget(null);
    setActiveBlockId(null);
    void loadCommentsForDocument(selectedDocumentId);
    void loadDocumentCollaboration(selectedDocumentId);
  }, [isBackendConnected, selectedDocumentId]);

  useEffect(() => {
    if (!isBackendConnected || !selectedProjectId) return;
    void loadProjectCollaboration(selectedProjectId);
    void loadRoleDashboard();
    void loadNotifications();
    void loadTemplates();
  }, [isBackendConnected, selectedProjectId]);

  useEffect(() => {
    if (!isBackendConnected || !selectedProjectId || searchQuery.trim().length < 2) {
      setAdvancedSearchResults(null);
      setIsAdvancedSearchOpen(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void searchProject(selectedProjectId, searchQuery.trim())
        .then((results) => {
          setAdvancedSearchResults(results);
          setIsAdvancedSearchOpen(true);
        })
        .catch((error) => console.error("Cannot search project:", error));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [isBackendConnected, selectedProjectId, searchQuery]);

  async function loadWorkspaceFromBackend(preferredProjectId?: string, preferredDocumentId?: string) {
    setIsLoadingBackend(true);
    try {
      const backendProjects = await fetchProjects();
      if (backendProjects.length === 0) {
        setProjectsList([]);
        setDocumentsList([]);
        setCommentsList([]);
        setSelectedProjectId("");
        setSelectedDocumentId("empty-document");
        setIsBackendConnected(true);
        return;
      }

      const hydratedDocuments = (
        await Promise.all(backendProjects.map((project) => fetchDocumentsByProject(project.id)))
      ).flat();
      const projectsWithCounts = backendProjects.map((project) => ({
        ...project,
        documents: hydratedDocuments.filter((document) => document.projectId === project.id).length,
        openComments: hydratedDocuments
          .filter((document) => document.projectId === project.id)
          .reduce((total, document) => total + (document.openCommentsCount ?? 0), 0)
      }));
      const nextProjectId = preferredProjectId ?? selectedProjectId;
      const selectedProjectExists = projectsWithCounts.some((project) => project.id === nextProjectId);
      const finalProjectId = selectedProjectExists ? nextProjectId : projectsWithCounts[0].id;
      const firstDocument =
        hydratedDocuments.find((document) => document.id === preferredDocumentId) ??
        hydratedDocuments.find((document) => document.projectId === finalProjectId) ??
        hydratedDocuments[0];

      setProjectsList(projectsWithCounts);
      setDocumentsList(hydratedDocuments);
      setDocumentCommentCounts(
        Object.fromEntries(hydratedDocuments.map((document) => [document.id, document.openCommentsCount ?? 0]))
      );
      setSelectedProjectId(finalProjectId);
      setSelectedDocumentId(firstDocument?.id ?? "empty-document");
      setIsBackendConnected(true);
    } catch (error: any) {
      console.error("Cannot load backend workspace:", error);
      setIsBackendConnected(false);
      if (error?.message?.includes("401") || error?.message?.includes("Unauthorized")) {
        clearAuthSession();
        setCurrentUser(null);
        addToast("info", "Phiên đăng nhập hết hạn", "Vui lòng đăng nhập lại để kết nối với BE.");
      } else {
        addToast("warning", "Đang dùng dữ liệu mẫu", "FE chưa gọi được BE. Kiểm tra Nest server ở port 3000.");
      }
    } finally {
      setIsLoadingBackend(false);
    }
  }

  async function loadCommentsForDocument(documentId: string) {
    try {
      const backendComments = await fetchComments(documentId);
      setCommentsList((prev) => {
        const remaining = prev.filter((comment) => comment.documentId !== documentId);
        return [...backendComments, ...remaining.filter((comment) => !comment.documentId)];
      });
      setSyncedDocumentCommentCount(
        documentId,
        backendComments.filter((comment) => comment.status === "open").length
      );
    } catch (error) {
      console.error("Cannot load comments:", error);
    }
  }

  async function loadProjectCollaboration(projectId: string) {
    try {
      const [dashboard, traces, activity] = await Promise.all([
        fetchProjectDashboard(projectId),
        fetchTraceLinks(projectId),
        fetchProjectActivity(projectId)
      ]);
      setProjectDashboard(dashboard);
      setTraceLinks(traces);
      setActivityLogs(activity);
    } catch (error) {
      console.error("Cannot load project collaboration:", error);
    }
  }

  async function loadRoleDashboard() {
    try {
      setRoleDashboard(await fetchRoleDashboard());
    } catch (error) {
      console.error("Cannot load role dashboard:", error);
    }
  }

  async function loadDocumentCollaboration(documentId: string) {
    try {
      const [diff, tagResult] = await Promise.all([
        fetchDocumentDiff(documentId),
        fetchDocumentTags(documentId)
      ]);
      setDocumentDiff(diff);
      setSavedTags(tagResult.saved);
      setInferredTags(tagResult.inferred);
    } catch (error) {
      console.error("Cannot load document collaboration:", error);
    }
  }

  async function loadNotifications() {
    try {
      setNotifications(await fetchNotifications());
    } catch (error) {
      console.error("Cannot load notifications:", error);
    }
  }

  async function loadTemplates() {
    try {
      setDocumentTemplates(await fetchDocumentTemplates());
    } catch (error) {
      console.error("Cannot load templates:", error);
    }
  }

  function handleDocumentSelection() {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || !documentContainerRef.current) return;

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;

    if (
      !anchorNode ||
      !focusNode ||
      !documentContainerRef.current.contains(anchorNode) ||
      !documentContainerRef.current.contains(focusNode)
    ) {
      return;
    }

    const rawRange = selection.getRangeAt(0);
    const range = getCommentSelectionRange(rawRange, anchorNode, focusNode);
    if (range.collapsed) return;

    const selectedText = getSelectedRangeText(range);
    if (selectedText.length < 2) return;

    clearActiveCommentHighlight();
    activeCommentSelectionRangeRef.current = range.cloneRange();
    setSelectionHighlightRects(getSelectionOverlayRects(range));
    applyBrowserSelectionRange(selection, range);

    const sourceElement =
      closestReadableElement(focusNode) ??
      closestReadableElement(range.commonAncestorContainer) ??
      closestReadableElement(range.endContainer);
    const explicitReq = sourceElement?.closest<HTMLElement>("[data-req], [data-block-id]");
    const pdfPage = sourceElement?.closest<HTMLElement>(".pdf-hybrid-page");
    const blockId =
      explicitReq?.dataset.req ??
      (pdfPage?.dataset.page ? `PDF-P${pdfPage.dataset.page}` : undefined) ??
      explicitReq?.dataset.blockId ??
      `SEL-${Math.abs(hashText(selectedText)).toString().slice(0, 6)}`;
    const targetRect = getSelectionEndRect(range);

    setSelectedCommentTarget({
      blockId,
      selectedText: selectedText.slice(0, 1000)
    });
    setIsSelectionComposerOpen(false);
    if (targetRect) {
      setSelectionPopover(getSelectionPopoverPosition(targetRect));
    }
    setActiveBlockId(blockId);
    setShowCommentsPanel(true);
  }

  function getCommentSelectionRange(range: Range, anchorNode: Node, focusNode: Node) {
    const anchorElement = closestReadableElement(anchorNode);
    const focusElement = closestReadableElement(focusNode);

    const anchorPdfPage = anchorElement?.closest(".pdf-hybrid-page");
    const focusPdfPage = focusElement?.closest(".pdf-hybrid-page");
    if (anchorPdfPage && focusPdfPage && anchorPdfPage === focusPdfPage) {
      return range.cloneRange();
    }

    if (!focusElement || !anchorElement || focusElement === anchorElement) {
      return range.cloneRange();
    }

    const focusRange = document.createRange();
    focusRange.selectNodeContents(focusElement);

    const clampedRange = range.cloneRange();
    if (clampedRange.compareBoundaryPoints(Range.START_TO_START, focusRange) < 0) {
      clampedRange.setStart(focusRange.startContainer, focusRange.startOffset);
    }
    if (clampedRange.compareBoundaryPoints(Range.END_TO_END, focusRange) > 0) {
      clampedRange.setEnd(focusRange.endContainer, focusRange.endOffset);
    }

    return clampedRange;
  }

  function applyBrowserSelectionRange(selection: Selection, range: Range) {
    if (!documentContainerRef.current || !documentContainerRef.current.contains(range.commonAncestorContainer)) {
      return;
    }

    const currentRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (
      currentRange &&
      currentRange.startContainer === range.startContainer &&
      currentRange.startOffset === range.startOffset &&
      currentRange.endContainer === range.endContainer &&
      currentRange.endOffset === range.endOffset
    ) {
      return;
    }

    selection.removeAllRanges();
    selection.addRange(range);
  }

  function restoreActiveCommentSelection() {
    const selection = window.getSelection();
    const range = activeCommentSelectionRangeRef.current;
    if (!selection || !range) return;
    applyBrowserSelectionRange(selection, range);
  }

  function getSelectedRangeText(range: Range) {
    return (range.cloneContents().textContent ?? "").replace(/\s+/g, " ").trim();
  }

  function getSelectionEndRect(range: Range) {
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    const lastRect = rects[rects.length - 1];
    if (lastRect) return lastRect;

    const boundingRect = range.getBoundingClientRect();
    return boundingRect.width || boundingRect.height ? boundingRect : null;
  }

  function getSelectionPopoverPosition(rect: DOMRect) {
    const toolbarWidth = 128;
    const toolbarHeight = 38;
    const gutter = 10;
    const preferredTop = rect.bottom + 8;
    const top = preferredTop + toolbarHeight + gutter > window.innerHeight
      ? Math.max(72, rect.top - toolbarHeight - 8)
      : Math.max(72, preferredTop);
    const left = Math.min(
      window.innerWidth - toolbarWidth - gutter,
      Math.max(gutter, rect.right - toolbarWidth)
    );

    return { top, left };
  }

  function clearSelectedCommentTarget() {
    activeCommentSelectionRangeRef.current = null;
    setSelectionHighlightRects([]);
    setSelectedCommentTarget(null);
    setSelectionPopover(null);
    setIsSelectionComposerOpen(false);
    setActiveBlockId(null);
    window.getSelection()?.removeAllRanges();
    clearActiveCommentHighlight();
  }

  function getSelectionOverlayRects(range: Range) {
    const docPage = documentContainerRef.current?.closest(".doc-page") as HTMLElement | null;
    if (!docPage) return [];

    const pageRect = docPage.getBoundingClientRect();
    return Array.from(range.getClientRects())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({
        top: rect.top - pageRect.top + docPage.scrollTop,
        left: rect.left - pageRect.left + docPage.scrollLeft,
        width: rect.width,
        height: rect.height
      }));
  }

  function isPointInsideActiveSelection(clientX: number, clientY: number) {
    const range = activeCommentSelectionRangeRef.current;
    if (!range) return false;

    return Array.from(range.getClientRects()).some((rect) => {
      if (rect.width <= 0 || rect.height <= 0) return false;
      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      );
    });
  }

  function closestReadableElement(node: Node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    return element?.closest<HTMLElement>("p, li, td, th, blockquote, h1, h2, h3, h4, .req-block, pre, .pdf-text-item, .pdf-hybrid-page");
  }

  function hashText(value: string) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function focusSelectedCommentComposer() {
    setShowCommentsPanel(true);
    setIsSelectionComposerOpen(true);
    window.setTimeout(() => inlineCommentTextareaRef.current?.focus(), 50);
  }

  async function handleCopySelectedText() {
    if (!selectedCommentTarget?.selectedText) return;

    try {
      await navigator.clipboard.writeText(selectedCommentTarget.selectedText);
      addToast("success", "Đã copy", "Đoạn bôi đen đã được copy vào clipboard.");
      window.setTimeout(restoreActiveCommentSelection, 20);
    } catch (error) {
      console.error("Copy selected text error:", error);
      addToast("error", "Không copy được", "Trình duyệt chưa cấp quyền clipboard.");
    }
  }

  function handleCommentCardClick(comment: CommentThread) {
    if (comment.status === "resolved") return;
    if (!comment.selectedText) return;
    setSelectedCommentTarget(null);
    setSelectionPopover(null);
    setIsSelectionComposerOpen(false);
    setActiveBlockId(comment.blockId);
    window.setTimeout(() => highlightCommentText(comment.selectedText!, comment.blockId), 80);
  }

  function clearActiveCommentHighlight() {
    if (!documentContainerRef.current) return;
    const marks = Array.from(
      documentContainerRef.current.querySelectorAll<HTMLElement>(".active-comment-highlight")
    );
    marks.forEach((mark) => {
      if (mark.tagName.toLowerCase() !== "mark") {
        mark.classList.remove("active-comment-highlight");
        return;
      }
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    });
    documentContainerRef.current
      .querySelectorAll<HTMLElement>(".active-comment-block-highlight")
      .forEach((element) => element.classList.remove("active-comment-block-highlight"));
  }

  function highlightCommentText(selectedText: string, blockId?: string) {
    if (!documentContainerRef.current) return;
    clearActiveCommentHighlight();

    const target = selectedText.replace(/\s+/g, " ").trim();
    if (!target) return;

    if (blockId?.startsWith("PDF-P")) {
      const pageNumber = blockId.replace("PDF-P", "");
      const pdfPage = documentContainerRef.current.querySelector<HTMLElement>(
        `.pdf-hybrid-page[data-page="${pageNumber}"], .pdf-hybrid-page[data-block-id="${blockId}"]`
      );
      if (pdfPage) {
        if (highlightPdfCommentTarget(pdfPage, target)) return;
      }
    }

    const pdfFallbackPage = findPdfCommentPage(target);
    if (pdfFallbackPage && highlightPdfCommentTarget(pdfFallbackPage, target)) {
      return;
    }

    const walker = document.createTreeWalker(
      documentContainerRef.current,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || parent.closest("script, style, svg, .mermaid-container, .mermaid-error")) {
            return NodeFilter.FILTER_REJECT;
          }
          const value = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
          return value.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );

    let matchNode: Text | null = null;
    let startIndex = -1;
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const raw = node.textContent ?? "";
      startIndex = raw.indexOf(target);
      if (startIndex === -1) {
        startIndex = raw.toLowerCase().indexOf(target.toLowerCase());
      }
      if (startIndex !== -1) {
        matchNode = node;
        break;
      }
    }

    if (!matchNode || startIndex < 0) {
      const fallbackElement = findCommentBlockElement(target);
      if (fallbackElement) {
        fallbackElement.classList.add("active-comment-block-highlight");
        scrollDocumentReaderTo(fallbackElement, "center");
        return;
      }
      addToast("warning", "Không tìm thấy đoạn gốc", "Đoạn này có thể đã bị chỉnh sửa trong tài liệu.");
      return;
    }

    const range = document.createRange();
    range.setStart(matchNode, startIndex);
    range.setEnd(matchNode, Math.min(startIndex + target.length, matchNode.length));
    const mark = document.createElement("mark");
    mark.className = "active-comment-highlight";
    range.surroundContents(mark);
    scrollDocumentReaderTo(mark, "center");
  }

  function highlightPdfCommentTarget(pdfPage: HTMLElement, target: string) {
    const match = findPdfTextSequenceTarget(pdfPage, target);
    if (!match) {
      pdfPage.classList.add("active-comment-block-highlight");
      scrollDocumentReaderTo(pdfPage, "center");
      return false;
    }

    match.items.forEach((element) => element.classList.add("active-comment-highlight"));
    scrollDocumentReaderTo(match.targetElement, "center");
    return true;
  }

  function findPdfCommentPage(target: string) {
    if (!documentContainerRef.current) return null;
    const pages = Array.from(documentContainerRef.current.querySelectorAll<HTMLElement>(".pdf-hybrid-page"));
    return pages.find((page) => findPdfTextSequenceTarget(page, target)) ?? null;
  }

  function findPdfTextSequenceTarget(pdfPage: HTMLElement, target: string) {
    const normalizedTarget = normalizePdfLookupText(target);
    if (!normalizedTarget) return null;

    const textItems = Array.from(pdfPage.querySelectorAll<HTMLElement>(".pdf-text-item")).filter((item) =>
      Boolean(normalizePdfLookupText(item.textContent ?? ""))
    );

    const singleMatch = textItems.find((item) => {
      const text = normalizePdfLookupText(item.textContent ?? "");
      return text && (text.includes(normalizedTarget) || normalizedTarget.includes(text));
    });
    if (singleMatch) return { items: [singleMatch], targetElement: singleMatch };

    for (let start = 0; start < textItems.length; start += 1) {
      let combined = "";
      const matchedItems: HTMLElement[] = [];
      for (let end = start; end < textItems.length; end += 1) {
        const text = normalizePdfLookupText(textItems[end].textContent ?? "");
        if (!text) continue;
        matchedItems.push(textItems[end]);
        combined = normalizePdfLookupText(`${combined} ${text}`);
        if (combined.includes(normalizedTarget) || normalizedTarget.includes(combined)) {
          return { items: matchedItems, targetElement: matchedItems[0] };
        }
        if (combined.length > normalizedTarget.length + 80) break;
      }
    }

    return null;
  }

  function scrollDocumentReaderTo(targetElement: HTMLElement, block: ScrollLogicalPosition = "center") {
    const container = documentContainerRef.current;
    const docPage = (targetElement.closest(".doc-page") || container?.closest(".doc-page")) as HTMLElement | null;

    if (docPage) {
      const elTop = targetElement.getBoundingClientRect().top;
      const docPageTop = docPage.getBoundingClientRect().top;
      const offset = block === "start" ? 24 : docPage.clientHeight / 2 - targetElement.clientHeight / 2;
      const targetScrollTop = docPage.scrollTop + (elTop - docPageTop) - offset;
      docPage.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: "smooth"
      });
      return;
    }

    targetElement.scrollIntoView({ behavior: "smooth", block });
  }

  function renderPersistedCommentAnchors(comments: CommentThread[]) {
    if (!documentContainerRef.current) return;

    documentContainerRef.current
      .querySelectorAll<HTMLElement>(".comment-anchor-highlight")
      .forEach((element) => element.classList.remove("comment-anchor-highlight"));

    comments
      .filter((comment) => comment.selectedText && !comment.parentId && comment.status === "open")
      .forEach((comment) => {
        const selectedText = comment.selectedText?.trim();
        if (!selectedText) return;

        const pdfPages = getPdfCandidatePages(comment.blockId, selectedText);
        for (const page of pdfPages) {
          const match = findPdfTextSequenceTarget(page, selectedText);
          if (!match) continue;
          match.items.forEach((element) => element.classList.add("comment-anchor-highlight"));
          break;
        }
      });
  }

  function getPdfCandidatePages(blockId: string, selectedText: string) {
    if (!documentContainerRef.current) return [];
    const allPages = Array.from(documentContainerRef.current.querySelectorAll<HTMLElement>(".pdf-hybrid-page"));
    if (!allPages.length) return [];

    if (blockId.startsWith("PDF-P")) {
      const pageNumber = blockId.replace("PDF-P", "");
      const exactPage = documentContainerRef.current.querySelector<HTMLElement>(
        `.pdf-hybrid-page[data-page="${pageNumber}"], .pdf-hybrid-page[data-block-id="${blockId}"]`
      );
      if (exactPage) return [exactPage, ...allPages.filter((page) => page !== exactPage)];
    }

    const normalizedTarget = normalizePdfLookupText(selectedText);
    const textPage = allPages.find((page) => normalizePdfLookupText(page.textContent ?? "").includes(normalizedTarget));
    return textPage ? [textPage, ...allPages.filter((page) => page !== textPage)] : allPages;
  }

  function findCommentBlockElement(target: string) {
    if (!documentContainerRef.current) return null;
    const normalizedTarget = target.replace(/\s+/g, " ").trim().toLowerCase();
    const candidates = Array.from(
      documentContainerRef.current.querySelectorAll<HTMLElement>(
        "p, li, td, th, blockquote, h1, h2, h3, h4, .req-block, .pdf-hybrid-page"
      )
    );

    return (
      candidates.find((element) => {
        const normalizedText = (element.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
        return normalizedText.includes(normalizedTarget) || normalizedTarget.includes(normalizedText);
      }) ?? null
    );
  }

  const selectedProject = useMemo(
    () =>
      projectsList.find((p) => p.id === selectedProjectId) ??
      projectsList[0] ?? {
        id: "",
        code: "NO-PROJECT",
        name: "Chưa có dự án",
        client: "Internal Team",
        progress: 0,
        openComments: 0,
        documents: 0
      },
    [projectsList, selectedProjectId]
  );

  // Documents for current scope
  const projectDocuments = useMemo(() => {
    if (activeTabNav === "review") {
      return documentsList.filter((doc) => {
        const openCount = documentCommentCounts[doc.id] ?? doc.openCommentsCount ?? 0;
        return openCount > 0;
      });
    }
    return documentsList.filter((doc) => doc.projectId === selectedProjectId);
  }, [documentsList, documentCommentCounts, selectedProjectId, activeTabNav]);

  // Handle project change: auto select first document of new project
  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveTabNav("projects");
    const firstDoc = documentsList.find((doc) => doc.projectId === projectId);
    if (firstDoc) {
      setSelectedDocumentId(firstDoc.id);
    } else {
      setSelectedDocumentId("empty-document");
    }
  };

  function handleProjectCardKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, projectId: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleSelectProject(projectId);
  }

  const selectedDocument = useMemo(() => {
    const selected = documentsList.find((doc) => doc.id === selectedDocumentId);
    const selectedFitsCurrentScope =
      activeTabNav !== "review"
        ? true
        : Boolean(selected && projectDocuments.some((document) => document.id === selected.id));
    const doc = selectedFitsCurrentScope
      ? selected ?? projectDocuments[0] ?? documentsList[0] ?? EMPTY_DOCUMENT
      : projectDocuments[0] ?? EMPTY_DOCUMENT;
    return {
      ...doc,
      title: normalizeVietnameseText(doc.title),
      contentHtml: normalizeVietnameseText(doc.contentHtml || "")
    };
  }, [activeTabNav, documentsList, selectedDocumentId, projectDocuments]);

  const importTargetDocuments = useMemo(
    () => documentsList.filter((doc) => doc.projectId === importTargetProjectId),
    [documentsList, importTargetProjectId]
  );

  // Filtered documents list
  const filteredDocuments = useMemo(() => {
    return projectDocuments.filter((doc) => {
      const matchesStatus = activeTabNav === "review" || statusFilter === "All" || doc.status === statusFilter;
      const matchesSearch =
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.owner.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [activeTabNav, projectDocuments, statusFilter, searchQuery]);

  // Filtered comments for selected block or document
  const displayedComments = useMemo(() => {
    const documentComments = commentsList.filter((c) => c.documentId === selectedDocument.id || !c.documentId);
    const repliesByParent = new Map<string, CommentThread[]>();
    documentComments.forEach((comment) => {
      if (!comment.parentId) return;
      repliesByParent.set(comment.parentId, [...(repliesByParent.get(comment.parentId) ?? []), comment]);
    });

    return documentComments
      .filter((comment) => !comment.parentId)
      .filter((comment) => {
        if (commentFilter === "open") return comment.status === "open";
        if (commentFilter === "resolved") return comment.status === "resolved";
        if (commentFilter === "mine") return comment.authorEmail === currentUser?.email || comment.author === currentUser?.name;
        return true;
      })
      .map((comment) => ({
        ...comment,
        replies: repliesByParent.get(comment.id) ?? []
      }));
  }, [commentsList, selectedDocument.id, commentFilter, currentUser?.email, currentUser?.name]);

  useEffect(() => {
    if (!documentContainerRef.current) return;

    const timer = window.setTimeout(() => {
      renderPersistedCommentAnchors(displayedComments);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [displayedComments, selectedDocument.id, selectedDocument.contentHtml]);

  // Toast Helper
  function addToast(type: ToastMessage["type"], title: string, message: string) {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  // Create New Project Handler
  async function handleCreateProject() {
    if (!newProjName.trim()) {
      addToast("warning", "Thiếu thông tin", "Vui lòng nhập Tên dự án.");
      return;
    }
    const projectCode = newProjCode.trim()
      ? newProjCode.trim().toUpperCase()
      : generateProjectCode(newProjName, projectsList.map((project) => project.code));
    try {
      const newProj = await createProject({
        code: projectCode,
        name: newProjName.trim(),
        client: buildProjectClientLabel(newProjCustomer, newProjBusinessUnit)
      });
      setProjectsList((prev) => [...prev, newProj]);
      setSelectedProjectId(newProj.id);
      setSelectedDocumentId("empty-document");
      setActiveTabNav("projects");
      setNewProjCode("");
      setNewProjName("");
      setNewProjCustomer("Internal Team");
      setNewProjBusinessUnit("Vận hành nội bộ");
      setIsCreateProjectModalOpen(false);
      addToast("success", "Đã tạo dự án mới", `Dự án "${newProj.name}" (${newProj.code}) đã được lưu vào Neon.`);
    } catch (error) {
      console.error("Create project error:", error);
      addToast("error", "Không tạo được dự án", "BE từ chối request hoặc mã dự án đã tồn tại.");
    }
  }

  // Open Edit Project Modal
  function openEditProjectModal(proj: Project, e: React.MouseEvent) {
    e.stopPropagation();
    const scope = parseProjectClientLabel(proj.client);
    setEditingProject(proj);
    setEditProjCode(proj.code);
    setEditProjName(proj.name);
    setEditProjCustomer(scope.customer);
    setEditProjBusinessUnit(scope.businessUnit);
    setIsEditProjectModalOpen(true);
  }

  // Save Edit Project Handler
  async function handleSaveEditProject() {
    if (!editingProject) return;
    if (!editProjName.trim()) {
      addToast("warning", "Thiếu thông tin", "Vui lòng nhập Tên dự án.");
      return;
    }
    const projectCode = editProjCode.trim()
      ? editProjCode.trim().toUpperCase()
      : generateProjectCode(
          editProjName,
          projectsList.filter((project) => project.id !== editingProject.id).map((project) => project.code)
        );

    try {
      const updatedProject = await updateProject(editingProject.id, {
        code: projectCode,
        name: editProjName.trim(),
        client: buildProjectClientLabel(editProjCustomer, editProjBusinessUnit)
      });
      setProjectsList((prev) => prev.map((p) => (p.id === updatedProject.id ? { ...p, ...updatedProject } : p)));
      setIsEditProjectModalOpen(false);
      setEditingProject(null);
      addToast("success", "Đã cập nhật dự án", `Dự án "${updatedProject.name}" đã lưu vào Neon.`);
    } catch (error) {
      console.error("Update project error:", error);
      addToast("error", "Không cập nhật được dự án", "BE chưa lưu được thay đổi dự án.");
    }
  }

  // Request Project Deletion (Opens Confirmation Modal)
  function requestDeleteProject(projectId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (projectsList.length <= 1) {
      addToast("warning", "Không thể xóa", "Hệ thống cần giữ ít nhất 1 dự án.");
      return;
    }
    const proj = projectsList.find((p) => p.id === projectId);
    setConfirmDeleteModal({
      isOpen: true,
      type: "project",
      id: projectId,
      title: "Xác nhận xóa dự án",
      message: `Bạn có chắc chắn muốn xóa dự án "${proj?.name || projectId}"? Tất cả tài liệu liên quan sẽ bị xóa vĩnh viễn.`
    });
  }

  // Delete Project Logic
  async function handleDeleteProject(projectId: string) {
    const projToDelete = projectsList.find((p) => p.id === projectId);

    try {
      await deleteProject(projectId);
      const updatedProjects = projectsList.filter((p) => p.id !== projectId);
      const removedDocumentIds = new Set(
        documentsList.filter((document) => document.projectId === projectId).map((document) => document.id)
      );
      setProjectsList(updatedProjects);
      setDocumentsList((prev) => prev.filter((d) => d.projectId !== projectId));
      setCommentsList((prev) => prev.filter((comment) => !comment.documentId || !removedDocumentIds.has(comment.documentId)));

      if (selectedProjectId === projectId) {
        const nextProj = updatedProjects[0];
        setSelectedProjectId(nextProj?.id ?? "");
        const nextDoc = documentsList.find((d) => nextProj && d.projectId === nextProj.id);
        setSelectedDocumentId(nextDoc?.id ?? "empty-document");
      }

      addToast("info", "Đã xóa dự án", `Dự án "${projToDelete?.name || projectId}" và các tài liệu liên quan đã bị xóa khỏi Neon.`);
    } catch (error) {
      console.error("Delete project error:", error);
      addToast("error", "Không xóa được dự án", "BE chưa xóa được dự án này. Kiểm tra quyền hoặc thử lại.");
    }
  }

  // Create New Document Handler
  async function handleCreateDocument() {
    if (!newDocTitle.trim()) {
      addToast("warning", "Thiếu tiêu đề", "Vui lòng nhập tên/tiêu đề tài liệu.");
      return;
    }
    const initialContent = `<h3>1. Mục tiêu Yêu cầu (${newDocTitle.trim()})</h3>\n<div class="req-block" data-req="REQ-001">\n  <div class="req-block-header">\n    <span class="req-tag">REQ-001</span>\n  </div>\n  <p>Yêu cầu nghiệp vụ ban đầu cho tài liệu ${newDocTitle.trim()}.</p>\n</div>`;

    try {
      const newDoc = await createDocument({
        projectId: newDocProjectId,
        title: newDocTitle.trim(),
        type: newDocType,
        htmlContent: initialContent
      });

      setDocumentsList((prev) => [newDoc, ...prev.filter((doc) => doc.id !== newDoc.id)]);
      setProjectsList((prev) =>
        prev.map((p) => (p.id === newDocProjectId ? { ...p, documents: p.documents + 1 } : p))
      );

      setSelectedProjectId(newDocProjectId);
      setSelectedDocumentId(newDoc.id);
      setNewDocTitle("");
      setIsCreateDocModalOpen(false);

      addToast("success", "Đã tạo tài liệu mới", `Tài liệu "${newDoc.title}" đã được lưu vào Neon.`);
    } catch (error) {
      console.error("Create document error:", error);
      addToast("error", "Không tạo được tài liệu", "Kiểm tra project đích và kết nối BE.");
    }
  }

  // Open Edit Document Metadata Modal
  function openEditDocumentModal(doc: ProjectDocument) {
    setEditingDoc(doc);
    setEditDocTitle(doc.title);
    setEditDocType(doc.type);
    setEditDocOwner(doc.owner);
    setEditDocStatus(doc.status);
    setEditDocVersion(doc.version);
    setIsEditDocModalOpen(true);
  }

  // Save Edit Document Metadata Handler
  async function handleSaveEditDocument() {
    if (!editingDoc) return;
    if (!editDocTitle.trim()) {
      addToast("warning", "Thiếu tiêu đề", "Vui lòng nhập tên/tiêu đề tài liệu.");
      return;
    }

    try {
      const updatedDocument = await updateDocument(editingDoc.id, {
        title: editDocTitle.trim(),
        type: editDocType.trim(),
        status: editDocStatus,
        currentVersion: editDocVersion.trim()
      });
      setDocumentsList((prev) =>
        prev.map((d) =>
          d.id === updatedDocument.id
            ? {
              ...d,
              ...updatedDocument,
              owner: editDocOwner.trim() || d.owner
            }
            : d
        )
      );

      setIsEditDocModalOpen(false);
      setEditingDoc(null);
      addToast("success", "Đã cập nhật thuộc tính tài liệu", `Tài liệu "${updatedDocument.title}" đã lưu vào Neon.`);
    } catch (error) {
      console.error("Update document error:", error);
      addToast("error", "Không cập nhật được tài liệu", "BE chưa lưu được thay đổi tài liệu.");
    }
  }

  async function handleDeploySelectedDocument() {
    if (selectedDocument.id === "empty-document" || selectedDocument.status === "Triển khai") return;

    try {
      const updatedDocument = await updateDocument(selectedDocument.id, {
        status: "Triển khai"
      });
      setDocumentsList((prev) =>
        prev.map((document) =>
          document.id === updatedDocument.id
            ? { ...document, ...updatedDocument }
            : document
        )
      );
      addToast("success", "Đã chuyển sang Triển khai", `Tài liệu "${updatedDocument.title}" đã được cập nhật trạng thái.`);
      void loadRoleDashboard();
    } catch (error) {
      console.error("Deploy document error:", error);
      addToast("error", "Không chuyển được trạng thái", "BE chưa lưu được trạng thái Triển khai.");
    }
  }

  // Request Document Deletion (Opens Confirmation Modal)
  function requestDeleteDocument(docId: string) {
    const doc = documentsList.find((d) => d.id === docId);
    setConfirmDeleteModal({
      isOpen: true,
      type: "document",
      id: docId,
      title: "Xác nhận xóa tài liệu",
      message: `Bạn có chắc chắn muốn xóa tài liệu "${doc?.title || docId}"? Thao tác này không thể hoàn tác.`
    });
  }

  // Delete Document Logic
  async function handleDeleteDocument(documentId: string) {
    const docToDelete = documentsList.find((d) => d.id === documentId);

    try {
      await deleteDocument(documentId);
      const updatedDocs = documentsList.filter((d) => d.id !== documentId);
      setDocumentsList(updatedDocs);
      setDocumentCommentCounts((prev) => {
        const { [documentId]: _removed, ...remaining } = prev;
        return remaining;
      });
      setCommentsList((prev) => prev.filter((comment) => comment.documentId !== documentId));

      if (selectedDocumentId === documentId) {
        const nextDoc = updatedDocs.find((d) => d.projectId === selectedProjectId) || updatedDocs[0];
        setSelectedDocumentId(nextDoc?.id ?? "empty-document");
      }

      addToast("info", "Đã xóa tài liệu", `Tài liệu "${docToDelete?.title || documentId}" đã được xóa khỏi Neon.`);
    } catch (error) {
      console.error("Delete document error:", error);
      addToast("error", "Không xóa được tài liệu", "BE chưa xóa được tài liệu này. Kiểm tra quyền hoặc thử lại.");
    }
  }

  // Request Comment Deletion (Opens Confirmation Modal)
  function requestDeleteComment(commentId: string) {
    setConfirmDeleteModal({
      isOpen: true,
      type: "comment",
      id: commentId,
      title: "Xác nhận xóa nhận xét",
      message: "Bạn có chắc chắn muốn xóa nhận xét này khỏi thảo luận?"
    });
  }

  // Delete Comment Logic
  async function handleDeleteComment(commentId: string) {
    const commentsToRemove = commentsList.filter((comment) => comment.id === commentId || comment.parentId === commentId);
    const removedDocumentId = commentsToRemove[0]?.documentId;
    try {
      await deleteComment(commentId);
      setCommentsList((prev) => prev.filter((c) => c.id !== commentId && c.parentId !== commentId));
      adjustDocumentCommentCount(removedDocumentId, -commentsToRemove.filter((comment) => comment.status === "open").length);
      addToast("info", "Đã xóa nhận xét", "Ghi chú nhận xét đã được xóa khỏi Neon.");
    } catch (error) {
      console.error("Delete comment error:", error);
      addToast("error", "Không xóa được nhận xét", "BE chưa xóa được comment này. Vui lòng thử lại.");
    }
  }

  // Execute Confirmed Delete Handler
  async function executeConfirmDelete() {
    const { type, id } = confirmDeleteModal;
    if (!id) return;

    if (type === "project") {
      await handleDeleteProject(id);
    } else if (type === "document") {
      await handleDeleteDocument(id);
    } else if (type === "comment") {
      await handleDeleteComment(id);
    }

    setConfirmDeleteModal({ isOpen: false, type: null, id: null, title: "", message: "" });
  }

  async function executeLogout() {
    setIsLogoutConfirmOpen(false);
    await logout();
    setCurrentUser(null);
    addToast("info", "Đã đăng xuất", "Hẹn gặp lại bạn!");
  }

  // Handle File Import with REAL text reading for pure document viewing & commenting
  async function handleImport(file?: File) {
    if (!file || isImporting) return;
    setIsImporting(true);
    setImportStatusText(getImportStatusText(file));
    const targetProject = projectsList.find((p) => p.id === importTargetProjectId) || selectedProject;
    const targetDocumentId = importMode === "update" ? importTargetDocumentId : undefined;

    try {
      const importedDoc = await importDocument(file, targetProject.id, targetDocumentId);

      setDocumentsList((prev) => {
        if (targetDocumentId) {
          return prev.map((doc) => (doc.id === importedDoc.id ? importedDoc : doc));
        }
        return [importedDoc, ...prev];
      });
      setDocumentCommentCounts((prev) => ({
        ...prev,
        [importedDoc.id]: importedDoc.openCommentsCount ?? prev[importedDoc.id] ?? 0
      }));
      if (!targetDocumentId) {
        setProjectsList((prev) =>
          prev.map((p) => (p.id === targetProject.id ? { ...p, documents: p.documents + 1 } : p))
        );
      }

      setSelectedProjectId(targetProject.id);
      setSelectedDocumentId(importedDoc.id);
      setIsImportModalOpen(false);
      void loadProjectCollaboration(targetProject.id);
      void loadDocumentCollaboration(importedDoc.id);

      addToast(
        "success",
        targetDocumentId ? "Đã cập nhật tài liệu!" : "Import file thành công!",
        targetDocumentId
          ? `Nội dung "${importedDoc.title}" đã được thay bằng file "${file.name}".`
          : `BE đã chuyển "${file.name}" sang HTML và lưu vào Neon.`
      );
    } catch (error) {
      console.error("Import file error:", error);
      addToast("error", "Import thất bại", "BE chưa nhận được file hoặc định dạng chưa được hỗ trợ.");
    } finally {
      setIsImporting(false);
      setImportStatusText("");
    }
  }

  function getImportStatusText(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "pdf") return "Đang render PDF hybrid, tạo text layer và upload ảnh trang lên Cloudinary...";
    if (extension === "doc" || extension === "docx") return "Đang chuyển Word sang HTML và upload ảnh nhúng lên Cloudinary...";
    if (extension === "md") return "Đang chuyển Markdown sang HTML và lưu vào Neon...";
    return "Đang upload và chuyển đổi tài liệu...";
  }

  async function handleCreateRequirementTagFromForm() {
    if (!newTagCode.trim() || !newTagLabel.trim() || selectedDocument.id === "empty-document") {
      addToast("warning", "Thiếu thông tin tag", "Nhập mã và nhãn truy vết trước khi lưu.");
      return;
    }
    try {
      const tag = await createRequirementTag(selectedDocument.id, {
        code: newTagCode,
        kind: newTagKind,
        label: newTagLabel,
        selectedText: selectedCommentTarget?.selectedText
      });
      setSavedTags((prev) => [tag, ...prev.filter((item) => item.id !== tag.id && item.code !== tag.code)]);
      setInferredTags((prev) => prev.filter((item) => item.code !== tag.code));
      setNewTagCode("");
      setNewTagLabel("");
      addToast("success", "Đã gắn tag", `${tag.code} đã được lưu cho tài liệu.`);
      void loadProjectCollaboration(selectedProject.id);
    } catch (error) {
      console.error("Create tag error:", error);
      addToast("error", "Không lưu được tag", "Kiểm tra quyền chỉnh sửa tài liệu rồi thử lại.");
    }
  }

  async function handleAcceptInferredTag(tag: RequirementTag) {
    try {
      const saved = await createRequirementTag(selectedDocument.id, {
        code: tag.code,
        kind: tag.kind,
        label: tag.label,
        selectedText: tag.selectedText ?? undefined
      });
      setSavedTags((prev) => [saved, ...prev.filter((item) => item.code !== saved.code)]);
      setInferredTags((prev) => prev.filter((item) => item.code !== saved.code));
      addToast("success", "Đã lưu tag suy luận", `${saved.code} đã vào danh sách truy vết.`);
      void loadProjectCollaboration(selectedProject.id);
    } catch (error) {
      console.error("Accept inferred tag error:", error);
      addToast("error", "Không lưu được tag", "Tag này chưa được lưu vào Neon.");
    }
  }

  async function handleDeleteRequirementTag(tagId: string) {
    try {
      await deleteRequirementTag(tagId);
      setSavedTags((prev) => prev.filter((tag) => tag.id !== tagId));
      addToast("info", "Đã xóa tag", "Tag truy vết đã được gỡ khỏi tài liệu.");
      void loadProjectCollaboration(selectedProject.id);
    } catch (error) {
      console.error("Delete tag error:", error);
      addToast("error", "Không xóa được tag", "Kiểm tra quyền rồi thử lại.");
    }
  }

  async function handleCreateTraceLink() {
    if (!newTraceSource.trim() || !newTraceTarget.trim()) {
      addToast("warning", "Thiếu truy vết", "Nhập mã nguồn và mã đích trước khi lưu.");
      return;
    }
    try {
      const trace = await createTraceLink(selectedProject.id, {
        sourceDocumentId: selectedDocument.id === "empty-document" ? undefined : selectedDocument.id,
        targetDocumentId: selectedDocument.id === "empty-document" ? undefined : selectedDocument.id,
        sourceCode: newTraceSource,
        sourceLabel: newTraceSource,
        targetCode: newTraceTarget,
        targetLabel: newTraceTarget,
        relation: "traces"
      });
      setTraceLinks((prev) => [trace, ...prev]);
      setNewTraceSource("");
      setNewTraceTarget("");
      addToast("success", "Đã thêm truy vết", `${trace.sourceCode} → ${trace.targetCode}`);
      void loadProjectCollaboration(selectedProject.id);
    } catch (error) {
      console.error("Create trace error:", error);
      addToast("error", "Không tạo được truy vết", "Kiểm tra quyền dự án rồi thử lại.");
    }
  }

  async function handleDeleteTraceLink(traceId: string) {
    try {
      await deleteTraceLink(traceId);
      setTraceLinks((prev) => prev.filter((trace) => trace.id !== traceId));
      addToast("info", "Đã xóa truy vết", "Liên kết truy vết đã được gỡ.");
      void loadProjectCollaboration(selectedProject.id);
    } catch (error) {
      console.error("Delete trace error:", error);
      addToast("error", "Không xóa được truy vết", "Kiểm tra quyền dự án rồi thử lại.");
    }
  }

  async function handleCreateDocumentFromTemplate(template: DocumentTemplate) {
    const targetTitle = newDocTitle.trim() || template.name;
    try {
      const document = await createDocumentFromTemplate(template.id, {
        projectId: newDocProjectId || selectedProject.id,
        title: targetTitle,
        type: newDocType || template.type
      });
      setDocumentsList((prev) => [document, ...prev]);
      setSelectedProjectId(document.projectId || selectedProject.id);
      setSelectedDocumentId(document.id);
      setIsCreateDocModalOpen(false);
      addToast("success", "Đã tạo từ mẫu", `"${document.title}" đã được tạo từ template.`);
      void loadProjectCollaboration(document.projectId || selectedProject.id);
    } catch (error) {
      console.error("Create document from template error:", error);
      addToast("error", "Không tạo được từ mẫu", "Kiểm tra quyền tạo tài liệu trong dự án.");
    }
  }

  async function handleMarkNotificationRead(notification: NotificationItem) {
    if (notification.readAt) return;
    try {
      const updated = await markNotificationRead(notification.id);
      setNotifications((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      console.error("Mark notification read error:", error);
    }
  }

  // Edit Comment Handler
  async function handleSaveEditComment(commentId: string) {
    if (!editingCommentText.trim()) return;
    try {
      const updatedComment = await updateComment(commentId, { content: editingCommentText.trim() });
      setCommentsList((prev) => prev.map((c) => (c.id === commentId ? { ...c, ...updatedComment } : c)));
      setEditingCommentId(null);
      setEditingCommentText("");
      addToast("success", "Đã cập nhật nhận xét", "Nội dung nhận xét đã được lưu vào Neon.");
    } catch (error) {
      console.error("Update comment error:", error);
      addToast("error", "Không cập nhật được nhận xét", "BE chưa lưu được thay đổi nhận xét.");
    }
  }

  async function handleResolveComment(comment: CommentThread) {
    if (comment.status === "resolved") return;
    const resolvedOpenCount = commentsList.filter(
      (item) => (item.id === comment.id || item.parentId === comment.id) && item.status === "open"
    ).length;

    try {
      const resolvedComment = await resolveComment(comment.id);
      setCommentsList((prev) =>
        prev.map((item) =>
          item.id === comment.id || item.parentId === comment.id
            ? { ...item, status: "resolved", ...(item.id === comment.id ? resolvedComment : {}) }
            : item
        )
      );
      adjustDocumentCommentCount(comment.documentId, -resolvedOpenCount);
      clearActiveCommentHighlight();
      void loadProjectCollaboration(selectedProject.id);
      addToast("success", "Đã đánh dấu hoàn thành", "Comment này đã được chuyển sang trạng thái hoàn thành.");
    } catch (error) {
      console.error("Resolve comment error:", error);
      addToast("error", "Không đánh dấu được", "BE chưa cập nhật được trạng thái comment.");
    }
  }

  // Add new comment
  async function handleAddComment() {
    if (!newCommentText.trim()) return;
    const targetBlock = selectedCommentTarget?.blockId || activeBlockId || "GENERAL";
    if (selectedDocument.id === "empty-document") {
      addToast("warning", "Chưa chọn tài liệu", "Hãy tạo hoặc import tài liệu trước khi comment.");
      return;
    }
    if (!selectedCommentTarget?.selectedText) {
      addToast("warning", "Chưa bôi đen nội dung", "Hãy bôi đen dòng hoặc đoạn trong tài liệu trước khi gửi comment.");
      return;
    }
    try {
      const newComment = await createComment({
        documentId: selectedDocument.id,
        blockId: targetBlock,
        selectedText: selectedCommentTarget.selectedText,
        content: newCommentText.trim()
      });
      setCommentsList((prev) => [newComment, ...prev]);
      adjustDocumentCommentCount(newComment.documentId, 1);
      setNewCommentText("");
      clearSelectedCommentTarget();
      void loadProjectCollaboration(selectedProject.id);
      addToast("success", "Đã thêm nhận xét", "Comment đã được lưu theo đoạn bạn bôi đen.");
    } catch (error) {
      console.error("Create comment error:", error);
      addToast("error", "Không gửi được nhận xét", "Kiểm tra BE hoặc tài liệu đang chọn.");
    }
  }

  async function handleAddReply(comment: CommentThread) {
    if (!replyText.trim()) return;

    try {
      const newReply = await createComment({
        documentId: selectedDocument.id,
        parentId: comment.id,
        blockId: comment.blockId,
        selectedText: comment.selectedText,
        content: replyText.trim()
      });
      setCommentsList((prev) => [newReply, ...prev]);
      adjustDocumentCommentCount(newReply.documentId, 1);
      setReplyText("");
      setReplyingCommentId(null);
      void loadProjectCollaboration(selectedProject.id);
      addToast("success", "Đã trả lời nhận xét", "Reply đã được lưu vào thread.");
    } catch (error) {
      console.error("Create reply error:", error);
      addToast("error", "Không gửi được reply", "Kiểm tra BE hoặc thử lại sau.");
    }
  }

  function submitTextareaOnEnter(
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
    submit: () => void | Promise<void>
  ) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    void submit();
  }

  async function handleExportDocument() {
    if (selectedDocument.id === "empty-document") {
      addToast("warning", "Chưa chọn tài liệu", "Hãy chọn một tài liệu trước khi xuất file.");
      return;
    }
    setIsExporting(true);
    try {
      await downloadExport(selectedDocument.id, exportType);
      setIsExportModalOpen(false);
      addToast("success", "Đã tạo file xuất", `Tài liệu đã được tải xuống dưới dạng ${exportType === "pdf" ? "PDF" : "Word"}.`);
    } catch (error) {
      console.error("Export document error:", error);
      addToast("error", "Không xuất được tài liệu", "Vui lòng kiểm tra quyền truy cập hoặc thử lại sau.");
    } finally {
      setIsExporting(false);
    }
  }

  // Keyboard shortcut listener for search and ESC closes the top-most popup.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("main-search")?.focus();
      }
      if (e.key !== "Escape" && e.key !== "Esc") return;

      if (isSelectionComposerOpen || selectionPopover || selectedCommentTarget) {
        e.preventDefault();
        clearSelectedCommentTarget();
        return;
      }
      if (editingCommentId || replyingCommentId) {
        e.preventDefault();
        setEditingCommentId(null);
        setEditingCommentText("");
        setReplyingCommentId(null);
        setReplyText("");
        return;
      }
      if (confirmDeleteModal.isOpen) {
        e.preventDefault();
        setConfirmDeleteModal({ isOpen: false, type: null, id: null, title: "", message: "" });
        return;
      }
      if (isLogoutConfirmOpen) {
        e.preventDefault();
        setIsLogoutConfirmOpen(false);
        return;
      }
      if (isShareModalOpen) {
        e.preventDefault();
        setIsShareModalOpen(false);
        return;
      }
      if (isExportModalOpen && !isExporting) {
        e.preventDefault();
        setIsExportModalOpen(false);
        return;
      }
      if (isImportModalOpen && !isImporting) {
        e.preventDefault();
        setIsImportModalOpen(false);
        setIsDragOver(false);
        return;
      }
      if (isEditDocModalOpen) {
        e.preventDefault();
        setIsEditDocModalOpen(false);
        return;
      }
      if (isCreateDocModalOpen) {
        e.preventDefault();
        setIsCreateDocModalOpen(false);
        return;
      }
      if (isEditProjectModalOpen) {
        e.preventDefault();
        setIsEditProjectModalOpen(false);
        return;
      }
      if (isCreateProjectModalOpen) {
        e.preventDefault();
        setIsCreateProjectModalOpen(false);
        return;
      }
      if (isActionsDropdownOpen) {
        e.preventDefault();
        setIsActionsDropdownOpen(false);
        return;
      }
      if (isTocPopoverOpen) {
        e.preventDefault();
        setIsTocPopoverOpen(false);
        return;
      }
      if (isZenMode) {
        e.preventDefault();
        setIsZenMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    confirmDeleteModal.isOpen,
    isLogoutConfirmOpen,
    editingCommentId,
    isActionsDropdownOpen,
    isCreateDocModalOpen,
    isCreateProjectModalOpen,
    isDragOver,
    isEditDocModalOpen,
    isEditProjectModalOpen,
    isExportModalOpen,
    isExporting,
    isImportModalOpen,
    isImporting,
    isSelectionComposerOpen,
    isShareModalOpen,
    isTocPopoverOpen,
    isZenMode,
    replyingCommentId,
    selectedCommentTarget,
    selectionPopover
  ]);

  const documentContainerRef = useRef<HTMLDivElement>(null);
  const inlineCommentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const activeCommentSelectionRangeRef = useRef<Range | null>(null);

  useLayoutEffect(() => {
    if (!selectedCommentTarget || !selectionPopover || isSelectionComposerOpen) return;
    restoreActiveCommentSelection();
  }, [selectedCommentTarget, selectionPopover, isSelectionComposerOpen]);

  useEffect(() => {
    let timer = 0;
    const scheduleSelectionCheck = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(handleDocumentSelection, 90);
    };

    document.addEventListener("mouseup", scheduleSelectionCheck);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mouseup", scheduleSelectionCheck);
    };
  }, [selectedDocument.id]);

  useEffect(() => {
    if (!selectedCommentTarget && !selectionPopover && !isSelectionComposerOpen) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const targetElement = target.nodeType === Node.ELEMENT_NODE ? (target as Element) : target.parentElement;
      if (targetElement?.closest(".selection-action-toolbar, .selection-comment-editor")) {
        return;
      }

      if (isPointInsideActiveSelection(event.clientX, event.clientY)) {
        return;
      }

      clearSelectedCommentTarget();
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
  }, [selectedCommentTarget, selectionPopover, isSelectionComposerOpen]);

  function renderMermaidBlocks() {
    if (!documentContainerRef.current) return;

    const nodes = Array.from(
      documentContainerRef.current.querySelectorAll<HTMLElement>(".mermaid, pre, code")
    );

    const seen = new Set<HTMLElement>();
    const targetList: { container: HTMLElement; code: string }[] = [];

    nodes.forEach((node) => {
      const pre = node.closest("pre") as HTMLElement | null;
      const codeNode = node.tagName.toLowerCase() === "code"
        ? node
        : pre?.querySelector<HTMLElement>("code");
      const container = pre ?? node;

      if (
        seen.has(container) ||
        container.getAttribute("data-mermaid-done") === "true" ||
        container.getAttribute("data-mermaid-pending") === "true"
      ) return;

      const textSource = codeNode ?? node;
      const cleanCode = normalizeMermaidCode(textSource.textContent || textSource.innerText || "");
      const className = `${node.className} ${codeNode?.className ?? ""}`;

      if (isMermaidDiagram(cleanCode, className)) {
        seen.add(container);
        targetList.push({ container, code: cleanCode });
      }
    });

    if (targetList.length === 0) return;

    targetList.forEach(({ container }) => container.setAttribute("data-mermaid-pending", "true"));

    void loadMermaidRenderer()
      .then((mermaid) => {
        targetList.forEach(({ container, code }, index) => {
          const id = `mermaid-svg-${Date.now()}-${index}-${Math.floor(Math.random() * 10000)}`;
          void mermaid
            .render(id, code)
            .then(({ svg }) => {
              container.innerHTML = svg;
              container.className = "mermaid-container";
              container.removeAttribute("data-mermaid-pending");
              container.setAttribute("data-mermaid-done", "true");
            })
            .catch((err) => {
              console.error("Mermaid rendering failed:", err, code);
              container.className = "mermaid-error";
              container.innerHTML = `<strong>Không render được sơ đồ Mermaid.</strong><pre>${escapeHtml(code)}</pre>`;
              container.removeAttribute("data-mermaid-pending");
              container.setAttribute("data-mermaid-done", "true");
              const errEl = document.getElementById(`d${id}`);
              if (errEl) errEl.remove();
            });
        });
      })
      .catch((err) => {
        console.error("Cannot load Mermaid renderer:", err);
        targetList.forEach(({ container, code }) => {
          container.className = "mermaid-error";
          container.innerHTML = `<strong>Không tải được engine Mermaid.</strong><pre>${escapeHtml(code)}</pre>`;
          container.removeAttribute("data-mermaid-pending");
          container.setAttribute("data-mermaid-done", "true");
        });
      });
  }

  // Render Mermaid diagrams whenever imported HTML mutates in the reader.
  useEffect(() => {
    let isCancelled = false;
    let raf = 0;

    const scheduleRender = () => {
      if (isCancelled) return;
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(renderMermaidBlocks);
    };

    scheduleRender();
    const retry = window.setTimeout(scheduleRender, 400);
    const observer = new MutationObserver(scheduleRender);
    if (documentContainerRef.current) {
      observer.observe(documentContainerRef.current, { childList: true, subtree: true });
    }

    return () => {
      isCancelled = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(retry);
      observer.disconnect();
    };
  }, [selectedDocument.id, selectedDocument.contentHtml, fontSize]);

  useEffect(() => {
    const root = documentContainerRef.current;
    if (!root) return;

    const classifyImages = () => {
      root.querySelectorAll<HTMLImageElement>(".html-document img:not(.pdf-page-bg)").forEach((image) => {
        image.classList.add("document-raster-image");
        const applyDiagramClass = () => {
          const { naturalWidth, naturalHeight } = image;
          if (!naturalWidth || !naturalHeight) return;
          image.style.setProperty("--image-natural-width", `${naturalWidth}px`);
          image.style.setProperty("--image-natural-height", `${naturalHeight}px`);
          image.classList.toggle("document-diagram-image", naturalWidth >= 320 && naturalHeight >= 180);
          image.classList.toggle("document-diagram-landscape", naturalWidth >= naturalHeight);
        };

        if (image.complete) {
          applyDiagramClass();
        } else {
          image.addEventListener("load", applyDiagramClass, { once: true });
        }
      });
    };

    classifyImages();
    const observer = new MutationObserver(classifyImages);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [selectedDocument.id, selectedDocument.contentHtml]);

  // Extract document headings (h1, h2, h3, h4) to generate Table of Contents (TOC)
  useEffect(() => {
    let isSubscribed = true;
    let rafId = 0;
    let timer = 0;

    const parseHeadings = () => {
      if (!selectedDocument.id || selectedDocument.id === "empty-document") {
        if (isSubscribed) setTocItems([]);
        return;
      }

      if (activeTabNav === "dashboard" || activeTabNav === "admin") return;
      if (!documentContainerRef.current) return;
      const container = documentContainerRef.current;
      const headings = container.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5");
      const items: TocItem[] = [];

      headings.forEach((heading, index) => {
        let headingId = heading.id;
        if (!headingId) {
          headingId = `doc-heading-${selectedDocument.id}-${index}`;
          heading.setAttribute("id", headingId);
        }
        const level = parseInt(heading.tagName.replace("H", ""), 10) || 1;
        const text = heading.textContent?.trim() || `Mục ${index + 1}`;
        items.push({ id: headingId, index, text, level });
      });

      if (isSubscribed) {
        setTocItems(items);
      }
    };

    rafId = window.requestAnimationFrame(parseHeadings);
    timer = window.setTimeout(parseHeadings, 300);

    return () => {
      isSubscribed = false;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timer);
    };
  }, [activeTabNav, selectedDocument.id, selectedDocument.contentHtml]);

  // Smooth scroll and focus target heading in reader
  const scrollToHeading = (item: TocItem) => {
    setActiveTocId(item.id);
    setIsTocPopoverOpen(false);

    if (!documentContainerRef.current) return;
    const container = documentContainerRef.current;
    const headings = container.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5");

    let targetHeading: HTMLElement | null = document.getElementById(item.id) || headings[item.index] || null;

    if (!targetHeading && item.text) {
      headings.forEach((h) => {
        if (h.textContent?.trim() === item.text) {
          targetHeading = h;
        }
      });
    }

    if (targetHeading) {
      targetHeading.setAttribute("id", item.id);
      const isPdfHeading = targetHeading.classList.contains("pdf-page-heading");
      const pdfTextTarget = isPdfHeading ? findPdfTocTextTarget(targetHeading, item.text) : null;
      const targetElement = pdfTextTarget ?? targetHeading;
      const pulseElement = isPdfHeading
        ? targetHeading.closest<HTMLElement>(".pdf-hybrid-page") ?? targetHeading
        : targetHeading;
      const docPage = (targetElement.closest(".doc-page") || container.closest(".doc-page")) as HTMLElement | null;

      if (docPage) {
        const elTop = targetElement.getBoundingClientRect().top;
        const docPageTop = docPage.getBoundingClientRect().top;
        const targetScrollTop = docPage.scrollTop + (elTop - docPageTop) - 24;

        docPage.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: "smooth"
        });
      } else {
        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      pulseElement.classList.remove("heading-focus-pulse");
      void pulseElement.offsetWidth;
      pulseElement.classList.add("heading-focus-pulse");

      setTimeout(() => {
        pulseElement?.classList.remove("heading-focus-pulse");
      }, 2500);
    }
  };

  function findPdfTocTextTarget(targetHeading: HTMLElement, tocText: string) {
    const pdfPage = targetHeading.closest<HTMLElement>(".pdf-hybrid-page");
    if (!pdfPage) return null;

    const normalizedTocText = normalizePdfLookupText(tocText);
    if (!normalizedTocText) return null;

    const textItems = Array.from(pdfPage.querySelectorAll<HTMLElement>(".pdf-text-item"));
    const singleMatch = textItems.find((item) => {
      const text = normalizePdfLookupText(item.textContent ?? "");
      return text && (text.includes(normalizedTocText) || normalizedTocText.includes(text));
    });
    if (singleMatch) return singleMatch;

    for (let start = 0; start < textItems.length; start += 1) {
      let combined = "";
      for (let end = start; end < Math.min(textItems.length, start + 10); end += 1) {
        combined = normalizePdfLookupText(`${combined} ${textItems[end].textContent ?? ""}`);
        if (combined.includes(normalizedTocText)) {
          return textItems[start];
        }
      }
    }

    return null;
  }

  function normalizePdfLookupText(value: string) {
    return value
      .replace(/\s+/g, " ")
      .replace(/[.\-–—:]+$/g, "")
      .trim()
      .toLowerCase();
  }

  function normalizeMermaidCode(value: string) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value
      .replace(/^\s*```mermaid\s*/i, "")
      .replace(/^\s*```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }

  function isMermaidDiagram(code: string, className: string) {
    return (
      /\b(language-mermaid|mermaid)\b/i.test(className) ||
      /^(graph|flowchart|sequenceDiagram|gantt|classDiagram|classDiagram-v2|stateDiagram-v2|stateDiagram|erDiagram|journey|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4Context)\b/i.test(code) ||
      /^subgraph\b/i.test(code)
    );
  }

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Compute counts for navigation badges
  const openCommentsTotalCount = useMemo(() => {
    return documentsList.reduce(
      (total, document) => total + (documentCommentCounts[document.id] ?? document.openCommentsCount ?? 0),
      0
    );
  }, [documentCommentCounts, documentsList]);

  const docOpenCommentsCount = useMemo(() => {
    return documentCommentCounts[selectedDocument.id] ?? selectedDocument.openCommentsCount ?? 0;
  }, [documentCommentCounts, selectedDocument]);

  function getProjectOpenCommentsCount(projectId: string) {
    return documentsList
      .filter((document) => document.projectId === projectId)
      .reduce((total, document) => total + (documentCommentCounts[document.id] ?? document.openCommentsCount ?? 0), 0);
  }

  function getDocumentPreviewText(html?: string) {
    const text = normalizeVietnameseText((html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (!text) return "Chưa có nội dung xem nhanh.";
    return text.length > 130 ? `${text.slice(0, 130).trim()}...` : text;
  }

  function activityLabel(action: string) {
    const labels: Record<string, string> = {
      PROJECT_CREATED: "Tạo dự án",
      PROJECT_UPDATED: "Cập nhật dự án",
      PROJECT_DELETED: "Xóa dự án",
      DOCUMENT_CREATED: "Tạo tài liệu",
      DOCUMENT_UPDATED: "Cập nhật tài liệu",
      DOCUMENT_DELETED: "Xóa tài liệu",
      DOCUMENT_IMPORTED: "Import tài liệu",
      DOCUMENT_REIMPORTED: "Re-import tài liệu",
      DOCUMENT_CREATED_FROM_TEMPLATE: "Tạo tài liệu từ mẫu",
      COMMENT_CREATED: "Thêm nhận xét",
      COMMENT_REPLIED: "Trả lời nhận xét",
      COMMENT_UPDATED: "Sửa nhận xét",
      COMMENT_RESOLVED: "Hoàn thành nhận xét",
      COMMENT_DELETED: "Xóa nhận xét",
      TAG_UPSERTED: "Gắn tag truy vết",
      TAG_DELETED: "Xóa tag truy vết",
      TRACE_CREATED: "Tạo liên kết truy vết",
      TRACE_DELETED: "Xóa liên kết truy vết",
      TEMPLATE_CREATED: "Tạo template"
    };
    return labels[action] ?? action.replace(/_/g, " ").toLowerCase();
  }

  function roleDashboardMetrics() {
    const totals = roleDashboard?.totals;
    if (currentUser?.role === "EMPLOYEE") {
      return [
        ["Tài liệu", totals?.documents ?? documentsList.length, FileText, "emerald", "Trong phạm vi phân quyền"],
        ["Comment mở", totals?.openComments ?? openCommentsTotalCount, MessageSquareText, "amber", "Cần trao đổi & xử lý"],
        ["Comment của tôi", totals?.myOpenComments ?? 0, UserCheck, "indigo", "Do bạn khởi tạo/phản hồi"],
        ["Thông báo mới", totals?.unreadNotifications ?? 0, Bell, "violet", "Cập nhật cần chú ý"],
        ["Triển khai", totals?.deployedDocuments ?? documentsList.filter((doc) => doc.status === "Triển khai").length, File, "sky", "Tài liệu đã chuyển triển khai"],
        ["Phiên bản", totals?.versions ?? 0, Layers, "rose", "Lịch sử cập nhật"]
      ] as const;
    }

    return [
      ["Dự án", totals?.projects ?? projectsList.length, FolderKanban, "indigo", "Dự án đang vận hành"],
      ["Tài liệu", totals?.documents ?? documentsList.length, FileText, "emerald", "Tổng số tài liệu"],
      ["Cần xử lý", totals?.openComments ?? openCommentsTotalCount, MessageSquareText, "amber", "Comment chưa hoàn thành"],
      ["Luồng đang mở", totals?.openCommentThreads ?? totals?.openComments ?? openCommentsTotalCount, Clock, "violet", "Trao đổi chưa hoàn thành"],
      ["Dự án có trao đổi", totals?.projectsWithOpenComments ?? 0, MessageSquarePlus, "rose", "Có comment đang mở"],
      ["Triển khai", totals?.deployedDocuments ?? documentsList.filter((doc) => doc.status === "Triển khai").length, UploadCloud, "sky", "Tài liệu đã chuyển triển khai"]
    ] as const;
  }

  function dashboardChartData() {
    const totals = roleDashboard?.totals;
    const projectCount = totals?.projects ?? projectsList.length;
    const totalDocuments = totals?.documents ?? documentsList.length;
    const draftDocuments = totals?.draftDocuments ?? documentsList.filter((doc) => doc.status === "Draft").length;
    const deployedDocuments = totals?.deployedDocuments ?? documentsList.filter((doc) => doc.status === "Triển khai").length;
    const otherDocuments = Math.max(totalDocuments - draftDocuments - deployedDocuments, 0);
    const maxDocumentBucket = Math.max(draftDocuments, deployedDocuments, otherDocuments, 1);
    const deploymentRate = totalDocuments ? Math.round((deployedDocuments / totalDocuments) * 100) : 0;

    return {
      projectCount,
      totalDocuments,
      draftDocuments,
      deployedDocuments,
      otherDocuments,
      maxDocumentBucket,
      deploymentRate,
      openComments: totals?.openComments ?? openCommentsTotalCount,
      openThreads: totals?.openCommentThreads ?? totals?.openComments ?? openCommentsTotalCount,
      projectsWithOpenComments: totals?.projectsWithOpenComments ?? projectsList.filter((project) => getProjectOpenCommentsCount(project.id) > 0).length,
      versions: totals?.versions ?? 0,
      importJobs: totals?.importJobs ?? 0
    };
  }

  function dashboardAttentionRows() {
    const projects = roleDashboard?.projectBreakdown ?? projectsList.map((project) => ({
      id: project.id,
      code: project.code,
      name: project.name,
      client: project.client,
      documents: documentsList.filter((doc) => doc.projectId === project.id).length,
      openComments: getProjectOpenCommentsCount(project.id),
      tags: 0,
      traces: 0,
      members: 0,
      updatedAt: ""
    }));

    return projects
      .map((project) => {
        const projectDocs = documentsList.filter((doc) => doc.projectId === project.id);
        const draftDocuments = projectDocs.filter((doc) => doc.status === "Draft").length;
        const deployedDocuments = projectDocs.filter((doc) => doc.status === "Triển khai").length;
        const openComments = project.openComments ?? getProjectOpenCommentsCount(project.id);
        const attentionScore = openComments * 3 + draftDocuments * 2 + (project.documents === 0 ? 1 : 0);

        return {
          ...project,
          draftDocuments,
          deployedDocuments,
          openComments,
          attentionScore,
          signal: openComments > 0 ? "Đang trao đổi" : draftDocuments > 0 ? "Còn Draft" : "Ổn định"
        };
      })
      .sort((first, second) => second.attentionScore - first.attentionScore || second.openComments - first.openComments || second.draftDocuments - first.draftDocuments);
  }

  function parseDashboardDate(value?: string | Date | null) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isSameMonth(date: Date | null) {
    if (!date) return false;
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  function relativeDashboardTime(value?: string | Date | null) {
    const date = parseDashboardDate(value);
    if (!date) return "Chưa có cập nhật";
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.max(Math.floor(diffMs / 60000), 0);
    if (minutes < 1) return "Vừa xong";
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} ngày trước`;
    return date.toLocaleDateString("vi-VN");
  }

  function dashboardDocumentsSource() {
    const recent = roleDashboard?.recentDocuments ?? [];
    if (recent.length > 0) {
      return recent.map((document) => ({
        id: document.id,
        title: normalizeVietnameseText(document.title),
        type: document.type,
        projectId: document.projectId,
        projectCode: document.projectCode,
        projectName: document.projectName,
        version: document.currentVersion,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt
      }));
    }

    return documentsList.map((document) => {
      const project = projectsList.find((item) => item.id === document.projectId);
      return {
        id: document.id,
        title: normalizeVietnameseText(document.title),
        type: document.type,
        projectId: document.projectId ?? "",
        projectCode: project?.code ?? "",
        projectName: project?.name ?? "",
        version: document.version,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt
      };
    });
  }

  function executiveDashboardData() {
    const totals = roleDashboard?.totals;
    const projects = roleDashboard?.projectBreakdown ?? projectsList.map((project) => ({
      id: project.id,
      code: project.code,
      name: project.name,
      client: project.client,
      documents: documentsList.filter((doc) => doc.projectId === project.id).length,
      openComments: getProjectOpenCommentsCount(project.id),
      tags: 0,
      traces: 0,
      members: 0,
      updatedAt: ""
    }));
    const documents = dashboardDocumentsSource();
    const projectCount = totals?.projects ?? projects.length;
    const totalDocuments = totals?.documents ?? documentsList.length;
    const activeProjects = projects.filter((project) => {
      const updatedAt = parseDashboardDate(project.updatedAt);
      return project.openComments > 0 || isSameMonth(updatedAt);
    }).length;
    const createdThisMonth = totals?.documentsCreatedThisMonth ?? documents.filter((document) => isSameMonth(parseDashboardDate(document.createdAt))).length;
    const updatedThisMonth = totals?.documentsUpdatedThisMonth ?? documents.filter((document) => isSameMonth(parseDashboardDate(document.updatedAt))).length;
    const maxProjectDocuments = Math.max(...projects.map((project) => project.documents), 1);

    const projectRows = [...projects]
      .sort((first, second) => second.documents - first.documents || new Date(String(second.updatedAt)).getTime() - new Date(String(first.updatedAt)).getTime())
      .map((project) => {
        const updatedAt = parseDashboardDate(project.updatedAt);
        const inactiveDays = updatedAt ? Math.max(Math.floor((Date.now() - updatedAt.getTime()) / 86400000), 0) : null;
        return {
          ...project,
          inactiveDays,
          width: Math.max((project.documents / maxProjectDocuments) * 100, project.documents > 0 ? 8 : 0)
        };
      });

    const recentDocuments = [...documents]
      .sort((first, second) => (parseDashboardDate(second.updatedAt)?.getTime() ?? 0) - (parseDashboardDate(first.updatedAt)?.getTime() ?? 0))
      .slice(0, 6);

    const recentActivity = (roleDashboard?.recentActivity ?? []).slice(0, 8);
    const activitySeries = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      date.setHours(0, 0, 0, 0);
      const next = new Date(date);
      next.setDate(date.getDate() + 1);
      const activityCount = recentActivity.filter((item) => {
        const createdAt = parseDashboardDate(item.createdAt);
        return createdAt ? createdAt >= date && createdAt < next : false;
      }).length;
      const documentCount = documents.filter((document) => {
        const updatedAt = parseDashboardDate(document.updatedAt);
        return updatedAt ? updatedAt >= date && updatedAt < next : false;
      }).length;

      return {
        label: date.toLocaleDateString("vi-VN", { weekday: "short" }).replace("Th ", "T"),
        value: activityCount + documentCount
      };
    });
    const maxActivity = Math.max(...activitySeries.map((item) => item.value), 1);

    return {
      projectCount,
      activeProjects,
      totalDocuments,
      createdThisMonth,
      updatedThisMonth,
      projectRows,
      recentDocuments,
      recentActivity,
      activitySeries,
      maxActivity
    };
  }

  function activityDashboardText(log: ActivityLog) {
    const metadata = log.metadata ?? {};
    const title = typeof metadata.title === "string" ? metadata.title : undefined;
    const projectName = typeof metadata.name === "string" ? metadata.name : undefined;
    const projectCode = typeof metadata.code === "string" ? metadata.code : undefined;
    const actor = log.actor?.name ?? log.actor?.email ?? "Người dùng";
    const target = title ?? projectName ?? projectCode ?? "tài liệu";
    return `${actor} ${activityLabel(log.action).toLowerCase()} ${normalizeVietnameseText(target)}`;
  }

  // Compute grid layout class name
  const gridLayoutClass = useMemo(() => {
    let base = "work-grid";
    if (activeTabNav === "review") base += " review-mode";
    if (isZenMode) base += " zen-mode";
    if (!showLibraryPanel && !showCommentsPanel) return `${base} hide-both`;
    if (!showLibraryPanel) return `${base} hide-library`;
    if (!showCommentsPanel) return `${base} hide-comments`;
    return base;
  }, [activeTabNav, isZenMode, showLibraryPanel, showCommentsPanel]);

  if (!currentUser) {
    return (
      <AuthPage
        onSuccess={(user) => {
          setCurrentUser(user);
          addToast("success", "Đăng nhập thành công", `Chào mừng ${user.name} quay trở lại hệ thống!`);
        }}
      />
    );
  }

  return (
    <main className={`${isZenMode ? "app-shell zen-mode" : "app-shell"} ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <button
            className="sidebar-logo-button"
            type="button"
            title={isSidebarCollapsed ? "Mở rộng thanh menu" : "DocSpace"}
            aria-label={isSidebarCollapsed ? "Mở rộng thanh menu" : "DocSpace"}
            data-tooltip="DocSpace"
            onClick={() => {
              if (isSidebarCollapsed) toggleSidebar();
            }}
          >
            <img src="/logo.png" alt="DocSpace" className="sidebar-logo-img" />
          </button>
          <div className="brand-info">
            <strong>DocSpace</strong>
            <small>Quản Lý Tài Liệu BA</small>
          </div>
          <button
            className="sidebar-toggle-btn"
            type="button"
            title={isSidebarCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
            aria-label={isSidebarCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
            aria-expanded={!isSidebarCollapsed}
            data-tooltip={isSidebarCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
            onClick={toggleSidebar}
          >
            {isSidebarCollapsed ? <PanelRightOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        <div className="sidebar-main-nav">
          <div className="nav-section-title">Danh mục</div>
          <nav className="nav-list" aria-label="Project navigation">
            <button
              className={activeTabNav === "dashboard" ? "nav-item active" : "nav-item"}
              type="button"
              title="Dashboard"
              data-tooltip="Dashboard"
              onClick={() => setActiveTabNav("dashboard")}
            >
              <div className="nav-item-content">
                <LayoutDashboard size={17} />
                <span>Dashboard</span>
              </div>
              {roleDashboard?.totals.unreadNotifications ? (
                <span className="nav-badge">{roleDashboard.totals.unreadNotifications}</span>
              ) : null}
            </button>

            <button
              className={activeTabNav === "projects" ? "nav-item active" : "nav-item"}
              type="button"
              title={`Dự án (${isLoadingBackend ? "..." : projectsList.length})`}
              data-tooltip={`Dự án (${projectsList.length})`}
              onClick={() => setActiveTabNav("projects")}
            >
              <div className="nav-item-content">
                <FolderKanban size={17} />
                <span>Dự án ({isLoadingBackend ? "..." : projectsList.length})</span>
              </div>
            </button>

            <button
              className={activeTabNav === "review" ? "nav-item active" : "nav-item"}
              type="button"
              title="Ghi chú & Review"
              data-tooltip="Ghi chú & Review"
              onClick={() => setActiveTabNav("review")}
            >
              <div className="nav-item-content">
                <MessageSquareText size={17} />
                <span>Ghi chú & Review</span>
              </div>
              <span className="nav-badge">{openCommentsTotalCount}</span>
            </button>

            {(currentUser.role === "ADMIN" || currentUser.role === "MANAGER") && (
              <button
                className={activeTabNav === "admin" ? "nav-item active" : "nav-item"}
                type="button"
                title="Quản trị user"
                data-tooltip="Quản trị user"
                onClick={() => setActiveTabNav("admin")}
              >
                <div className="nav-item-content">
                  <Users size={17} />
                  <span>Quản trị user</span>
                </div>
              </button>
            )}
          </nav>
        </div>

        <div className="sidebar-projects-section">
          <div className="nav-section-title">
            <span>Danh sách Dự án</span>
            <button
              className="btn-add-mini"
              type="button"
              title="Tạo dự án mới"
              onClick={() => setIsCreateProjectModalOpen(true)}
            >
              <FolderPlus size={13} /> Tạo mới
            </button>
          </div>

          {/* Project List with Edit & Delete Action Buttons */}
          <section className="project-list" aria-label="Projects">
            {projectsList.map((project) => {
              const projectOpenComments = getProjectOpenCommentsCount(project.id);

              return (
                <div
                  key={project.id}
                  className={project.id === selectedProjectId && activeTabNav === "projects" ? "project-card selected" : "project-card"}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectProject(project.id)}
                  onKeyDown={(event) => handleProjectCardKeyDown(event, project.id)}
                >
                  <div className="project-card-header">
                    <span className="project-code">{project.code}</span>
                    <div className="project-action-group">
                      <button
                        className="project-action-btn"
                        type="button"
                        title="Sửa thông tin dự án"
                        onClick={(e) => openEditProjectModal(project, e)}
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        className="project-action-btn danger"
                        type="button"
                        title="Xóa dự án này"
                        onClick={(e) => requestDeleteProject(project.id, e)}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  <strong>{project.name}</strong>
                  <div className="project-card-meta">
                    <span>
                      {documentsList.filter((d) => d.projectId === project.id).length} tài liệu
                    </span>
                    {projectOpenComments > 0 && <span>{projectOpenComments} trao đổi</span>}
                  </div>
                </div>
              );
            })}
          </section>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile">
            <button
              className="sidebar-avatar-logout"
              type="button"
              title={isSidebarCollapsed ? "Đăng xuất khỏi tài khoản" : currentUser.name}
              aria-label={isSidebarCollapsed ? "Đăng xuất khỏi tài khoản" : currentUser.name}
              onClick={() => {
                if (isSidebarCollapsed) setIsLogoutConfirmOpen(true);
              }}
            >
              <img
                src={currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                alt={currentUser.name}
              />
            </button>
            <div className="user-info" title={`${currentUser.name} (${currentUser.role === "ADMIN" ? "Admin" : currentUser.role === "MANAGER" ? "Manager" : "Nhân viên"})`}>
              <strong title={currentUser.name}>{currentUser.name}</strong>
              <small style={{ color: "var(--accent-primary)", fontWeight: 500 }}>
                {currentUser.role === "ADMIN" ? "Admin" : currentUser.role === "MANAGER" ? "Manager" : "Nhân viên"}
              </small>
            </div>
            <div className="user-actions-btns">
              <button
                type="button"
                className="logout-icon-btn"
                title="Đăng xuất khỏi tài khoản"
                onClick={() => setIsLogoutConfirmOpen(true)}
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </div>

      </aside>

      {/* Main Workspace */}
      <section className="workspace">
        {/* Compact Topbar Header */}
        <header className="topbar">
          <div className="topbar-title-area">
            <p className="eyebrow">
              {activeTabNav === "dashboard"
                ? `${currentUser.role === "ADMIN" ? "Admin" : currentUser.role === "MANAGER" ? "Manager" : "Nhân viên"} • ${roleDashboard?.scopeLabel ?? "Dashboard"}`
                : activeTabNav === "admin" && (currentUser.role === "ADMIN" || currentUser.role === "MANAGER")
                ? "Quản trị hệ thống • Users & Permissions"
                : activeTabNav === "review"
                  ? "Trao đổi tài liệu • Ghi chú & Review"
                  : `${selectedProject.code} / ${selectedProject.client}`}
            </p>
            <h1>
              {activeTabNav === "dashboard"
                ? "Dashboard điều hành"
                : activeTabNav === "admin" && (currentUser.role === "ADMIN" || currentUser.role === "MANAGER")
                ? "Quản Lý User & Phân Quyền"
                : activeTabNav === "review"
                  ? "Trao Đổi & Ghi Chú"
                  : selectedProject.name}
            </h1>
          </div>

          {activeTabNav === "dashboard" && (
            <div className="topbar-actions">
              {(currentUser.role === "ADMIN" || currentUser.role === "MANAGER") && (
                <button className="exec-action primary" type="button" onClick={() => setIsCreateProjectModalOpen(true)}>
                  <Plus size={15} /> Tạo dự án mới
                </button>
              )}
              <button className="exec-action secondary" type="button" onClick={() => void loadRoleDashboard()}>
                <BarChart2 size={15} /> Làm mới
              </button>
            </div>
          )}

          {activeTabNav !== "admin" && activeTabNav !== "dashboard" && (
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={15} />
              <input
                id="main-search"
                placeholder="Tìm tài liệu, comment, tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (advancedSearchResults) setIsAdvancedSearchOpen(true);
                }}
              />
              <span className="kbd-shortcut">{searchShortcutLabel}</span>
            </label>

            {isAdvancedSearchOpen && advancedSearchResults && (
              <div className="advanced-search-popover">
                <div className="advanced-search-header">
                  <strong>Kết quả tìm kiếm</strong>
                  <button type="button" onClick={() => setIsAdvancedSearchOpen(false)}><X size={13} /></button>
                </div>
                <div className="advanced-search-group">
                  <span>Tài liệu</span>
                  {advancedSearchResults.documents.length === 0 ? (
                    <small>Không có tài liệu phù hợp.</small>
                  ) : advancedSearchResults.documents.slice(0, 5).map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => {
                        setSelectedDocumentId(result.id);
                        setIsAdvancedSearchOpen(false);
                      }}
                    >
                      <FileText size={13} />
                      <span>
                        <strong>{normalizeVietnameseText(result.title)}</strong>
                        <small>{result.snippet}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="advanced-search-group">
                  <span>Comment & Tag</span>
                  {[...advancedSearchResults.comments.slice(0, 4).map((comment) => ({
                    id: comment.id,
                    documentId: comment.documentId,
                    icon: <MessageSquareText size={13} />,
                    title: comment.document?.title || comment.blockId,
                    text: comment.selectedText || comment.content
                  })), ...advancedSearchResults.tags.slice(0, 4).map((tag) => ({
                    id: tag.id,
                    documentId: tag.documentId,
                    icon: <Tags size={13} />,
                    title: tag.code,
                    text: tag.label
                  }))].map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => {
                        setSelectedDocumentId(result.documentId);
                        setIsAdvancedSearchOpen(false);
                      }}
                    >
                      {result.icon}
                      <span>
                        <strong>{normalizeVietnameseText(result.title)}</strong>
                        <small>{result.text}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}





            <button
              className="icon-btn"
              type="button"
              title="Import file vào dự án"
              disabled={!selectedProjectId}
              onClick={() => {
                setImportTargetProjectId(selectedProjectId);
                setIsImportModalOpen(true);
              }}
            >
              <UploadCloud size={15} /> Import File
            </button>
          </div>
          )}
        </header>



        {activeTabNav === "dashboard" ? (
          <section className="role-dashboard-page executive-dashboard">
            <div className="exec-kpi-grid">
              {[
                ["Tổng Project", executiveDashboardData().projectCount, "Quy mô dự án"],
                ["Project active", executiveDashboardData().activeProjects, "Còn phát sinh hoạt động"],
                ["Tổng tài liệu", executiveDashboardData().totalDocuments, "Quy mô kho tài liệu"],
                ["Mới tháng này", `+${executiveDashboardData().createdThisMonth}`, "Tài liệu vừa bổ sung"],
                ["Cập nhật tháng này", executiveDashboardData().updatedThisMonth, "Mức độ duy trì"]
              ].map(([label, value, note]) => (
                <div className="exec-kpi-card" key={String(label)}>
                  <strong>{String(value)}</strong>
                  <span>{String(label)}</span>
                  <small>{String(note)}</small>
                </div>
              ))}
            </div>

            <div className="exec-main-grid">
              <section className="exec-panel project-volume">
                <div className="exec-panel-header">
                  <div>
                    <span>Theo Project</span>
                    <h3>Tài liệu theo Project</h3>
                  </div>
                  <strong>{executiveDashboardData().projectRows.length} project</strong>
                </div>
                <div className="exec-project-bars">
                  {executiveDashboardData().projectRows.slice(0, 8).map((project) => (
                    <button className="exec-project-bar-row" type="button" key={project.id} onClick={() => handleSelectProject(project.id)}>
                      <div className="project-bar-label">
                        <strong>{project.name}</strong>
                        <small>{project.members} thành viên · {relativeDashboardTime(project.updatedAt)}</small>
                      </div>
                      <div className="project-bar-track">
                        <span style={{ width: `${project.width}%` }}></span>
                      </div>
                      <b>{project.documents}</b>
                    </button>
                  ))}
                </div>
              </section>

              <section className="exec-panel activity-chart">
                <div className="exec-panel-header">
                  <div>
                    <span>Hoạt động</span>
                    <h3>Hoạt động tài liệu theo thời gian</h3>
                  </div>
                  <strong>7 ngày</strong>
                </div>
                <div className="exec-activity-bars">
                  {executiveDashboardData().activitySeries.map((item) => (
                    <div className="activity-bar-column" key={item.label}>
                      <div className="activity-bar-track">
                        <span style={{ height: `${Math.max((item.value / executiveDashboardData().maxActivity) * 100, item.value > 0 ? 8 : 0)}%` }}></span>
                      </div>
                      <strong>{item.value}</strong>
                      <small>{item.label}</small>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="exec-secondary-grid">
              <section className="exec-panel recent-projects">
                <div className="exec-panel-header">
                  <div>
                    <span>Project</span>
                    <h3>Project gần đây</h3>
                  </div>
                  <strong>Cập nhật</strong>
                </div>
                <div className="exec-compact-list">
                  {executiveDashboardData().projectRows
                    .sort((first, second) => (parseDashboardDate(second.updatedAt)?.getTime() ?? 0) - (parseDashboardDate(first.updatedAt)?.getTime() ?? 0))
                    .slice(0, 5)
                    .map((project) => (
                      <button type="button" key={project.id} onClick={() => handleSelectProject(project.id)}>
                        <span className="ops-code-chip">{project.code}</span>
                        <strong>{project.name}</strong>
                        <small>{relativeDashboardTime(project.updatedAt)}</small>
                      </button>
                    ))}
                </div>
              </section>

              <section className="exec-panel recent-docs">
                <div className="exec-panel-header">
                  <div>
                    <span>Tài liệu</span>
                    <h3>Tài liệu gần đây</h3>
                  </div>
                  <strong>{executiveDashboardData().recentDocuments.length} file</strong>
                </div>
                <div className="exec-compact-list docs">
                  {executiveDashboardData().recentDocuments.map((document) => (
                    <button
                      type="button"
                      key={document.id}
                      onClick={() => {
                        setSelectedProjectId(document.projectId);
                        setSelectedDocumentId(document.id);
                        setActiveTabNav("projects");
                      }}
                    >
                      <FileText size={14} />
                      <strong>{document.title}</strong>
                      <small>{document.projectCode} · {relativeDashboardTime(document.updatedAt)}</small>
                    </button>
                  ))}
                </div>
              </section>

              <section className="exec-panel quiet-projects">
                <div className="exec-panel-header">
                  <div>
                    <span>Theo dõi</span>
                    <h3>Project ít hoạt động</h3>
                  </div>
                  <strong>Không phải rủi ro</strong>
                </div>
                <div className="exec-compact-list quiet">
                  {executiveDashboardData().projectRows
                    .filter((project) => project.inactiveDays !== null)
                    .sort((first, second) => (second.inactiveDays ?? 0) - (first.inactiveDays ?? 0))
                    .slice(0, 4)
                    .map((project) => (
                      <button type="button" key={project.id} onClick={() => handleSelectProject(project.id)}>
                        <span className={(project.inactiveDays ?? 0) >= 30 ? "quiet-dot high" : "quiet-dot"}></span>
                        <strong>{project.name}</strong>
                        <small>{project.inactiveDays} ngày không cập nhật</small>
                      </button>
                    ))}
                </div>
              </section>
            </div>

            <section className="exec-panel activity-feed-panel">
              <div className="exec-panel-header">
                <div>
                  <span>Activity Feed</span>
                  <h3>Hoạt động gần đây</h3>
                </div>
                <strong>{executiveDashboardData().recentActivity.length} hoạt động</strong>
              </div>
              <div className="exec-activity-feed">
                {executiveDashboardData().recentActivity.map((log) => (
                  <div className="exec-feed-row" key={log.id}>
                    <time>{parseDashboardDate(log.createdAt)?.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</time>
                    <strong>{activityDashboardText(log)}</strong>
                    <span>{relativeDashboardTime(log.createdAt)}</span>
                  </div>
                ))}
                {executiveDashboardData().recentActivity.length === 0 && (
                  <div className="empty-collab-state">Chưa có hoạt động tài liệu gần đây.</div>
                )}
              </div>
            </section>
          </section>
        ) : activeTabNav === "admin" ? (
          <Suspense fallback={<div className="content-loading">Đang tải quản trị user...</div>}>
            <AdminPanel projects={projectsList} documents={documentsList} currentUser={currentUser} onToast={addToast} />
          </Suspense>
        ) : (
        <section className={gridLayoutClass}>
          {/* Panel 1: Document Library (Collapsible) */}
          {showLibraryPanel && (
            <div className="panel library">
              <div className="panel-header">
                <div className="panel-title">
                  <p className="eyebrow">
                    {activeTabNav === "review"
                      ? "Luồng trao đổi"
                      : `Thư viện • ${selectedProject.code}`}
                  </p>
                  <h2>{activeTabNav === "review" ? "Luồng review" : "Tài liệu"} ({filteredDocuments.length})</h2>
                </div>
                <div className="panel-action-group">
                  {activeTabNav !== "review" && (
                    <button
                      className="btn-add-mini"
                      type="button"
                      title="Import tệp tài liệu vào dự án"
                      disabled={!selectedProjectId}
                      onClick={() => {
                        setImportTargetProjectId(selectedProjectId);
                        setIsImportModalOpen(true);
                      }}
                    >
                      <UploadCloud size={12} /> Import File
                    </button>
                  )}
                  <button
                    className="panel-close-btn"
                    type="button"
                    title="Thu gọn danh sách tài liệu"
                    onClick={() => setShowLibraryPanel(false)}
                  >
                    <PanelLeftClose size={14} />
                  </button>
                </div>
              </div>

              {activeTabNav !== "review" && (
                <div className="panel-mode-tabs">
                  <button
                    className={leftPanelMode === "docs" ? "mode-tab active" : "mode-tab"}
                    type="button"
                    onClick={() => setLeftPanelMode("docs")}
                  >
                    <FileText size={12} /> Tài liệu ({filteredDocuments.length})
                  </button>
                  <button
                    className={leftPanelMode === "toc" ? "mode-tab active" : "mode-tab"}
                    type="button"
                    onClick={() => setLeftPanelMode("toc")}
                  >
                    <ListTree size={12} /> Mục lục ({selectedDocument.id === "empty-document" ? 0 : tocItems.length})
                  </button>
                </div>
              )}

              {activeTabNav === "review" || leftPanelMode === "docs" ? (
                <>
                  {activeTabNav === "review" ? (
                    <div className="review-inbox-strip">
                      <MessageSquareText size={13} />
                      <span>Chỉ hiển thị tài liệu đang có trao đổi mở.</span>
                    </div>
                  ) : (
                    <div className="library-filter-tabs">
                      {(["All", "Draft", "Triển khai"] as const).map((tab) => (
                        <button
                          key={tab}
                          className={statusFilter === tab ? "tab-btn active" : "tab-btn"}
                          type="button"
                          onClick={() => setStatusFilter(tab)}
                        >
                          {tab === "All" ? "Tất cả" : tab}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Documents List */}
                  <div className="document-table">
                    {filteredDocuments.length === 0 ? (
                      <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: "0.78rem" }}>
                        {activeTabNav === "review"
                          ? "Không có tài liệu nào đang có trao đổi mở."
                          : "Không có tài liệu nào phù hợp."}
                      </div>
                    ) : (
                      filteredDocuments.map((doc) => {
                        const docCommentsCount = documentCommentCounts[doc.id] ?? doc.openCommentsCount ?? 0;
                        const fullTitle = normalizeVietnameseText(doc.title);
                        const docProject = projectsList.find((project) => project.id === doc.projectId);
                        if (activeTabNav === "review") {
                          return (
                            <button
                              key={doc.id}
                              className={doc.id === selectedDocumentId ? "review-thread-card selected" : "review-thread-card"}
                              type="button"
                              title={fullTitle}
                              onClick={() => {
                                if (doc.projectId) setSelectedProjectId(doc.projectId);
                                setSelectedDocumentId(doc.id);
                                setCommentFilter("all");
                              }}
                            >
                              <div className="review-thread-head">
                                <span className="review-thread-state">
                                  <MessageSquareText size={12} /> Đang mở
                                </span>
                                <span className="review-thread-count">{docCommentsCount} trao đổi</span>
                              </div>
                              <strong>{fullTitle}</strong>
                              <p>{getDocumentPreviewText(doc.contentHtml)}</p>
                              <div className="review-thread-meta">
                                <span>{docProject?.code ?? "Dự án"} • {doc.type}</span>
                                <span>{doc.updatedAt}</span>
                              </div>
                            </button>
                          );
                        }
                        return (
                          <button
                            key={doc.id}
                            className={doc.id === selectedDocumentId ? "document-row selected" : "document-row"}
                            type="button"
                            title={fullTitle}
                            onClick={() => {
                              if (doc.projectId) setSelectedProjectId(doc.projectId);
                              setSelectedDocumentId(doc.id);
                            }}
                          >
                            <div className="doc-icon">
                              {doc.fileType === "pdf" ? (
                                <FileText size={16} />
                              ) : doc.fileType === "md" ? (
                                <FileCode size={16} />
                              ) : (
                                <FileCheck2 size={16} />
                              )}
                            </div>
                            <div className="doc-info">
                              <strong title={fullTitle}>{fullTitle}</strong>
                              <small>{doc.type} • {doc.owner}</small>
                            </div>
                            <div className="doc-status-col">
                              <span className="version-tag">{doc.version}</span>
                              <span className={`status-pill ${doc.status === "Triển khai" ? "deployed" : "draft"}`}>
                                <span className="status-dot" />
                                {doc.status}
                              </span>
                              {docCommentsCount > 0 && (
                                <span className="doc-comments-badge">
                                  <MessageSquareText size={10} /> {docCommentsCount} trao đổi
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className="toc-container">
                  {tocItems.length === 0 ? (
                    <div className="toc-empty-state">
                      <BookOpen size={24} color="var(--text-muted)" />
                      <p>Tài liệu này chưa có tiêu đề (H1, H2, H3)</p>
                    </div>
                  ) : (
                    <div className="toc-tree">
                      {tocItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          title={item.text}
                          className={`toc-item level-${item.level} ${activeTocId === item.id ? "active" : ""}`}
                          onClick={() => scrollToHeading(item)}
                        >
                          <span className="toc-item-text" title={item.text}>{item.text}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Panel 2: Interactive Document Reader Viewer (HERO CENTER CANVAS FOR READING & COMMENTING) */}
          <article className="panel document-viewer">
            <div className="doc-toolbar">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Quick Toggle if Left Library Panel is hidden */}
                {!showLibraryPanel && (
                  <button
                    className="btn-secondary"
                    type="button"
                    title="Hiện danh sách tài liệu"
                    onClick={() => setShowLibraryPanel(true)}
                  >
                    <PanelLeftOpen size={14} /> Danh sách
                  </button>
                )}
                <div className="doc-toolbar-meta">
                  <span className="eyebrow" style={{ color: "var(--accent-cyan)", fontWeight: 700 }}>
                    {selectedDocument.type} • PHIÊN BẢN {selectedDocument.version} • CẬP NHẬT {selectedDocument.updatedAt}
                  </span>
                  <h2>{selectedDocument.title}</h2>
                </div>
              </div>

              <div className="doc-toolbar-actions">
                {/* Prominent Primary Share Button */}
                <button
                  className="btn-primary share-highlight-btn"
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  title="Chia sẻ quyền truy cập tài liệu"
                >
                  <Share2 size={15} /> Chia sẻ
                </button>

                {/* Grouped Surrounding Actions Dropdown */}
                <div className="doc-actions-dropdown-wrapper" ref={actionsDropdownRef}>
                  <button
                    className={`btn-secondary doc-more-actions-btn ${isActionsDropdownOpen ? "active" : ""}`}
                    type="button"
                    onClick={() => setIsActionsDropdownOpen((open) => !open)}
                    title="Các thao tác khác"
                  >
                    <span>Thao tác</span>
                    <ChevronDown size={14} className={`dropdown-chevron ${isActionsDropdownOpen ? "open" : ""}`} />
                  </button>

                  {isActionsDropdownOpen && (
                    <div className="doc-actions-menu">
                      <button
                        type="button"
                        className="menu-item"
                        onClick={() => {
                          setIsActionsDropdownOpen(false);
                          openEditDocumentModal(selectedDocument);
                        }}
                      >
                        <Pencil size={14} /> Sửa thông tin tài liệu
                      </button>

                      {selectedDocument.status !== "Triển khai" && (
                        <button
                          type="button"
                          className="menu-item deploy"
                          onClick={() => {
                            setIsActionsDropdownOpen(false);
                            void handleDeploySelectedDocument();
                          }}
                        >
                          <CheckCircle2 size={14} /> Chuyển sang Triển khai
                        </button>
                      )}

                      <button
                        type="button"
                        className="menu-item"
                        onClick={() => {
                          setIsActionsDropdownOpen(false);
                          if (selectedDocument.id === "empty-document") return;
                          setExportType("pdf");
                          setIsExportModalOpen(true);
                        }}
                      >
                        <Download size={14} /> Xuất tài liệu
                      </button>

                      <div className="doc-actions-divider" />

                      <button
                        type="button"
                        className="menu-item danger"
                        onClick={() => {
                          setIsActionsDropdownOpen(false);
                          requestDeleteDocument(selectedDocument.id);
                        }}
                      >
                        <Trash2 size={14} /> Xóa tài liệu này
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Reading Toolbar Controls */}
            <div className="reader-controls-bar">
              <div className="reader-controls-group">
                <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "var(--text-muted)" }}>Cỡ chữ:</span>
                <div style={{ display: "flex", gap: 3 }}>
                  <button
                    className={fontSize === "sm" ? "font-size-btn active" : "font-size-btn"}
                    type="button"
                    onClick={() => setFontSize("sm")}
                  >
                    Nhỏ
                  </button>
                  <button
                    className={fontSize === "md" ? "font-size-btn active" : "font-size-btn"}
                    type="button"
                    onClick={() => setFontSize("md")}
                  >
                    Vừa
                  </button>
                  <button
                    className={fontSize === "lg" ? "font-size-btn active" : "font-size-btn"}
                    type="button"
                    onClick={() => setFontSize("lg")}
                  >
                    Lớn
                  </button>
                </div>
              </div>

              <div className="reader-controls-group">
                <button
                  className={isZenMode ? "font-size-btn active" : "font-size-btn"}
                  type="button"
                  title="Chế độ đọc tập trung (Nhấn ESC để thoát)"
                  onClick={() => {
                    const nextZen = !isZenMode;
                    setIsZenMode(nextZen);
                    if (nextZen) {
                      setShowLibraryPanel(true);
                      setShowCommentsPanel(true);
                    }
                  }}
                >
                  {isZenMode ? <Minimize2 size={13} style={{ display: "inline", marginRight: 4 }} /> : <Maximize2 size={13} style={{ display: "inline", marginRight: 4 }} />}
                  <span>{isZenMode ? "Focus Mode" : "Tập Trung Đọc"}</span>
                </button>
              </div>
            </div>

            {/* Floating Right Toggle for Team Discussion Panel when collapsed */}
            {!showCommentsPanel && (
              <button
                className="floating-comments-toggle"
                type="button"
                title="Mở Bảng Thảo luận Team & Ghi chú"
                onClick={() => setShowCommentsPanel(true)}
              >
                <MessageSquareText size={15} />
                <span>Thảo luận ({docOpenCommentsCount})</span>
                <PanelRightOpen size={14} />
              </button>
            )}

            {/* Pure Document Reader View */}
            <div className="doc-page">

              {/* Rendered HTML Document Content for Reading & Comment Discussion */}
              <section
                ref={documentContainerRef}
                className={`html-document font-${fontSize}`}
                onMouseUp={handleDocumentSelection}
                onKeyUp={handleDocumentSelection}
                dangerouslySetInnerHTML={{
                  __html: selectedDocument.contentHtml || DEFAULT_DOC_CONTENT
                }}
              />
              {selectionHighlightRects.length > 0 && (
                <div className="held-selection-layer" aria-hidden="true">
                  {selectionHighlightRects.map((rect, index) => (
                    <span
                      key={`${index}-${rect.top}-${rect.left}`}
                      className="held-selection-rect"
                      style={{
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height
                      }}
                    />
                  ))}
                </div>
              )}
              {selectedCommentTarget && selectionPopover && !isSelectionComposerOpen && (
                <div
                  className="selection-action-toolbar"
                  style={{ top: selectionPopover.top, left: selectionPopover.left }}
                  onPointerDown={(event) => event.preventDefault()}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseUp={(event) => event.stopPropagation()}
                >
                  <button type="button" title="Copy đoạn đã bôi đen" onClick={handleCopySelectedText}>
                    <Copy size={15} />
                    <span>Copy</span>
                  </button>
                  <button type="button" title="Nhận xét đoạn đã bôi đen" onClick={focusSelectedCommentComposer}>
                    <MessageSquarePlus size={15} />
                    <span>Nhận xét</span>
                  </button>
                </div>
              )}
              {selectedCommentTarget && selectionPopover && isSelectionComposerOpen && (
                <div
                  className="selection-comment-editor"
                  style={{ top: selectionPopover.top, left: selectionPopover.left }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <div className="selection-comment-editor-header">
                    <strong>Nhận xét đoạn này</strong>
                    <button type="button" onClick={clearSelectedCommentTarget}>
                      <X size={13} />
                    </button>
                  </div>
                  <blockquote>{selectedCommentTarget.selectedText}</blockquote>
                  <textarea
                    ref={inlineCommentTextareaRef}
                    rows={3}
                    placeholder="Nhập nhận xét..."
                    value={newCommentText}
                    onChange={(event) => setNewCommentText(event.target.value)}
                    onKeyDown={(event) => submitTextareaOnEnter(event, handleAddComment)}
                  />
                  <div className="selection-comment-editor-actions">
                    <button type="button" onClick={clearSelectedCommentTarget}>
                      Hủy
                    </button>
                    <button type="button" onClick={handleAddComment}>
                      <Send size={12} /> Gửi
                    </button>
                  </div>
                </div>
              )}
            </div>
          </article>

          {/* Panel 3: Dynamic Comments & Line Review Panel (Collapsible) */}
            <aside className="panel comments-panel" aria-hidden={!showCommentsPanel}>
              <div className="panel-header">
                <div className="panel-title">
                  <p className="eyebrow">Thảo luận Team</p>
                  <h2>Ghi chú & Phản hồi</h2>
                </div>
                <div className="panel-action-group">
                  <UserCheck size={16} color="var(--accent-emerald)" />
                  <button
                    className="panel-close-btn"
                    type="button"
                    title="Thu gọn bảng thảo luận"
                    onClick={() => setShowCommentsPanel(false)}
                  >
                    <PanelRightClose size={14} />
                  </button>
                </div>
              </div>

              {/* Comment Threads List */}
              <>
              <div className="comment-filter-strip">
                {[
                  ["all", "Tất cả"],
                  ["open", "Đang mở"],
                  ["resolved", "Hoàn thành"],
                  ["mine", "Của tôi"]
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={commentFilter === id ? "active" : ""}
                    onClick={() => setCommentFilter(id as typeof commentFilter)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="comments-list">
                {displayedComments.map((comment) => (
                  <div
                    key={comment.id}
                    className={[
                      "comment-card",
                      comment.selectedText ? "clickable" : "",
                      comment.status === "resolved" ? "resolved" : ""
                    ].filter(Boolean).join(" ")}
                    onClick={() => handleCommentCardClick(comment)}
                  >
                    <div className="comment-card-header">
                      <div className="comment-top-meta">
                        <div className="comment-status-wrapper">
                          {comment.status === "resolved" ? (
                            <span className="comment-status-badge resolved">
                              <CheckCircle2 size={11} /> Hoàn thành
                            </span>
                          ) : (
                            <span className="comment-status-badge open">
                              <MessageSquareText size={11} /> Đang trao đổi
                            </span>
                          )}
                        </div>
                        <span className="req-tag">{comment.blockId}</span>
                      </div>

                      <div className="comment-author-info">
                        <div className="author-avatar">{comment.author[0]}</div>
                        <div className="author-name">
                          <strong>{comment.author}</strong>
                          <small>{comment.authorEmail || comment.authorRole || "Reviewer"}</small>
                        </div>
                      </div>
                    </div>

                    {comment.selectedText && (
                      <blockquote className="comment-quote">
                        {comment.selectedText}
                      </blockquote>
                    )}

                    {editingCommentId === comment.id ? (
                      <div className="comment-edit-box">
                        <textarea
                          rows={2}
                          value={editingCommentText}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(e) => setEditingCommentText(e.target.value)}
                          onKeyDown={(event) => submitTextareaOnEnter(event, () => handleSaveEditComment(comment.id))}
                        />
                        <div className="comment-edit-actions">
                          <button
                            className="btn-comment-action"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingCommentId(null);
                            }}
                          >
                            Hủy
                          </button>
                          <button
                            className="btn-comment-action"
                            style={{ background: "var(--accent-primary)", color: "white" }}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSaveEditComment(comment.id);
                            }}
                          >
                            Lưu
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="comment-text">{comment.text}</p>
                        <div className="comment-footer">
                          <small style={{ color: "var(--text-muted)" }}>{comment.createdAt}</small>
                          <div className="comment-actions-group">
                            {comment.status === "open" && (
                              <button
                                className="btn-comment-action success"
                                type="button"
                                title="Đánh dấu comment đã hoàn thành"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleResolveComment(comment);
                                }}
                              >
                                <CheckCircle2 size={11} /> Hoàn thành
                              </button>
                            )}
                            {comment.status === "open" && (
                              <button
                                className="btn-comment-action"
                                type="button"
                                title="Trả lời nhận xét này"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setEditingCommentId(null);
                                  setReplyingCommentId(comment.id);
                                  setReplyText("");
                                }}
                              >
                                <MessageSquarePlus size={11} /> Trả lời
                              </button>
                            )}
                            {comment.status === "open" && (
                              <button
                                className="btn-comment-action"
                                type="button"
                                title="Chỉnh sửa nội dung nhận xét"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setEditingCommentId(comment.id);
                                  setEditingCommentText(comment.text);
                                }}
                              >
                                <Pencil size={11} /> Sửa
                              </button>
                            )}
                            <button
                              className="btn-comment-action danger"
                              type="button"
                              title="Xóa nhận xét này"
                              onClick={(event) => {
                                event.stopPropagation();
                                requestDeleteComment(comment.id);
                              }}
                            >
                              <Trash2 size={11} /> Xóa
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {comment.replies && comment.replies.length > 0 && (
                      <div className="reply-list" onClick={(event) => event.stopPropagation()}>
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className={reply.status === "resolved" ? "reply-card resolved" : "reply-card"}>
                            <div className="reply-meta">
                              <div className="reply-author">
                                <strong>{reply.author}</strong>
                                <small>{reply.authorEmail || reply.authorRole || "Reviewer"}</small>
                              </div>
                              <div className="reply-meta-actions">
                                {reply.status === "resolved" && (
                                  <span className="comment-status-badge compact">
                                    <CheckCircle2 size={10} /> Hoàn thành
                                  </span>
                                )}
                                <span>{reply.createdAt}</span>
                              </div>
                            </div>
                            {editingCommentId === reply.id ? (
                              <div className="comment-edit-box">
                                <textarea
                                  rows={2}
                                  value={editingCommentText}
                                  onChange={(event) => setEditingCommentText(event.target.value)}
                                  onKeyDown={(event) => submitTextareaOnEnter(event, () => handleSaveEditComment(reply.id))}
                                />
                                <div className="comment-edit-actions">
                                  <button
                                    className="btn-comment-action"
                                    type="button"
                                    onClick={() => {
                                      setEditingCommentId(null);
                                      setEditingCommentText("");
                                    }}
                                  >
                                    Hủy
                                  </button>
                                  <button
                                    className="btn-comment-action primary"
                                    type="button"
                                    onClick={() => void handleSaveEditComment(reply.id)}
                                  >
                                    Lưu
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p>{reply.text}</p>
                                <div className="reply-card-actions">
                                  {reply.status === "open" && (
                                    <button
                                      className="btn-comment-action"
                                      type="button"
                                      title="Chỉnh sửa phản hồi"
                                      onClick={() => {
                                        setReplyingCommentId(null);
                                        setEditingCommentId(reply.id);
                                        setEditingCommentText(reply.text);
                                      }}
                                    >
                                      <Pencil size={11} /> Sửa
                                    </button>
                                  )}
                                  <button
                                    className="btn-comment-action danger"
                                    type="button"
                                    title="Xóa phản hồi"
                                    onClick={() => requestDeleteComment(reply.id)}
                                  >
                                    <Trash2 size={11} /> Xóa
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {replyingCommentId === comment.id && (
                      <div className="reply-composer" onClick={(event) => event.stopPropagation()}>
                        <textarea
                          rows={2}
                          placeholder="Nhập phản hồi..."
                          value={replyText}
                          onChange={(event) => setReplyText(event.target.value)}
                          onKeyDown={(event) => submitTextareaOnEnter(event, () => handleAddReply(comment))}
                        />
                        <div className="reply-actions">
                          <button
                            className="btn-comment-action"
                            type="button"
                            onClick={() => {
                              setReplyingCommentId(null);
                              setReplyText("");
                            }}
                          >
                            Hủy
                          </button>
                          <button
                            className="btn-comment-action primary"
                            type="button"
                            onClick={() => handleAddReply(comment)}
                          >
                            <Send size={12} /> Reply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {displayedComments.length === 0 && (
                  <div className="empty-collab-state">Không có nhận xét phù hợp với bộ lọc.</div>
                )}
              </div>
              </>
            </aside>
        </section>
        )}
      </section>

      {isExportModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content export-modal-content">
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <div className="modal-header-badge">
                  <Download size={20} />
                </div>
                <div>
                  <h3>Xuất tài liệu</h3>
                  <p className="modal-subtitle">{selectedDocument.title}</p>
                </div>
              </div>
              <button
                className="icon-btn"
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                disabled={isExporting}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="export-format-grid">
                <button
                  type="button"
                  className={exportType === "pdf" ? "export-format-card active" : "export-format-card"}
                  onClick={() => setExportType("pdf")}
                  disabled={isExporting}
                >
                  <FileText size={22} />
                  <span>
                    <strong>PDF</strong>
                    <small>Phù hợp để gửi, ký duyệt hoặc lưu trữ bản cố định.</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={exportType === "docx" ? "export-format-card active" : "export-format-card"}
                  onClick={() => setExportType("docx")}
                  disabled={isExporting}
                >
                  <FileCheck2 size={22} />
                  <span>
                    <strong>Word DOCX</strong>
                    <small>Phù hợp khi cần tiếp tục chỉnh sửa nội dung.</small>
                  </span>
                </button>
              </div>

              <div className="export-summary">
                <div>
                  <strong>Tài liệu</strong>
                  <span>{selectedDocument.title}</span>
                </div>
                <div>
                  <strong>Phiên bản</strong>
                  <span>{selectedDocument.version}</span>
                </div>
                <div>
                  <strong>Loại</strong>
                  <span>{selectedDocument.type}</span>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                disabled={isExporting}
              >
                Hủy
              </button>
              <button
                className="btn-primary"
                type="button"
                onClick={() => void handleExportDocument()}
                disabled={isExporting}
              >
                <Download size={14} />
                {isExporting ? "Đang tạo file..." : `Xuất ${exportType === "pdf" ? "PDF" : "Word"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Create New Project */}
      {isCreateProjectModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <div className="modal-header-badge">
                  <FolderPlus size={20} />
                </div>
                <div>
                  <h3>Tạo Dự Án Quản Lý Mới</h3>
                  <p className="modal-subtitle">Nhập tên dự án, mã dự án và khối nghiệp vụ tương ứng</p>
                </div>
              </div>
              <button className="icon-btn" type="button" onClick={() => setIsCreateProjectModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group project-name-priority">
                <label>Tên Dự Án (Project Name)</label>
                <input
                  className="form-input"
                  placeholder="Ví dụ: Nền tảng tuyển sinh trung tâm..."
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Mã Dự Án (Project Code)</label>
                <input
                  className="form-input"
                  placeholder="Để trống hệ thống sẽ tự sinh mã"
                  value={newProjCode}
                  onChange={(e) => setNewProjCode(e.target.value)}
                />
                <small className="field-hint">Có thể nhập mã riêng, hoặc bỏ trống để tự tạo từ tên dự án.</small>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Khách Hàng / Thị Trường</label>
                  <select
                    className="form-select"
                    value={newProjCustomer}
                    onChange={(e) => setNewProjCustomer(e.target.value)}
                  >
                    {PROJECT_CUSTOMER_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Khối Nghiệp Vụ</label>
                  <select
                    className="form-select"
                    value={newProjBusinessUnit}
                    onChange={(e) => setNewProjBusinessUnit(e.target.value)}
                  >
                    {BUSINESS_UNIT_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" type="button" onClick={() => setIsCreateProjectModalOpen(false)}>
                Hủy
              </button>
              <button className="btn-primary" type="button" onClick={handleCreateProject}>
                <FolderPlus size={16} /> Tạo Dự Án
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Existing Project */}
      {isEditProjectModalOpen && editingProject && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <div className="modal-header-badge cyan">
                  <Pencil size={20} />
                </div>
                <div>
                  <h3>Chỉnh Sửa Thông Tin Dự Án</h3>
                  <p className="modal-subtitle">Cập nhật thông tin mã dự án, khách hàng và khối nghiệp vụ</p>
                </div>
              </div>
              <button className="icon-btn" type="button" onClick={() => setIsEditProjectModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group project-name-priority">
                <label>Tên Dự Án (Project Name)</label>
                <input
                  className="form-input"
                  value={editProjName}
                  onChange={(e) => setEditProjName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Mã Dự Án (Project Code)</label>
                <input
                  className="form-input"
                  placeholder="Để trống hệ thống sẽ tự sinh mã"
                  value={editProjCode}
                  onChange={(e) => setEditProjCode(e.target.value)}
                />
                <small className="field-hint">Có thể nhập mã riêng, hoặc bỏ trống để tự tạo từ tên dự án.</small>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Khách Hàng / Thị Trường</label>
                  <select
                    className="form-select"
                    value={editProjCustomer}
                    onChange={(e) => setEditProjCustomer(e.target.value)}
                  >
                    {[...new Set([editProjCustomer, ...PROJECT_CUSTOMER_OPTIONS])].map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Khối Nghiệp Vụ</label>
                  <select
                    className="form-select"
                    value={editProjBusinessUnit}
                    onChange={(e) => setEditProjBusinessUnit(e.target.value)}
                  >
                    {[...new Set([editProjBusinessUnit, ...BUSINESS_UNIT_OPTIONS])].map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" type="button" onClick={() => setIsEditProjectModalOpen(false)}>
                Hủy
              </button>
              <button className="btn-primary" type="button" onClick={handleSaveEditProject}>
                <Pencil size={16} /> Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Create New Document */}
      {isCreateDocModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <div className="modal-header-badge amber">
                  <FilePlus size={20} />
                </div>
                <div>
                  <h3>Tạo Tài Liệu Mới Cho Dự Án</h3>
                  <p className="modal-subtitle">Khởi tạo tài liệu nghiệp vụ mới vào dự án được chọn</p>
                </div>
              </div>
              <button className="icon-btn" type="button" onClick={() => setIsCreateDocModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Chọn Dự Án Thuộc Về</label>
                <select
                  className="form-select"
                  value={newDocProjectId}
                  onChange={(e) => setNewDocProjectId(e.target.value)}
                >
                  {projectsList.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      [{proj.code}] {proj.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Tên / Tiêu Đề Tài Liệu</label>
                <input
                  className="form-input"
                  placeholder="Ví dụ: System Architecture & Data Flow..."
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Loại Tài Liệu</label>
                  <select
                    className="form-select"
                    value={newDocType}
                    onChange={(e) => setNewDocType(e.target.value)}
                  >
                    <option value="BRD">BRD (Business Req)</option>
                    <option value="SRS">SRS (System Spec)</option>
                    <option value="CR">CR (Change Request)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Người Phụ Trách (Owner)</label>
                  <input
                    className="form-input"
                    placeholder="Ví dụ: BA Lead"
                    value={newDocOwner}
                    onChange={(e) => setNewDocOwner(e.target.value)}
                  />
                </div>
              </div>

              {documentTemplates.length > 0 && (
                <div className="template-picker">
                  <div className="collab-section-title">Tạo nhanh từ mẫu</div>
                  <div className="template-grid">
                    {documentTemplates.slice(0, 6).map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => void handleCreateDocumentFromTemplate(template)}
                      >
                        <FileText size={15} />
                        <span>
                          <strong>{template.name}</strong>
                          <small>{template.description || `${template.type} template`}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" type="button" onClick={() => setIsCreateDocModalOpen(false)}>
                Hủy
              </button>
              <button className="btn-primary" type="button" onClick={handleCreateDocument}>
                <FilePlus size={16} /> Tạo Tài Liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Edit Existing Document Metadata */}
      {isEditDocModalOpen && editingDoc && (
        <div className="modal-backdrop">
          <div className="modal-content document-edit-modal">
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <div className="modal-header-badge">
                  <FileText size={20} />
                </div>
                <div>
                  <h3>Chỉnh Sửa Thuộc Tính Tài Liệu</h3>
                  <p className="modal-subtitle">Cập nhật thông tin lưu trữ, phân loại và trạng thái tài liệu</p>
                </div>
              </div>
              <button className="icon-btn" type="button" onClick={() => setIsEditDocModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group project-name-priority document-title-priority">
                <label>Tên / Tiêu Đề Tài Liệu</label>
                <input
                  className="form-input"
                  placeholder="Ví dụ: Mở rộng tính năng web..."
                  value={editDocTitle}
                  onChange={(e) => setEditDocTitle(e.target.value)}
                />
              </div>

              <div className="form-group-section document-property-section">
                <div className="form-section-header">
                  <Layers size={15} /> THÔNG TIN THUỘC TÍNH & PHÂN LOẠI
                </div>

                <div className="document-property-grid">
                  <div className="form-group">
                    <label>Loại Tài Liệu</label>
                    <div className="input-with-icon-wrapper">
                      <FileText size={16} className="field-icon" />
                      <select
                        className="form-select"
                        value={editDocType}
                        onChange={(e) => setEditDocType(e.target.value)}
                      >
                        <option value="BRD">BRD (Business Req)</option>
                        <option value="SRS">SRS (System Spec)</option>
                        <option value="CR">CR (Change Request)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Trạng Thái</label>
                    <div className="input-with-icon-wrapper">
                      <CheckCircle2 size={16} className="field-icon" />
                      <select
                        className="form-select"
                        value={editDocStatus}
                        onChange={(e) => setEditDocStatus(e.target.value as DocumentStatus)}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Triển khai">Triển khai</option>
                      </select>
                    </div>
                  </div>

                  <small className="form-hint document-status-hint">
                    Chỉ đổi trạng thái quản lý tài liệu, không có luồng duyệt.
                  </small>

                  <div className="form-group">
                    <label>Người Import / Phụ Trách</label>
                    <div className="input-with-icon-wrapper">
                      <Users size={16} className="field-icon" />
                      <input
                        className="form-input document-owner-readonly"
                        value={editDocOwner || "Người import tài liệu"}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Phiên Bản (Version)</label>
                    <div className="input-with-icon-wrapper">
                      <Clock size={16} className="field-icon" />
                      <input
                        className="form-input"
                        placeholder="Ví dụ: v0.1, v1.0..."
                        value={editDocVersion}
                        onChange={(e) => setEditDocVersion(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" type="button" onClick={() => setIsEditDocModalOpen(false)}>
                Hủy
              </button>
              <button className="btn-primary" type="button" onClick={handleSaveEditDocument}>
                <Pencil size={16} /> Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {isLogoutConfirmOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header" style={{ background: "rgba(37, 99, 235, 0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="logout-confirm-icon">
                  <LogOut size={22} />
                </div>
                <h3 style={{ color: "var(--accent-primary)" }}>Xác nhận đăng xuất</h3>
              </div>
              <button
                className="icon-btn"
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: "0.88rem", lineHeight: 1.5, color: "var(--text-primary)" }}>
                Bạn có chắc muốn đăng xuất khỏi tài khoản <strong>{currentUser.name}</strong> không?
              </p>

              <div className="modal-footer">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setIsLogoutConfirmOpen(false)}
                >
                  Hủy bỏ
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => void executeLogout()}
                >
                  <LogOut size={15} /> Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Confirmation Delete Popup Modal */}
      {confirmDeleteModal.isOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header" style={{ background: "rgba(225, 29, 72, 0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="confirm-modal-icon">
                  <AlertTriangle size={22} />
                </div>
                <h3 style={{ color: "var(--accent-rose)" }}>{confirmDeleteModal.title}</h3>
              </div>
              <button
                className="icon-btn"
                type="button"
                onClick={() => setConfirmDeleteModal({ isOpen: false, type: null, id: null, title: "", message: "" })}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: "0.88rem", lineHeight: 1.5, color: "var(--text-primary)" }}>
                {confirmDeleteModal.message}
              </p>

              <div className="modal-footer">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setConfirmDeleteModal({ isOpen: false, type: null, id: null, title: "", message: "" })}
                >
                  Hủy bỏ
                </button>
                <button
                  className="btn-danger"
                  type="button"
                  onClick={executeConfirmDelete}
                >
                  <Trash2 size={15} /> Xóa Vĩnh Viễn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Import File with Target Project Selector */}
      {isImportModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content import-modal-content">
            <div className="modal-header">
              <h3>Import tệp vào Dự Án</h3>
              <button
                className="icon-btn"
                type="button"
                disabled={isImporting}
                onClick={() => setIsImportModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {/* Project Target Dropdown Selector */}
              <div className="form-group">
                <label style={{ fontWeight: 700, color: "var(--accent-primary)" }}>
                  Chọn Dự Án Đích để Import vào:
                </label>
                <select
                  className="form-select"
                  value={importTargetProjectId}
                  disabled={isImporting}
                  onChange={(e) => setImportTargetProjectId(e.target.value)}
                >
                  {projectsList.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      [{proj.code}] {proj.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 700, color: "var(--text-primary)" }}>Cách xử lý file import</label>
                <div className="import-mode-grid">
                  <button
                    type="button"
                    className={importMode === "create" ? "import-mode-card selected" : "import-mode-card"}
                    disabled={isImporting}
                    onClick={() => setImportMode("create")}
                  >
                    <strong>Tạo tài liệu mới</strong>
                    <small>File import sẽ xuất hiện như một tài liệu riêng trong dự án.</small>
                  </button>
                  <button
                    type="button"
                    className={importMode === "update" ? "import-mode-card selected" : "import-mode-card"}
                    disabled={isImporting || !importTargetDocuments.length}
                    onClick={() => setImportMode("update")}
                  >
                    <strong>Cập nhật tài liệu đang có</strong>
                    <small>Thay nội dung HTML, giữ nguyên comment và lịch sử tài liệu.</small>
                  </button>
                </div>
              </div>

              {importMode === "update" && (
                <div className="form-group">
                  <label style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                    Chọn tài liệu cần cập nhật:
                  </label>
                  <select
                    className="form-select"
                    value={importTargetDocumentId}
                    disabled={isImporting}
                    onChange={(e) => setImportTargetDocumentId(e.target.value)}
                  >
                    {importTargetDocuments.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        [{doc.type}] {doc.title} ({doc.version})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Drag & Drop File Zone */}
              <label
                className={`${isDragOver ? "dropzone drag-over" : "dropzone"} ${isImporting ? "is-loading" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (isImporting) return;
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (isImporting) return;
                  const file = e.dataTransfer.files[0];
                  if (file) void handleImport(file);
                }}
              >
                <input
                  type="file"
                  accept=".md,.doc,.docx,.pdf"
                  disabled={isImporting}
                  style={{ display: "none" }}
                  onChange={(e) => void handleImport(e.target.files?.[0])}
                />
                <div className="dropzone-icon">
                  {isImporting ? <span className="import-spinner" /> : <UploadCloud size={24} />}
                </div>
                <div>
                  <strong style={{ fontSize: "0.95rem" }}>
                    {isImporting ? "Đang import tài liệu..." : "Kéo & thả tệp vào đây hoặc Click để chọn"}
                  </strong>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
                    {isImporting ? importStatusText : "Hỗ trợ định dạng `.md`, `.doc`, `.docx`, `.pdf`"}
                  </p>
                </div>
              </label>

              {isImporting && (
                <div className="import-progress-panel" role="status" aria-live="polite">
                  <div className="import-progress-header">
                    <span className="import-spinner" />
                    <strong>Đang xử lý, vui lòng giữ nguyên cửa sổ</strong>
                  </div>
                  <div className="import-progress-bar">
                    <span />
                  </div>
                  <p>{importStatusText || "Đang upload, chuyển đổi HTML và lưu vào Neon..."}</p>
                </div>
              )}

              <div style={{ background: "var(--bg-surface)", padding: 12, borderRadius: 8, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                <strong>Quy trình:</strong> Tệp được chọn sẽ được tự động chuyển đổi sang giao diện đọc chuẩn để team xem và thảo luận comment trực tiếp.
              </div>
            </div>
          </div>
        </div>
      )}

      {isShareModalOpen && (
        <Suspense fallback={null}>
          <ShareAccessModal
            isOpen={isShareModalOpen}
            initialScope="document"
            documentId={selectedDocument.id}
            documentTitle={selectedDocument.title}
            projectId={selectedProject.id}
            projectTitle={selectedProject.name}
            onClose={() => setIsShareModalOpen(false)}
            onToast={addToast}
          />
        </Suspense>
      )}

      {/* Floating Toast Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <div>
              <strong style={{ display: "block", fontSize: "0.85rem" }}>{toast.title}</strong>
              <small style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>{toast.message}</small>
            </div>
            <button
              style={{ opacity: 0.6 }}
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}

export default App;
