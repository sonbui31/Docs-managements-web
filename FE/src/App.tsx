import {
  Activity as ActivityIcon,
  AlertTriangle,
  BarChart2,
  Bell,
  BookOpen,
  Calendar,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Eraser,
  ExternalLink,
  Eye,
  File,
  FileCheck2,
  FileCode,
  FileDiff,
  FilePlus,
  FileStack,
  FileText,
  Filter,
  FolderKanban,
  FolderPlus,
  GitBranch,
  Kanban,
  Layers,
  LayoutDashboard,
  Loader2,
  ListTree,
  LogOut,
  MessageSquarePlus,
  MessageSquareText,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  PenLine,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Trash2,
  TrendingUp,
  GripVertical,
  UploadCloud,
  User as UserIcon,
  UserCheck,
  UserPlus,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import {
  createComment,
  createDocument,
  createDocumentFromTemplate,
  createProject,
  createRequirementTag,
  createTraceLink,
  createWorkboardColumn,
  createWorkItem,
  createWorkItemComment,
  deleteComment,
  deleteDocument,
  deleteProject,
  deleteRequirementTag,
  deleteTraceLink,
  deleteWorkItem,
  deleteWorkItemComment,
  downloadExport,
  fetchComments,
  fetchDocumentDiff,
  fetchDocumentTags,
  fetchDocumentVersions,
  fetchDocumentTemplates,
  fetchDocumentsByProject,
  fetchNotifications,
  fetchProjectActivity,
  fetchProjectDashboard,
  fetchProjectMembers,
  fetchProjectWorkItems,
  fetchWorkboardColumns,
  fetchWorkItemActivity,
  fetchWorkItemComments,
  fetchProjects,
  fetchRoleDashboard,
  fetchTraceLinks,
  importDocument,
  markNotificationRead,
  resolveComment,
  restoreDocumentVersion,
  searchProject,
  updateWorkboardColumn,
  updateComment,
  updateDocument,
  updateProject,
  updateWorkItem,
  updateWorkItemComment,
  deleteWorkboardColumn,
  reorderWorkboardColumns,
  uploadMediaAsset
} from "./api";
import { AuthPage } from "./AuthPage";
import { clearAuthSession, fetchCurrentUser, getAccessToken, getStoredUser, logout } from "./authApi";
import type {
  ActivityLog,
  CommentThread,
  DocumentStatus,
  DocumentVersion,
  DocumentTemplate,
  NotificationItem,
  Project,
  ProjectDashboard,
  ProjectDocument,
  ProjectMemberOption,
  RequirementTag,
  RoleDashboard,
  SearchResult,
  ToastMessage,
  TraceLink,
  User,
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

const DEFAULT_DOC_CONTENT = `<h3>Chưa có nội dung hiển thị</h3><p>Tài liệu này chưa có HTML hoặc quá trình import chưa hoàn tất.</p>`;

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

const DEFAULT_WORKBOARD_COLUMNS: WorkboardColumn[] = [
  { id: "BACKLOG", projectId: "", key: "BACKLOG", name: "Backlog", color: "#64748b", type: "OPEN", position: 0, isDefault: true, isDone: false },
  { id: "TODO", projectId: "", key: "TODO", name: "To Do", color: "#3b82f6", type: "OPEN", position: 1, isDefault: false, isDone: false },
  { id: "IN_PROGRESS", projectId: "", key: "IN_PROGRESS", name: "In Progress", color: "#f59e0b", type: "IN_PROGRESS", position: 2, isDefault: false, isDone: false },
  { id: "REVIEW", projectId: "", key: "REVIEW", name: "Review / QA", color: "#8b5cf6", type: "REVIEW", position: 3, isDefault: false, isDone: false },
  { id: "BLOCKED", projectId: "", key: "BLOCKED", name: "Blocked", color: "#ef4444", type: "BLOCKED", position: 4, isDefault: false, isDone: false },
  { id: "DONE", projectId: "", key: "DONE", name: "Done", color: "#10b981", type: "DONE", position: 5, isDefault: false, isDone: true }
];

const WORKBOARD_COLUMN_TYPE_OPTIONS: Array<{ value: WorkboardColumnType; label: string }> = [
  { value: "INTAKE", label: "Mới tiếp nhận" },
  { value: "READY", label: "Sẵn sàng làm" },
  { value: "OPEN", label: "Đang mở" },
  { value: "IN_PROGRESS", label: "Đang làm" },
  { value: "REVIEW", label: "Review" },
  { value: "QA", label: "Test / QA" },
  { value: "WAITING", label: "Chờ phản hồi" },
  { value: "BLOCKED", label: "Bị chặn" },
  { value: "REWORK", label: "Cần làm lại" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "DONE", label: "Hoàn thành" },
  { value: "ARCHIVED", label: "Lưu trữ" }
];

const WORK_ITEM_TYPE_LABEL: Record<WorkItemType, string> = {
  TASK: "Task",
  BUG: "Bug",
  REVIEW: "Review",
  CHANGE_REQUEST: "Change",
  QUESTION: "Question"
};

const WORK_ITEM_PRIORITY_LABEL: Record<WorkItemPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical"
};

const WORK_ITEM_PRIORITY_RANK: Record<WorkItemPriority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

type WorkItemDraft = {
  id?: string;
  projectId: string;
  documentId: string;
  type: WorkItemType;
  status: WorkItemStatus;
  columnId: string;
  priority: WorkItemPriority;
  title: string;
  description: string;
  assigneeName: string;
  assigneeIds: string[];
  dueDate: string;
  attachmentsText: string;
  checklistText: string;
  labelsText: string;
};

type WorkboardColumnDraft = {
  id?: string;
  name: string;
  color: string;
  type: WorkboardColumnType;
  isDefault: boolean;
  isDone: boolean;
};

function splitAssigneeNames(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function joinAssigneeNames(names: string[]) {
  return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean))).join(", ");
}

function isProjectAssigneeOption(member: ProjectMemberOption) {
  return Boolean(member.projectRole || member.projectRoles?.length || member.source === "PROJECT");
}

function canAssignMemberToWorkItem(member: ProjectMemberOption, draft?: Pick<WorkItemDraft, "documentId"> | null) {
  if (isProjectAssigneeOption(member)) return true;
  return Boolean(draft?.documentId && member.documentIds?.includes(draft.documentId));
}

function workItemAssigneeNames(item: WorkItem) {
  const names = item.assignees?.map((assignee) => assignee.user.name).filter(Boolean) ?? [];
  return names.length ? names : splitAssigneeNames(item.assigneeName ?? item.assignee?.name ?? "");
}

function workItemAssigneeLabel(item: WorkItem) {
  const names = workItemAssigneeNames(item);
  return names.length ? names.join(", ") : "Chưa giao";
}

function CustomProjectSelect({
  projects,
  selectedProjectId,
  onSelectProject
}: {
  projects: Project[];
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId]
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase().trim();
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  return (
    <div className={`custom-project-select-container ${isOpen ? "is-open" : ""}`} ref={dropdownRef}>
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={projects.length === 0}
      >
        <div className="select-trigger-content">
          <FolderKanban size={15} className="trigger-icon" />
          {selectedProject ? (
            <div className="trigger-project-info">
              <span className="trigger-code-chip">{selectedProject.code}</span>
              <span className="trigger-name">{selectedProject.name}</span>
            </div>
          ) : (
            <span className="trigger-placeholder">Chọn dự án...</span>
          )}
        </div>
        <ChevronDown size={14} className={`trigger-arrow ${isOpen ? "active" : ""}`} />
      </button>

      {isOpen && (
        <div className="custom-select-dropdown-menu">
          {projects.length > 3 && (
            <div className="dropdown-search-header">
              <Search size={13} />
              <input
                type="text"
                placeholder="Tìm dự án..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className="dropdown-options-container">
            {filteredProjects.length === 0 ? (
              <div className="dropdown-empty-state">Không có dự án phù hợp</div>
            ) : (
              filteredProjects.map((p) => {
                const isSelected = p.id === selectedProjectId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`dropdown-option-row ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      onSelectProject(p.id);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    <span className="option-code-pill">{p.code}</span>
                    <span className="option-title-text">{p.name}</span>
                    {isSelected && <CheckCheck size={14} className="option-selected-icon" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CustomFormSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  className
}: {
  value: T | undefined | null;
  onChange: (val: T) => void;
  options: Array<{ value: T; label: string }>;
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value) ?? (placeholder ? null : options[0]),
    [options, value, placeholder]
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`custom-form-select-wrapper ${className ?? ""} ${isOpen ? "is-open" : ""}`} ref={dropdownRef}>
      <button
        type="button"
        className="form-select-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="trigger-label-text">
          {selectedOption ? selectedOption.label : (placeholder || "Chọn...")}
        </span>
        <ChevronDown size={14} className={`trigger-arrow-icon ${isOpen ? "rotate" : ""}`} />
      </button>

      {isOpen && (
        <div className="custom-form-select-menu">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                className={`custom-select-option ${isSelected ? "selected" : ""}`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {isSelected && <CheckCheck size={14} className="option-check-mark" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CustomHeaderSelect<T extends string>({
  value,
  onChange,
  options,
  icon: IconComponent
}: {
  value: T;
  onChange: (val: T) => void;
  options: Array<{ value: T; label: string }>;
  icon?: React.ElementType;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value) ?? options[0],
    [options, value]
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`custom-header-select-wrapper ${isOpen ? "is-open" : ""}`} ref={dropdownRef}>
      <button
        type="button"
        className="header-select-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {IconComponent && <IconComponent size={14} className="header-select-icon" />}
        <span className="trigger-label-text">{selectedOption.label}</span>
        <ChevronDown size={13} className={`trigger-arrow-icon ${isOpen ? "rotate" : ""}`} />
      </button>

      {isOpen && (
        <div className="custom-header-select-menu">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                className={`custom-select-option ${isSelected ? "selected" : ""}`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {isSelected && <CheckCheck size={14} className="option-check-mark" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CustomDatePicker({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const parsed = value ? new Date(value + "T00:00:00") : null;
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());

  useEffect(() => {
    if (isOpen && parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const dayNames = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startDay = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells: Array<{ day: number; current: boolean; dateStr: string }> = [];
  for (let i = startDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ day: d, current: false, dateStr: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true, dateStr: `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      cells.push({ day: d, current: false, dateStr: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
    }
  }

  const displayValue = parsed
    ? `${String(parsed.getDate()).padStart(2, "0")}/${String(parsed.getMonth() + 1).padStart(2, "0")}/${parsed.getFullYear()}`
    : "";

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  return (
    <div className="custom-datepicker-wrapper" ref={ref}>
      <button
        type="button"
        className="form-select-trigger datepicker-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className={`trigger-label-text ${!value ? "placeholder" : ""}`}>
          {displayValue || (placeholder ?? "dd/mm/yyyy")}
        </span>
        <Calendar size={14} className="trigger-arrow-icon" />
      </button>

      {isOpen && (
        <div className="datepicker-popup">
          <div className="datepicker-header">
            <button type="button" className="dp-nav-btn" onClick={prevMonth}>
              <ChevronLeft size={16} />
            </button>
            <span className="dp-month-label">{monthNames[viewMonth]}, {viewYear}</span>
            <button type="button" className="dp-nav-btn" onClick={nextMonth}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="datepicker-day-names">
            {dayNames.map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="datepicker-grid">
            {cells.map((cell, i) => (
              <button
                key={i}
                type="button"
                className={[
                  "dp-day",
                  !cell.current && "outside",
                  cell.dateStr === value && "selected",
                  cell.dateStr === todayStr && "today"
                ].filter(Boolean).join(" ")}
                onClick={() => {
                  onChange(cell.dateStr);
                  setIsOpen(false);
                }}
              >
                {cell.day}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function parseChecklistText(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const done = /^\[[xX]\]\s+/.test(line);
      const title = line.replace(/^\[[ xX]\]\s+/, "").trim();
      return { title, done };
    })
    .filter((item) => item.title);
}

function checklistToText(item: WorkItem) {
  return (item.checklistItems ?? [])
    .map((entry) => `${entry.done ? "[x]" : "[ ]"} ${entry.title}`)
    .join("\n");
}

function parseLabelText(value: string) {
  return Array.from(new Set(
    value
      .split(/[,\n]/)
      .map((label) => label.trim())
      .filter(Boolean)
  ));
}

function workItemLabelNames(item: WorkItem) {
  return item.labels?.map((entry) => entry.label.name).filter(Boolean) ?? [];
}

function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());

  // State for dynamic projects & documents lists
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [projectMembersByProject, setProjectMembersByProject] = useState<Record<string, ProjectMemberOption[]>>({});

  const [documentsList, setDocumentsList] = useState<ProjectDocument[]>([]);
  const [documentCommentCounts, setDocumentCommentCounts] = useState<Record<string, number>>({});

  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectsList[0]?.id ?? "");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>(documentsList[0]?.id ?? "");
  const [activeTabNav, setActiveTabNav] = useState<"dashboard" | "projects" | "documents" | "review" | "admin">("dashboard");

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
  const [commentsList, setCommentsList] = useState<CommentThread[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [dashboardWorkItems, setDashboardWorkItems] = useState<WorkItem[]>([]);
  const [workboardColumnsByProject, setWorkboardColumnsByProject] = useState<Record<string, WorkboardColumn[]>>({});
  const [isLoadingWorkItems, setIsLoadingWorkItems] = useState<boolean>(false);
  const [draggingWorkItemId, setDraggingWorkItemId] = useState<string | null>(null);
  const pendingWorkItemMovesRef = useRef<Record<string, {
    status: WorkItemStatus;
    columnId?: string | null;
    previousStatus: WorkItemStatus;
    previousColumnId?: string | null;
    token: number;
  }>>({});
  const workItemMoveTokenRef = useRef<number>(0);
  const [workboardSearchQuery, setWorkboardSearchQuery] = useState<string>("");
  const [workboardTypeFilter, setWorkboardTypeFilter] = useState<"ALL" | WorkItemType>("ALL");
  const [workboardPriorityFilter, setWorkboardPriorityFilter] = useState<"ALL" | WorkItemPriority>("ALL");
  const [workboardAssigneeFilter, setWorkboardAssigneeFilter] = useState<string>("ALL");
  const [workboardCreatorFilter, setWorkboardCreatorFilter] = useState<string>("ALL");
  const [workboardSortBy, setWorkboardSortBy] = useState<"BOARD_ORDER" | "UPDATED_DESC" | "DUE_ASC" | "PRIORITY_DESC">("BOARD_ORDER");
  const [isWorkboardConfigOpen, setIsWorkboardConfigOpen] = useState<boolean>(false);
  const [openFilterDropdown, setOpenFilterDropdown] = useState<string | null>(null);
  const [workboardColumnDrafts, setWorkboardColumnDrafts] = useState<WorkboardColumnDraft[]>([]);
  const [isSavingWorkboardColumns, setIsSavingWorkboardColumns] = useState<boolean>(false);
  const [isWorkItemModalOpen, setIsWorkItemModalOpen] = useState<boolean>(false);
  const [workItemDraft, setWorkItemDraft] = useState<WorkItemDraft | null>(null);
  const [isSavingWorkItem, setIsSavingWorkItem] = useState<boolean>(false);
  const [isAssigneeMenuOpen, setIsAssigneeMenuOpen] = useState<boolean>(false);
  const workItemAssigneeDropdownRef = useRef<HTMLDivElement>(null);
  const [viewingWorkItemId, setViewingWorkItemId] = useState<string | null>(null);
  const [workItemComments, setWorkItemComments] = useState<WorkItemComment[]>([]);
  const [workItemActivity, setWorkItemActivity] = useState<WorkItemActivity[]>([]);
  const [isLoadingWorkItemActivity, setIsLoadingWorkItemActivity] = useState<boolean>(false);
  const [showAllWorkItemActivity, setShowAllWorkItemActivity] = useState<boolean>(false);
  const [workItemCommentText, setWorkItemCommentText] = useState<string>("");
  const [replyingWorkItemCommentId, setReplyingWorkItemCommentId] = useState<string | null>(null);
  const [workItemReplyText, setWorkItemReplyText] = useState<string>("");
  const [activeWorkItemMentionTarget, setActiveWorkItemMentionTarget] = useState<"comment" | "reply" | null>(null);
  const commentEditorRef = useRef<HTMLDivElement>(null);
  const replyEditorRef = useRef<HTMLDivElement>(null);
  const [editingWorkItemCommentId, setEditingWorkItemCommentId] = useState<string | null>(null);
  const [editingWorkItemCommentText, setEditingWorkItemCommentText] = useState<string>("");
  const [isUploadingWorkItemAttachment, setIsUploadingWorkItemAttachment] = useState<boolean>(false);
  const [commentFilter, setCommentFilter] = useState<"all" | "open" | "resolved" | "mine">("all");
  const [projectHubSearch, setProjectHubSearch] = useState<string>("");
  const [projectHubSort, setProjectHubSort] = useState<string>("newest");
  const [projectHubFilter, setProjectHubFilter] = useState<string>("all");
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
  const [adminTriggerCreate, setAdminTriggerCreate] = useState<number>(0);
  const [adminTriggerRefresh, setAdminTriggerRefresh] = useState<number>(0);

  // Comment Editing state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>("");
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const [activeCommentMenuId, setActiveCommentMenuId] = useState<string | null>(null);

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importTargetProjectId, setImportTargetProjectId] = useState<string>(selectedProjectId);
  const [importMode, setImportMode] = useState<"create" | "update">("create");
  const [importTargetDocumentId, setImportTargetDocumentId] = useState<string>(selectedDocumentId);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importStatusText, setImportStatusText] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [shareInitialScope, setShareInitialScope] = useState<"document" | "project">("document");
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportType, setExportType] = useState<"pdf" | "docx">("pdf");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState<boolean>(false);
  const [documentVersions, setDocumentVersions] = useState<DocumentVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState<boolean>(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [isRefreshingDashboard, setIsRefreshingDashboard] = useState<boolean>(false);

  // Create Project Modal state
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState<boolean>(false);
  const [isCreatingProject, setIsCreatingProject] = useState<boolean>(false);
  const [newProjCode, setNewProjCode] = useState<string>("");
  const [newProjName, setNewProjName] = useState<string>("");
  const [newProjCustomer, setNewProjCustomer] = useState<string>("Internal Team");
  const [newProjBusinessUnit, setNewProjBusinessUnit] = useState<string>("Vận hành nội bộ");

  // Edit Project Modal state
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState<boolean>(false);
  const [isSavingEditProject, setIsSavingEditProject] = useState<boolean>(false);
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
    type: "project" | "document" | "comment" | "workItem" | "workItemComment" | null;
    id: string | null;
    parentId?: string | null;
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
      setProjectMembersByProject({});
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
    if ((activeTabNav !== "projects" && activeTabNav !== "documents") || !selectedProjectId) return;
    const currentDocument = documentsList.find((document) => document.id === selectedDocumentId);
    if (currentDocument?.projectId === selectedProjectId) return;

    const firstProjectDocument = documentsList.find((document) => document.projectId === selectedProjectId);
    setSelectedDocumentId(firstProjectDocument?.id ?? "empty-document");
  }, [activeTabNav, documentsList, selectedDocumentId, selectedProjectId]);

  useEffect(() => {
    if (!isBackendConnected || !selectedDocumentId || selectedDocumentId === "empty-document") {
      setCommentsList((prev) => prev.filter((comment) => !comment.documentId));
      setSavedTags([]);
      setInferredTags([]);
      setDocumentDiff(null);
      return;
    }
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
        setWorkItems([]);
        setDashboardWorkItems([]);
        setSelectedProjectId("");
        setSelectedDocumentId("empty-document");
        setIsBackendConnected(true);
        return;
      }

      const hydratedDocuments = (
        await Promise.all(backendProjects.map((project) => fetchDocumentsByProject(project.id)))
      ).flat();
      const hydratedWorkItems = applyPendingWorkItemMoves((
        await Promise.all(
          backendProjects.map((project) =>
            fetchProjectWorkItems(project.id).catch((error) => {
              console.error(`Cannot load work items for project ${project.id}:`, error);
              return [] as WorkItem[];
            })
          )
        )
      ).flat());
      const hydratedProjectMembers = Object.fromEntries(
        await Promise.all(
          backendProjects.map(async (project) => {
            try {
              return [project.id, await fetchProjectMembers(project.id)] as const;
            } catch (error) {
              console.error(`Cannot load project members for project ${project.id}:`, error);
              return [project.id, [] as ProjectMemberOption[]] as const;
            }
          })
        )
      );
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
      setProjectMembersByProject(hydratedProjectMembers);
      setDocumentCommentCounts(
        Object.fromEntries(hydratedDocuments.map((document) => [document.id, document.openCommentsCount ?? 0]))
      );
      setDashboardWorkItems(hydratedWorkItems);
      setWorkItems(hydratedWorkItems.filter((item) => item.projectId === finalProjectId));
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
    await Promise.all([loadWorkboardColumns(projectId), loadProjectWorkItems(projectId)]);
  }

  async function loadProjectWorkItems(projectId: string) {
    if (!projectId) return;
    setIsLoadingWorkItems(true);
    try {
      const nextItems = applyPendingWorkItemMoves(await fetchProjectWorkItems(projectId));
      setWorkItems((prev) => mergeStableWorkItems(prev, nextItems));
      setDashboardWorkItems((prev) => mergeStableWorkItems(prev, nextItems, projectId));
    } catch (error) {
      console.error("Cannot load project work items:", error);
      setWorkItems([]);
    } finally {
      setIsLoadingWorkItems(false);
    }
  }

  function mergeStableWorkItems(prevItems: WorkItem[], nextItems: WorkItem[], projectId?: string) {
    const nextById = new Map(nextItems.map((item) => [item.id, item]));
    const previousScopedItems = projectId ? prevItems.filter((item) => item.projectId === projectId) : prevItems;
    const keptIds = new Set<string>();
    const stableScopedItems = previousScopedItems
      .map((item) => {
        const next = nextById.get(item.id);
        if (!next) return null;
        keptIds.add(item.id);
        return next;
      })
      .filter((item): item is WorkItem => Boolean(item));
    const appendedItems = nextItems.filter((item) => !keptIds.has(item.id));
    if (!projectId) return [...stableScopedItems, ...appendedItems];
    return [
      ...stableScopedItems,
      ...appendedItems,
      ...prevItems.filter((item) => item.projectId !== projectId)
    ];
  }

  function statusForWorkboardColumn(column?: WorkboardColumn | null): WorkItemStatus {
    if (!column) return "BACKLOG";
    if ((["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "BLOCKED", "DONE"] as string[]).includes(column.key)) {
      return column.key as WorkItemStatus;
    }
    if (column.isDone || column.type === "DONE" || column.type === "ARCHIVED") return "DONE";
    if (column.type === "BLOCKED") return "BLOCKED";
    if (["REVIEW", "QA", "WAITING", "REWORK", "APPROVED"].includes(column.type)) return "REVIEW";
    if (column.type === "IN_PROGRESS") return "IN_PROGRESS";
    if (column.type === "INTAKE") return "BACKLOG";
    return "TODO";
  }

  function resolveWorkItemColumn(item: WorkItem, columns: WorkboardColumn[]) {
    const exactColumn = item.columnId ? columns.find((column) => column.id === item.columnId) : undefined;
    if (exactColumn) return exactColumn;

    const keyColumn = columns.find((column) => column.key === item.status);
    if (keyColumn) return keyColumn;

    const statusColumn = columns.find((column) => statusForWorkboardColumn(column) === item.status);
    return statusColumn ?? columns[0] ?? null;
  }

  function workItemBelongsToColumn(item: WorkItem, column: WorkboardColumn, columns?: WorkboardColumn[]) {
    if (item.columnId === column.id) return true;
    if (columns?.some((entry) => entry.id === item.columnId)) return false;
    if (columns) return resolveWorkItemColumn(item, columns)?.id === column.id;
    return item.status === column.key || (!item.columnId && item.status === statusForWorkboardColumn(column));
  }

  function moveWorkItemToColumn(
    items: WorkItem[],
    workItemId: string,
    column: WorkboardColumn,
    targetId?: string,
    placement: "before" | "after" | "end" = "end"
  ) {
    const currentItem = items.find((item) => item.id === workItemId);
    if (!currentItem || targetId === workItemId) return items;
    const movedItem = { ...currentItem, columnId: column.id, column, status: statusForWorkboardColumn(column) };
    const remainingItems = items.filter((item) => item.id !== workItemId);
    if (targetId) {
      const targetIndex = remainingItems.findIndex((item) => item.id === targetId);
      if (targetIndex >= 0) {
        const insertIndex = placement === "after" ? targetIndex + 1 : targetIndex;
        return [
          ...remainingItems.slice(0, insertIndex),
          movedItem,
          ...remainingItems.slice(insertIndex)
        ];
      }
    }

    const sameColumnIndexes = remainingItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => workItemBelongsToColumn(item, column))
      .map(({ index }) => index);
    if (!sameColumnIndexes.length) return [...remainingItems, movedItem];
    const insertIndex = sameColumnIndexes[sameColumnIndexes.length - 1] + 1;
    return [
      ...remainingItems.slice(0, insertIndex),
      movedItem,
      ...remainingItems.slice(insertIndex)
    ];
  }

  function applyPendingWorkItemMoves(items: WorkItem[]) {
    const pendingMoves = pendingWorkItemMovesRef.current;
    return items.map((item) => {
      const pendingMove = pendingMoves[item.id];
      return pendingMove ? { ...item, status: pendingMove.status, columnId: pendingMove.columnId ?? item.columnId } : item;
    });
  }

  async function loadWorkboardColumns(projectId: string) {
    if (!projectId) return DEFAULT_WORKBOARD_COLUMNS;
    try {
      const columns = await fetchWorkboardColumns(projectId);
      const normalized = columns.length ? columns : DEFAULT_WORKBOARD_COLUMNS.map((column) => ({ ...column, projectId }));
      setWorkboardColumnsByProject((prev) => ({ ...prev, [projectId]: normalized }));
      return normalized;
    } catch (error) {
      console.error("Cannot load workboard columns:", error);
      const fallback = DEFAULT_WORKBOARD_COLUMNS.map((column) => ({ ...column, projectId }));
      setWorkboardColumnsByProject((prev) => ({ ...prev, [projectId]: prev[projectId] ?? fallback }));
      return fallback;
    }
  }

  async function loadProjectMembers(projectId: string) {
    if (!projectId) return;
    try {
      const members = await fetchProjectMembers(projectId);
      setProjectMembersByProject((prev) => ({ ...prev, [projectId]: members }));
    } catch (error) {
      console.error("Cannot load project members:", error);
    }
  }

  async function handleShareAccessChanged(scope: "document" | "project", targetId: string) {
    const projectIdToRefresh =
      scope === "project"
        ? targetId
        : documentsList.find((document) => document.id === targetId)?.projectId ?? selectedProject.id;
    await loadProjectMembers(projectIdToRefresh);
    await loadRoleDashboard();
  }

  async function loadRoleDashboard() {
    setIsRefreshingDashboard(true);
    try {
      setRoleDashboard(await fetchRoleDashboard());
    } catch (error) {
      console.error("Cannot load role dashboard:", error);
    } finally {
      setIsRefreshingDashboard(false);
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

  function handleDocumentSelection(event?: MouseEvent | ReactMouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>) {
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

    const overlayRects = getSelectionOverlayRects(range);

    clearActiveCommentHighlight();
    activeCommentSelectionRangeRef.current = range.cloneRange();
    setSelectionHighlightRects(overlayRects);
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
    const anchorPoint = getSelectionAnchorPoint(overlayRects, event);
    const targetRect = anchorPoint ? null : getSelectionEndRect(range);

    setSelectedCommentTarget({
      blockId,
      selectedText: selectedText.slice(0, 1000)
    });
    setIsSelectionComposerOpen(false);
    if (anchorPoint) {
      setSelectionPopover(getSelectionPopoverPositionFromPoint(anchorPoint));
    } else if (targetRect) {
      setSelectionPopover(getSelectionPopoverPosition(targetRect));
    }
    setActiveBlockId(blockId);
    setShowCommentsPanel(true);
  }

  function getSelectionPointerPoint(event?: MouseEvent | ReactMouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>) {
    if (!event || !("clientX" in event) || !("clientY" in event)) return null;
    if (typeof event.clientX !== "number" || typeof event.clientY !== "number") return null;
    if (event.clientX <= 0 && event.clientY <= 0) return null;
    const docPage = documentContainerRef.current?.closest(".doc-page") as HTMLElement | null;
    if (!docPage) return null;

    const pageRect = docPage.getBoundingClientRect();
    return {
      x: event.clientX - pageRect.left + docPage.scrollLeft,
      y: event.clientY - pageRect.top + docPage.scrollTop
    };
  }

  function getSelectionAnchorPoint(
    rects: Array<{ top: number; left: number; width: number; height: number }>,
    event?: MouseEvent | ReactMouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>
  ) {
    const pointerPoint = getSelectionPointerPoint(event);

    if (rects.length === 0) return pointerPoint;

    if (!pointerPoint) {
      const lastRect = rects[rects.length - 1];
      return { x: lastRect.left + lastRect.width, y: lastRect.top + lastRect.height };
    }

    const nearestRect = rects.reduce((nearest, rect) => {
      const nearestDistance = distancePointToRect(pointerPoint, nearest);
      const rectDistance = distancePointToRect(pointerPoint, rect);
      return rectDistance < nearestDistance ? rect : nearest;
    }, rects[0]);

    return {
      x: Math.min(Math.max(pointerPoint.x, nearestRect.left), nearestRect.left + nearestRect.width),
      y: nearestRect.top + nearestRect.height
    };
  }

  function distancePointToRect(point: { x: number; y: number }, rect: { top: number; left: number; width: number; height: number }) {
    const right = rect.left + rect.width;
    const bottom = rect.top + rect.height;
    const dx = point.x < rect.left ? rect.left - point.x : point.x > right ? point.x - right : 0;
    const dy = point.y < rect.top ? rect.top - point.y : point.y > bottom ? point.y - bottom : 0;
    return Math.hypot(dx, dy);
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
    const edgeRange = range.cloneRange();
    edgeRange.collapse(false);

    const edgeRect = firstUsableRect(edgeRange);
    if (edgeRect) return edgeRect;

    const lastCharacterRange = getLastCharacterRange(range);
    const lastCharacterRect = lastCharacterRange ? firstUsableRect(lastCharacterRange) : null;
    if (lastCharacterRect) {
      return new DOMRect(
        lastCharacterRect.right,
        lastCharacterRect.top,
        1,
        lastCharacterRect.height
      );
    }

    const rects = Array.from(range.getClientRects()).filter(isUsableRect);
    const lastRect = rects[rects.length - 1];
    if (lastRect) return new DOMRect(lastRect.right, lastRect.top, 1, lastRect.height);

    const boundingRect = range.getBoundingClientRect();
    return boundingRect.width || boundingRect.height ? boundingRect : null;
  }

  function firstUsableRect(range: Range) {
    return Array.from(range.getClientRects()).find(isUsableRect) ?? null;
  }

  function isUsableRect(rect: DOMRect) {
    return rect.width > 0 && rect.height > 0;
  }

  function getLastCharacterRange(range: Range) {
    const walkerRoot = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    if (!walkerRoot) return null;

    const walker = document.createTreeWalker(walkerRoot, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    let lastTextNode: Text | null = null;
    while (walker.nextNode()) {
      lastTextNode = walker.currentNode as Text;
    }
    if (!lastTextNode) return null;

    const endOffset = lastTextNode === range.endContainer
      ? Math.min(range.endOffset, lastTextNode.length)
      : lastTextNode.length;
    if (endOffset <= 0) return null;

    const lastCharacterRange = document.createRange();
    lastCharacterRange.setStart(lastTextNode, Math.max(0, endOffset - 1));
    lastCharacterRange.setEnd(lastTextNode, endOffset);
    return lastCharacterRange;
  }

  function getSelectionPopoverPosition(rect: DOMRect) {
    const docPage = documentContainerRef.current?.closest(".doc-page") as HTMLElement | null;
    if (!docPage) {
      return { top: rect.bottom, left: rect.right };
    }

    const pageRect = docPage.getBoundingClientRect();
    return getSelectionPopoverPositionFromPoint({
      x: rect.right - pageRect.left + docPage.scrollLeft,
      y: rect.bottom - pageRect.top + docPage.scrollTop
    });
  }

  function getSelectionPopoverPositionFromPoint(point: { x: number; y: number }) {
    const docPage = documentContainerRef.current?.closest(".doc-page") as HTMLElement | null;
    const toolbarWidth = 168;
    const toolbarHeight = 38;
    const viewportGutter = 10;
    const anchorGap = 8;
    const visibleLeft = (docPage?.scrollLeft ?? 0) + viewportGutter;
    const visibleTop = (docPage?.scrollTop ?? 0) + viewportGutter;
    const visibleRight = (docPage?.scrollLeft ?? 0) + (docPage?.clientWidth ?? window.innerWidth) - viewportGutter;
    const visibleBottom = (docPage?.scrollTop ?? 0) + (docPage?.clientHeight ?? window.innerHeight) - viewportGutter;
    const preferredTop = point.y + anchorGap;
    const top = preferredTop + toolbarHeight > visibleBottom
      ? Math.max(visibleTop, point.y - toolbarHeight - anchorGap)
      : Math.max(visibleTop, preferredTop);
    const preferredLeft = point.x + anchorGap;
    const left = preferredLeft + toolbarWidth > visibleRight
      ? Math.max(visibleLeft, point.x - toolbarWidth)
      : Math.max(visibleLeft, preferredLeft);

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
    if (!selectedCommentTarget?.selectedText) {
      addToast("warning", "Chưa chọn đoạn", "Bôi đen đoạn cần góp ý trong tài liệu trước khi nhận xét.");
      return;
    }
    setShowCommentsPanel(true);
    setIsSelectionComposerOpen(true);
    window.setTimeout(() => inlineCommentTextareaRef.current?.focus(), 50);
  }

  async function handleCopySelectedText() {
    if (!selectedCommentTarget?.selectedText) {
      addToast("warning", "Chưa chọn đoạn", "Bôi đen đoạn cần copy trong tài liệu trước.");
      return;
    }

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

  const visibleProjectsList = useMemo(() => {
    const projectsById = new Map(projectsList.map((project) => [project.id, project]));
    (roleDashboard?.projectBreakdown ?? []).forEach((project) => {
      if (projectsById.has(project.id)) return;
      projectsById.set(project.id, {
        id: project.id,
        code: project.code,
        name: project.name,
        client: project.client ?? "Internal Team • Vận hành nội bộ",
        progress: project.documents > 0 ? 100 : 0,
        openComments: project.openComments,
        documents: project.documents,
        updatedAt: project.updatedAt
      });
    });
    return Array.from(projectsById.values());
  }, [projectsList, roleDashboard?.projectBreakdown]);

  const selectedProject = useMemo(
    () =>
      visibleProjectsList.find((p) => p.id === selectedProjectId) ??
      visibleProjectsList[0] ?? {
        id: "",
        code: "NO-PROJECT",
        name: "Chưa có dự án",
        client: "Internal Team",
        progress: 0,
        openComments: 0,
        documents: 0
      },
    [visibleProjectsList, selectedProjectId]
  );

  // Documents for current scope
  const projectDocuments = useMemo(() => {
    return documentsList.filter((doc) => doc.projectId === selectedProjectId);
  }, [documentsList, selectedProjectId]);

  const projectDeployedDocuments = useMemo(() => {
    return projectDocuments.filter((doc) => doc.status === "Triển khai");
  }, [projectDocuments]);

  const selectedWorkItemAssignees = useMemo(
    () => {
      if (!workItemDraft) return [];
      if (workItemDraft.assigneeIds.length) {
        const members = projectMembersByProject[workItemDraft.projectId] ?? [];
        return workItemDraft.assigneeIds
          .map((id) => members.find((member) => member.id === id)?.name)
          .filter((name): name is string => Boolean(name));
      }
      return splitAssigneeNames(workItemDraft.assigneeName);
    },
    [projectMembersByProject, workItemDraft]
  );

  const workItemAssigneeOptions = useMemo(() => {
    const targetProjectId = workItemDraft?.projectId || selectedProjectId;
    const projectMembers = projectMembersByProject[targetProjectId] ?? [];
    const options = projectMembers.filter((member) => canAssignMemberToWorkItem(member, workItemDraft));
    if (currentUser && !options.some((member) => member.id === currentUser.id || member.email?.toLowerCase() === currentUser.email.toLowerCase())) {
      options.push({
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        source: "PROJECT"
      });
    }
    return options.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [currentUser, projectMembersByProject, selectedProjectId, workItemDraft]);

  useEffect(() => {
    if (!isAssigneeMenuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (!workItemAssigneeDropdownRef.current?.contains(event.target as Node)) {
        setIsAssigneeMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAssigneeMenuOpen]);

  // Handle project change: auto select first document of new project
  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
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
    const selected = projectDocuments.find((doc) => doc.id === selectedDocumentId);
    const doc = selected ?? projectDocuments[0] ?? EMPTY_DOCUMENT;
    return {
      ...doc,
      title: normalizeVietnameseText(doc.title),
      contentHtml: normalizeVietnameseText(doc.contentHtml || "")
    };
  }, [selectedDocumentId, projectDocuments]);

  function openShareAccessModal() {
    if (selectedDocument.id === "empty-document") {
      setShareInitialScope("project");
      addToast("info", "Chưa có tài liệu để chia sẻ", "Mình chuyển sang chia sẻ quyền toàn dự án trước.");
    } else {
      setShareInitialScope("document");
    }
    setIsShareModalOpen(true);
  }

  const importTargetDocuments = useMemo(
    () => documentsList.filter((doc) => doc.projectId === importTargetProjectId),
    [documentsList, importTargetProjectId]
  );

  // Filtered documents list
  const filteredDocuments = useMemo(() => {
    return projectDocuments.filter((doc) => {
      const matchesStatus = statusFilter === "All" || doc.status === statusFilter;
      const matchesSearch =
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.owner.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [projectDocuments, statusFilter, searchQuery]);

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

  const selectedWorkboardColumns = useMemo(() => {
    const columns = workboardColumnsByProject[selectedProjectId];
    return (columns?.length ? columns : DEFAULT_WORKBOARD_COLUMNS.map((column) => ({ ...column, projectId: selectedProjectId })))
      .slice()
      .sort((first, second) => first.position - second.position);
  }, [selectedProjectId, workboardColumnsByProject]);

  const selectedDefaultWorkboardColumn = useMemo(
    () => selectedWorkboardColumns.find((column) => column.isDefault) ?? selectedWorkboardColumns[0] ?? null,
    [selectedWorkboardColumns]
  );

  function workboardColumnLabelForItem(item: WorkItem) {
    return item.column?.name ??
      resolveWorkItemColumn(item, selectedWorkboardColumns)?.name ??
      DEFAULT_WORKBOARD_COLUMNS.find((column) => column.key === item.status)?.name ??
      item.status;
  }

  function workboardColumnHint(column: WorkboardColumn) {
    return WORKBOARD_COLUMN_TYPE_OPTIONS.find((option) => option.value === column.type)?.label ?? "Đang mở";
  }

  function dashboardColumnLabelForItem(item: WorkItem) {
    return item.column?.name ??
      resolveWorkItemColumn(item, workboardColumnsByProject[item.projectId] ?? [])?.name ??
      DEFAULT_WORKBOARD_COLUMNS.find((column) => column.key === item.status)?.name ??
      item.status;
  }

  const workboardAssigneeOptions = useMemo(() => {
    const names = workItems
      .flatMap(workItemAssigneeNames)
      .filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "vi"));
  }, [workItems]);

  const workboardCreatorOptions = useMemo(() => {
    const names = workItems
      .map(getWorkItemCreatorName)
      .filter((name) => name && name !== "Không rõ");
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "vi"));
  }, [workItems]);

  const visibleWorkItems = useMemo(() => {
    const filtered = workItems.filter((item) => {
      const matchesType = workboardTypeFilter === "ALL" || item.type === workboardTypeFilter;
      const matchesPriority = workboardPriorityFilter === "ALL" || item.priority === workboardPriorityFilter;
      const matchesAssignee =
        workboardAssigneeFilter === "ALL" ||
        workItemAssigneeNames(item).includes(workboardAssigneeFilter);
      const matchesCreator = workboardCreatorFilter === "ALL" || getWorkItemCreatorName(item) === workboardCreatorFilter;
      const query = workboardSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        displayWorkItemTitle(item).toLowerCase().includes(query) ||
        (item.description ?? "").toLowerCase().includes(query) ||
        (item.document?.title ?? "").toLowerCase().includes(query) ||
        workItemAssigneeLabel(item).toLowerCase().includes(query) ||
        getWorkItemCreatorName(item).toLowerCase().includes(query);
      return matchesType && matchesPriority && matchesAssignee && matchesCreator && matchesSearch;
    });

    if (workboardSortBy === "BOARD_ORDER") return filtered;

    return [...filtered].sort((first, second) => {
      if (workboardSortBy === "PRIORITY_DESC") {
        return WORK_ITEM_PRIORITY_RANK[second.priority] - WORK_ITEM_PRIORITY_RANK[first.priority] ||
          (parseDashboardDate(second.updatedAt ?? second.createdAt)?.getTime() ?? 0) -
          (parseDashboardDate(first.updatedAt ?? first.createdAt)?.getTime() ?? 0);
      }
      if (workboardSortBy === "DUE_ASC") {
        const firstDue = getWorkItemDueEndOfDay(first.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
        const secondDue = getWorkItemDueEndOfDay(second.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
        return firstDue - secondDue ||
          WORK_ITEM_PRIORITY_RANK[second.priority] - WORK_ITEM_PRIORITY_RANK[first.priority];
      }
      return (parseDashboardDate(second.updatedAt ?? second.createdAt)?.getTime() ?? 0) -
        (parseDashboardDate(first.updatedAt ?? first.createdAt)?.getTime() ?? 0);
    });
  }, [
    workItems,
    workboardAssigneeFilter,
    workboardCreatorFilter,
    workboardPriorityFilter,
    workboardSearchQuery,
    workboardSortBy,
    workboardTypeFilter
  ]);

  const workboardMetrics = useMemo(() => {
    const isDoneItem = (item: WorkItem) => item.column?.isDone || item.status === "DONE";
    const isBlockedItem = (item: WorkItem) => item.column?.type === "BLOCKED" || item.status === "BLOCKED";
    const openItems = workItems.filter((item) => !isDoneItem(item));
    const criticalBugs = workItems.filter((item) => item.type === "BUG" && item.priority === "CRITICAL" && !isDoneItem(item));
    const blockedItems = workItems.filter(isBlockedItem);
    const overdueItems = workItems.filter(isWorkItemOverdue);
    const doneItems = workItems.filter(isDoneItem);
    const completionRate = workItems.length ? Math.round((doneItems.length / workItems.length) * 100) : 0;
    return { openItems, criticalBugs, blockedItems, overdueItems, doneItems, completionRate };
  }, [workItems]);

  const viewingWorkItem = useMemo(
    () => workItems.find((item) => item.id === viewingWorkItemId) ?? null,
    [viewingWorkItemId, workItems]
  );

  const workItemMentionOptions = useMemo(() => {
    if (!viewingWorkItem) return [];
    const options = new Map<string, ProjectMemberOption>();
    (projectMembersByProject[viewingWorkItem.projectId] ?? []).forEach((member) => {
      options.set(member.id, member);
    });
    (viewingWorkItem.assignees ?? []).forEach((assignee) => {
      options.set(assignee.userId, {
        id: assignee.userId,
        name: assignee.user.name,
        email: assignee.user.email
      });
    });
    if (viewingWorkItem.createdBy?.id) {
      options.set(viewingWorkItem.createdBy.id, {
        id: viewingWorkItem.createdBy.id,
        name: viewingWorkItem.createdBy.name,
        email: viewingWorkItem.createdBy.email
      });
    }
    if (currentUser) {
      options.set(currentUser.id, {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role
      });
    }
    return Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [currentUser, projectMembersByProject, viewingWorkItem]);

  function workItemTypeIcon(type: WorkItemType) {
    if (type === "BUG") return <AlertTriangle size={13} />;
    if (type === "REVIEW") return <MessageSquareText size={13} />;
    if (type === "CHANGE_REQUEST") return <FileDiff size={13} />;
    if (type === "QUESTION") return <MessageSquarePlus size={13} />;
    return <CheckCircle2 size={13} />;
  }

  function renderMentionedText(content: string, isInputHighlight = false) {
    const mentionNames = workItemMentionOptions
      .map((member) => member.name.trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    if (!mentionNames.length) {
      if (isInputHighlight) {
        return <span className="workitem-mention-plain">{content}{content.endsWith("\n") ? "\u200B" : ""}</span>;
      }
      return content;
    }

    const nodes: ReactNode[] = [];
    let cursor = 0;
    while (cursor < content.length) {
      const atIndex = content.indexOf("@", cursor);
      if (atIndex < 0) {
        const remaining = content.slice(cursor);
        nodes.push(
          isInputHighlight ? (
            <span className="workitem-mention-plain" key={`plain-${cursor}`}>
              {remaining}
            </span>
          ) : (
            remaining
          )
        );
        break;
      }

      const matchedName = mentionNames.find((name) => content.slice(atIndex + 1).startsWith(name));
      if (!matchedName) {
        const textChunk = content.slice(cursor, atIndex + 1);
        nodes.push(
          isInputHighlight ? (
            <span className="workitem-mention-plain" key={`plain-${cursor}`}>
              {textChunk}
            </span>
          ) : (
            textChunk
          )
        );
        cursor = atIndex + 1;
        continue;
      }

      if (atIndex > cursor) {
        const textChunk = content.slice(cursor, atIndex);
        nodes.push(
          isInputHighlight ? (
            <span className="workitem-mention-plain" key={`plain-${cursor}`}>
              {textChunk}
            </span>
          ) : (
            textChunk
          )
        );
      }

      nodes.push(
        <span className={isInputHighlight ? "workitem-mention-pill" : "workitem-mentioned-user"} key={`${atIndex}-${matchedName}`}>
          @{matchedName}
        </span>
      );
      cursor = atIndex + matchedName.length + 1;
    }

    if (isInputHighlight && content.endsWith("\n")) {
      nodes.push(<span className="workitem-mention-plain" key="trailing-newline">{"\u200B"}</span>);
    }

    return nodes;
  }

  function formatWorkItemDate(value?: string | null) {
    if (!value) return "Chưa có hạn";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Chưa có hạn";
    return date.toLocaleDateString("vi-VN");
  }

  function copyTitleMeta(title: string) {
    const suffixRegex = /\s*\(Copy(?:\s+(\d+))?\)$/i;
    let root = title.trim();
    const suffixNumbers: number[] = [];
    while (suffixRegex.test(root)) {
      const match = root.match(suffixRegex);
      suffixNumbers.unshift(match?.[1] ? Number(match[1]) : 0);
      root = root.replace(suffixRegex, "").trim();
    }
    if (!suffixNumbers.length) return { root, copyNumber: 0 };
    const numberedSuffix = suffixNumbers.find((number) => number > 0);
    return { root, copyNumber: numberedSuffix ?? suffixNumbers.length };
  }

  function displayWorkItemTitle(item: WorkItem) {
    const meta = copyTitleMeta(item.title);
    if (!meta.copyNumber) return item.title;
    return `${meta.root} (Copy ${meta.copyNumber})`;
  }

  function nextDuplicateWorkItemTitle(item: WorkItem) {
    const root = copyTitleMeta(item.title).root;
    const sameProjectItems = dashboardWorkItems.filter((candidate) => candidate.projectId === item.projectId);
    const maxCopyNumber = sameProjectItems.reduce((max, candidate) => {
      const meta = copyTitleMeta(candidate.title);
      return meta.root === root ? Math.max(max, meta.copyNumber) : max;
    }, 0);
    return `${root} (Copy ${maxCopyNumber + 1})`;
  }

  function getWorkItemDueEndOfDay(value?: string | null) {
    if (!value) return null;
    const datePart = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (datePart) {
      const [, year, month, day] = datePart;
      return new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999);
    }
    const dueDate = new Date(value);
    if (Number.isNaN(dueDate.getTime())) return null;
    dueDate.setHours(23, 59, 59, 999);
    return dueDate;
  }

  function parseWorkItemAttachments(value: string) {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((url) => ({
        url,
        name: url.split("/").pop() || "Attachment",
        mimeType: inferAttachmentMimeType(url)
      }));
  }

  function inferAttachmentMimeType(url: string) {
    const cleanUrl = url.split("?")[0].toLowerCase();
    if (/\.(png|jpe?g|gif|webp|avif)$/.test(cleanUrl)) return "image";
    if (/\.(mp4|webm|mov|m4v)$/.test(cleanUrl)) return "video";
    return "link";
  }

  function isVideoAttachment(attachment: { url: string; mimeType?: string | null }) {
    return attachment.mimeType?.startsWith("video") || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(attachment.url);
  }

  function isImageAttachment(attachment: { url: string; mimeType?: string | null }) {
    return attachment.mimeType?.startsWith("image") || /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(attachment.url);
  }

  function isCurrentUserEmail(email?: string | null) {
    return Boolean(email && currentUser?.email && email.trim().toLowerCase() === currentUser.email.trim().toLowerCase());
  }

  function isCurrentUserName(name?: string | null) {
    return Boolean(name && currentUser?.name && name.trim() === currentUser.name.trim());
  }

  function isOwnDocumentComment(comment: CommentThread) {
    return isCurrentUserEmail(comment.authorEmail) || isCurrentUserEmail(comment.author) || isCurrentUserName(comment.author);
  }

  function isOwnWorkItem(item: WorkItem) {
    return item.createdBy?.id === currentUser?.id || isCurrentUserEmail(item.createdByEmail) || isCurrentUserName(item.createdByName);
  }

  function getWorkItemCreatorName(item: WorkItem) {
    return item.createdByName ?? item.createdBy?.name ?? item.createdByEmail ?? "Không rõ";
  }

  function workItemActivityLabel(activity: WorkItemActivity) {
    const labels: Record<string, string> = {
      WORK_ITEM_CREATED: "Tạo ticket",
      WORK_ITEM_UPDATED: "Cập nhật ticket",
      WORK_ITEM_DELETED: "Xóa ticket",
      WORK_ITEM_ATTACHMENT_ADDED: "Thêm đính kèm",
      WORK_ITEM_COMMENT_CREATED: "Thêm comment",
      WORK_ITEM_REPLY_CREATED: "Reply comment",
      WORK_ITEM_COMMENT_UPDATED: "Sửa comment",
      WORK_ITEM_COMMENT_DELETED: "Xóa comment"
    };
    return labels[activity.action] ?? activity.action;
  }

  function workItemActivityDetail(activity: WorkItemActivity) {
    const changes = activity.metadata?.changes;
    if (!changes || typeof changes !== "object" || Array.isArray(changes)) return "";

    const fieldLabels: Record<string, string> = {
      column: "Cột",
      columnId: "Cột",
      status: "Trạng thái",
      priority: "Độ ưu tiên",
      type: "Loại",
      title: "Tiêu đề",
      description: "Mô tả",
      assigneeName: "Người phụ trách",
      dueDate: "Hạn xử lý",
      labelsText: "Labels",
      checklistText: "Checklist",
      documentId: "Tài liệu"
    };

    function resolveValue(field: string, val: unknown): string {
      if (val === null || val === undefined || val === "") return "trống";
      const s = Array.isArray(val) ? val.join(", ") : String(val);
      // Resolve column IDs to names
      if (field === "column" || field === "columnId") {
        const col = selectedWorkboardColumns.find((c) => c.id === s);
        if (col) return col.name;
      }
      // Resolve priority
      if (field === "priority" && WORK_ITEM_PRIORITY_LABEL[s as keyof typeof WORK_ITEM_PRIORITY_LABEL]) {
        return WORK_ITEM_PRIORITY_LABEL[s as keyof typeof WORK_ITEM_PRIORITY_LABEL];
      }
      // Resolve type
      if (field === "type" && WORK_ITEM_TYPE_LABEL[s as keyof typeof WORK_ITEM_TYPE_LABEL]) {
        return WORK_ITEM_TYPE_LABEL[s as keyof typeof WORK_ITEM_TYPE_LABEL];
      }
      return s;
    }

    return Object.entries(changes as Record<string, { from?: unknown; to?: unknown }>)
      .slice(0, 4)
      .map(([field, value]) => {
        const label = fieldLabels[field] ?? field;
        const from = resolveValue(field, value.from);
        const to = resolveValue(field, value.to);
        return `${label}: ${from} → ${to}`;
      })
      .join(" · ");
  }

  function isOwnWorkItemComment(comment: WorkItemComment) {
    return comment.createdBy?.id === currentUser?.id || isCurrentUserEmail(comment.createdByEmail);
  }

  function isWorkItemOverdue(item: WorkItem) {
    if (!item.dueDate || item.status === "DONE") return false;
    const dueDate = getWorkItemDueEndOfDay(item.dueDate);
    return Boolean(dueDate && dueDate.getTime() < Date.now());
  }

  function openDashboardWorkItem(item: WorkItem) {
    setSelectedProjectId(item.projectId);
    setSelectedDocumentId(item.documentId ?? documentsList.find((document) => document.projectId === item.projectId)?.id ?? "empty-document");
    setActiveTabNav("review");
    openViewWorkItemModal(item);
    void loadProjectWorkItems(item.projectId);
  }

  async function handleDropWorkItem(column: WorkboardColumn, targetId?: string, placement: "before" | "after" | "end" = "end") {
    if (!draggingWorkItemId) return;
    const item = workItems.find((workItem) => workItem.id === draggingWorkItemId);
    setDraggingWorkItemId(null);
    if (!item || item.id === targetId) return;

    const previousStatus = item.status;
    const previousColumnId = item.columnId;
    const nextStatus = statusForWorkboardColumn(column);
    if (workItemBelongsToColumn(item, column, selectedWorkboardColumns)) {
      setWorkItems((prev) => moveWorkItemToColumn(prev, item.id, column, targetId, placement));
      setDashboardWorkItems((prev) => moveWorkItemToColumn(prev, item.id, column, targetId, placement));
      return;
    }

    const moveToken = ++workItemMoveTokenRef.current;
    pendingWorkItemMovesRef.current[item.id] = { status: nextStatus, columnId: column.id, previousStatus, previousColumnId, token: moveToken };
    setWorkItems((prev) => moveWorkItemToColumn(prev, item.id, column, targetId, placement));
    setDashboardWorkItems((prev) => moveWorkItemToColumn(prev, item.id, column, targetId, placement));
    try {
      const updated = await updateWorkItem(item.id, { columnId: column.id });
      if (pendingWorkItemMovesRef.current[item.id]?.token !== moveToken) return;
      delete pendingWorkItemMovesRef.current[item.id];
      setWorkItems((prev) => prev.map((workItem) => workItem.id === updated.id ? updated : workItem));
      setDashboardWorkItems((prev) => prev.map((workItem) => workItem.id === updated.id ? updated : workItem));
    } catch (error) {
      if (pendingWorkItemMovesRef.current[item.id]?.token !== moveToken) return;
      delete pendingWorkItemMovesRef.current[item.id];
      console.error("Drop work item error:", error);
      const previousColumn = selectedWorkboardColumns.find((entry) => entry.id === previousColumnId || entry.key === previousStatus) ??
        DEFAULT_WORKBOARD_COLUMNS.find((entry) => entry.key === previousStatus) ??
        column;
      setWorkItems((prev) => moveWorkItemToColumn(prev, item.id, previousColumn));
      setDashboardWorkItems((prev) => moveWorkItemToColumn(prev, item.id, previousColumn));
      addToast("error", "Không đổi được trạng thái", "BE chưa cập nhật trạng thái work item.");
    }
  }

  function buildWorkItemDraft(overrides: Partial<WorkItemDraft> = {}): WorkItemDraft {
    return {
      projectId: selectedProject.id,
      documentId: selectedDocument.id !== "empty-document" && selectedDocument.status === "Triển khai" ? selectedDocument.id : "",
      type: "TASK",
      status: selectedDefaultWorkboardColumn ? statusForWorkboardColumn(selectedDefaultWorkboardColumn) : "BACKLOG",
      columnId: selectedDefaultWorkboardColumn?.id ?? "BACKLOG",
      priority: "MEDIUM",
      title: "",
      description: "",
      assigneeName: "",
      assigneeIds: [],
      dueDate: new Date().toISOString().slice(0, 10),
      attachmentsText: "",
      checklistText: "",
      labelsText: "",
      ...overrides
    };
  }

  function openCreateWorkItemModal(column: WorkboardColumn | null = selectedDefaultWorkboardColumn) {
    setWorkItemDraft(buildWorkItemDraft({
      status: column ? statusForWorkboardColumn(column) : "BACKLOG",
      columnId: column?.id ?? "BACKLOG"
    }));
    setIsAssigneeMenuOpen(false);
    void loadProjectMembers(selectedProject.id);
    setIsWorkItemModalOpen(true);
  }

  function openWorkboardConfigModal() {
    setWorkboardColumnDrafts(selectedWorkboardColumns.map((column) => ({
      id: column.id.startsWith(column.key) && !workboardColumnsByProject[selectedProjectId]?.length ? undefined : column.id,
      name: column.name,
      color: column.color,
      type: column.type,
      isDefault: column.isDefault,
      isDone: column.isDone
    })));
    setIsWorkboardConfigOpen(true);
  }

  function updateWorkboardColumnDraft(index: number, patch: Partial<WorkboardColumnDraft>) {
    setWorkboardColumnDrafts((prev) => prev.map((draft, draftIndex) => {
      if (draftIndex !== index) return draft;
      const next = { ...draft, ...patch };
      if (patch.isDefault) return next;
      return next;
    }).map((draft, draftIndex) => patch.isDefault && draftIndex !== index ? { ...draft, isDefault: false } : draft));
  }

  function moveWorkboardColumnDraft(index: number, direction: -1 | 1) {
    setWorkboardColumnDrafts((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [entry] = next.splice(index, 1);
      next.splice(nextIndex, 0, entry);
      return next;
    });
  }

  const wbcfgDragRef = useRef<{ fromIndex: number; toIndex: number } | null>(null);
  const [wbcfgOpenDropdown, setWbcfgOpenDropdown] = useState<number | null>(null);

  function reorderWorkboardColumnDraft(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setWorkboardColumnDrafts((prev) => {
      const next = [...prev];
      const [entry] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, entry);
      return next;
    });
  }

  function addWorkboardColumnDraft() {
    setWorkboardColumnDrafts((prev) => [
      ...prev,
      { name: "Cột mới", color: "#6366f1", type: "OPEN", isDefault: prev.length === 0, isDone: false }
    ]);
  }

  const [pendingDeleteColumnIndex, setPendingDeleteColumnIndex] = useState<number | null>(null);

  function requestRemoveWorkboardColumn(index: number) {
    setPendingDeleteColumnIndex(index);
  }

  function confirmRemoveWorkboardColumn() {
    if (pendingDeleteColumnIndex === null) return;
    setWorkboardColumnDrafts((prev) => prev.filter((_, draftIndex) => draftIndex !== pendingDeleteColumnIndex));
    setPendingDeleteColumnIndex(null);
  }

  function cancelRemoveWorkboardColumn() {
    setPendingDeleteColumnIndex(null);
  }

  async function handleSaveWorkboardColumns() {
    if (!selectedProject.id || isSavingWorkboardColumns) return;
    const normalizedDrafts = workboardColumnDrafts
      .map((draft) => ({ ...draft, name: draft.name.trim(), color: draft.color.trim() || "#6366f1" }))
      .filter((draft) => draft.name);
    if (!normalizedDrafts.length) {
      addToast("warning", "Thiếu cột", "Workboard cần ít nhất một cột.");
      return;
    }
    if (!normalizedDrafts.some((draft) => draft.isDefault)) normalizedDrafts[0].isDefault = true;

    setIsSavingWorkboardColumns(true);
    try {
      const realExistingColumns = workboardColumnsByProject[selectedProject.id] ?? [];
      const existingIds = new Set(realExistingColumns.map((column) => column.id));

      // Run all update/create calls in parallel
      const results = await Promise.all(
        normalizedDrafts.map(async (draft, index) => {
          if (draft.id && existingIds.has(draft.id)) {
            const updated = await updateWorkboardColumn(selectedProject.id, draft.id, {
              name: draft.name,
              color: draft.color,
              type: draft.type,
              position: index,
              isDefault: draft.isDefault,
              isDone: draft.isDone
            });
            return updated.id;
          } else {
            const created = await createWorkboardColumn(selectedProject.id, {
              name: draft.name,
              color: draft.color,
              type: draft.type,
              position: index,
              isDefault: draft.isDefault,
              isDone: draft.isDone
            });
            return created.id;
          }
        })
      );

      // Run all delete calls in parallel
      const removed = realExistingColumns.filter((column) => !results.includes(column.id));
      if (removed.length > 0) {
        await Promise.all(removed.map((column) => deleteWorkboardColumn(selectedProject.id, column.id)));
      }

      const columns = await reorderWorkboardColumns(selectedProject.id, results);
      setWorkboardColumnsByProject((prev) => ({ ...prev, [selectedProject.id]: columns }));
      setIsWorkboardConfigOpen(false);
      addToast("success", "Đã cập nhật board", "Mô hình Kanban của project đã được lưu.");
    } catch (error) {
      console.error("Save workboard columns error:", error);
      addToast("error", "Không lưu được board", error instanceof Error ? error.message : "BE chưa lưu được cấu hình cột.");
    } finally {
      setIsSavingWorkboardColumns(false);
    }
  }

  function openEditWorkItemModal(item: WorkItem) {
    setWorkItemDraft({
      id: item.id,
      projectId: item.projectId,
      documentId: item.documentId ?? "",
      type: item.type,
      status: item.status,
      columnId: item.columnId ?? resolveWorkItemColumn(item, selectedWorkboardColumns)?.id ?? item.status,
      priority: item.priority,
      title: displayWorkItemTitle(item),
      description: item.description ?? "",
      assigneeName: workItemAssigneeNames(item).join(", "),
      assigneeIds: item.assignees?.map((assignee) => assignee.userId) ?? (item.assigneeId ? [item.assigneeId] : []),
      dueDate: item.dueDate ? item.dueDate.slice(0, 10) : "",
      attachmentsText: (item.attachments ?? []).map((attachment) => attachment.url).join("\n"),
      checklistText: checklistToText(item),
      labelsText: workItemLabelNames(item).join(", ")
    });
    setIsAssigneeMenuOpen(false);
    void loadProjectMembers(item.projectId);
    setIsWorkItemModalOpen(true);
  }

  function toggleWorkItemAssignee(member: ProjectMemberOption) {
    if (!workItemDraft) return;
    const currentNames = splitAssigneeNames(workItemDraft.assigneeName);
    const nextNames = currentNames.includes(member.name)
      ? currentNames.filter((assignee) => assignee !== member.name)
      : [...currentNames, member.name];
    const nextIds = workItemDraft.assigneeIds.includes(member.id)
      ? workItemDraft.assigneeIds.filter((id) => id !== member.id)
      : [...workItemDraft.assigneeIds, member.id];
    setWorkItemDraft({ ...workItemDraft, assigneeIds: nextIds, assigneeName: joinAssigneeNames(nextNames) });
  }

  function openViewWorkItemModal(item: WorkItem) {
    setViewingWorkItemId(item.id);
    setWorkItemComments([]);
    setWorkItemActivity([]);
    setWorkItemCommentText("");
    setReplyingWorkItemCommentId(null);
    setWorkItemReplyText("");
    setEditingWorkItemCommentId(null);
    setEditingWorkItemCommentText("");
    void loadWorkItemComments(item.id);
    void loadWorkItemActivity(item.id);
    void loadProjectMembers(item.projectId);
  }

  async function loadWorkItemComments(workItemId: string) {
    try {
      setWorkItemComments(await fetchWorkItemComments(workItemId));
    } catch (error) {
      console.error("Cannot load work item comments:", error);
      addToast("error", "Không tải được comment", "BE chưa trả về luồng trao đổi của ticket.");
    }
  }

  async function loadWorkItemActivity(workItemId: string) {
    setIsLoadingWorkItemActivity(true);
    try {
      setWorkItemActivity(await fetchWorkItemActivity(workItemId));
    } catch (error) {
      console.error("Cannot load work item activity:", error);
      setWorkItemActivity([]);
    } finally {
      setIsLoadingWorkItemActivity(false);
    }
  }

  function groupedWorkItemComments() {
    const repliesByParent = new Map<string, WorkItemComment[]>();
    workItemComments.forEach((comment) => {
      if (!comment.parentId) return;
      repliesByParent.set(comment.parentId, [...(repliesByParent.get(comment.parentId) ?? []), comment]);
    });
    return workItemComments
      .filter((comment) => !comment.parentId)
      .map((comment) => ({ ...comment, replies: repliesByParent.get(comment.id) ?? [] }));
  }

  function getMentionTrigger(value: string) {
    const atIndex = value.lastIndexOf("@");
    if (atIndex < 0) return null;
    const query = value.slice(atIndex + 1);
    if (/[\s,;:()[\]{}]/.test(query)) return null;
    return { atIndex, query: query.toLowerCase() };
  }

  function handleWorkItemCommentTextChange(value: string, target: "comment" | "reply") {
    if (target === "comment") {
      setWorkItemCommentText(value);
    } else {
      setWorkItemReplyText(value);
    }
    setActiveWorkItemMentionTarget(getMentionTrigger(value) ? target : null);
  }

  function filteredWorkItemMentionOptions(target: "comment" | "reply") {
    const value = target === "comment" ? workItemCommentText : workItemReplyText;
    const trigger = getMentionTrigger(value);
    if (!trigger) return [];
    return workItemMentionOptions
      .filter((member) => {
        const haystack = `${member.name} ${member.email}`.toLowerCase();
        return !trigger.query || haystack.includes(trigger.query);
      })
      .slice(0, 6);
  }

  function getEditorText(el: HTMLElement): string {
    let text = "";
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.classList.contains("workitem-mention-pill")) {
          text += element.textContent;
        } else if (element.tagName === "BR") {
          text += "\n";
        } else if (element.tagName === "DIV" || element.tagName === "P") {
          text += (text ? "\n" : "") + getEditorText(element);
        } else {
          text += element.textContent;
        }
      }
    });
    return text.replace(/\u00A0/g, " ");
  }

  function insertPillAtCursor(editorEl: HTMLElement, memberName: string) {
    const sel = window.getSelection();
    let range: Range | null = null;
    if (sel && sel.rangeCount > 0) {
      const candidateRange = sel.getRangeAt(0);
      if (editorEl.contains(candidateRange.commonAncestorContainer)) {
        range = candidateRange;
      }
    }

    const pill = document.createElement("span");
    pill.className = "workitem-mention-pill";
    pill.setAttribute("contenteditable", "false");
    pill.textContent = `@${memberName}`;
    const spaceNode = document.createTextNode("\u00A0");

    if (range) {
      const textNode = range.startContainer;
      if (textNode.nodeType === Node.TEXT_NODE && textNode.textContent) {
        const text = textNode.textContent;
        const offset = range.startOffset;
        const atIndex = text.lastIndexOf("@", offset - 1);
        if (atIndex >= 0) {
          const beforeText = text.slice(0, atIndex);
          const afterText = text.slice(offset);
          textNode.textContent = beforeText;

          const parent = textNode.parentNode || editorEl;
          const nextSibling = textNode.nextSibling;

          parent.insertBefore(pill, nextSibling);
          parent.insertBefore(spaceNode, pill.nextSibling);

          if (afterText) {
            const afterNode = document.createTextNode(afterText);
            parent.insertBefore(afterNode, spaceNode.nextSibling);
          }

          const newRange = document.createRange();
          newRange.setStartAfter(spaceNode);
          newRange.setEndAfter(spaceNode);
          sel?.removeAllRanges();
          sel?.addRange(newRange);
          return;
        }
      }
    }

    // Fallback: append pill to editor
    editorEl.appendChild(pill);
    editorEl.appendChild(spaceNode);
    const newRange = document.createRange();
    newRange.setStartAfter(spaceNode);
    newRange.setEndAfter(spaceNode);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
  }

  function insertWorkItemMention(target: "comment" | "reply", member: ProjectMemberOption) {
    const editorEl = target === "comment" ? commentEditorRef.current : replyEditorRef.current;
    if (editorEl) {
      editorEl.focus();
      insertPillAtCursor(editorEl, member.name);
      const text = getEditorText(editorEl);
      if (target === "comment") {
        setWorkItemCommentText(text);
      } else {
        setWorkItemReplyText(text);
      }
    } else {
      const value = target === "comment" ? workItemCommentText : workItemReplyText;
      const trigger = getMentionTrigger(value);
      if (trigger) {
        const nextValue = `${value.slice(0, trigger.atIndex)}@${member.name} `;
        if (target === "comment") setWorkItemCommentText(nextValue);
        else setWorkItemReplyText(nextValue);
      }
    }
    setActiveWorkItemMentionTarget(null);
  }

  function renderWorkItemMentionMenu(target: "comment" | "reply") {
    if (activeWorkItemMentionTarget !== target) return null;
    const options = filteredWorkItemMentionOptions(target);
    if (!options.length) return (
      <div className="workitem-mention-menu">
        <div className="workitem-mention-empty">Không có người phù hợp.</div>
      </div>
    );

    return (
      <div className="workitem-mention-menu">
        {options.map((member) => (
          <button
            type="button"
            key={member.id}
            onMouseDown={(event) => {
              event.preventDefault();
              insertWorkItemMention(target, member);
            }}
          >
            <strong>@{member.name}</strong>
            <small>{member.email}</small>
          </button>
        ))}
      </div>
    );
  }

  async function handleAddWorkItemComment(parentId?: string) {
    if (!viewingWorkItem?.id) return;
    const content = parentId ? workItemReplyText.trim() : workItemCommentText.trim();
    if (!content) return;
    try {
      await createWorkItemComment(viewingWorkItem.id, { content, parentId });
      if (parentId) {
        setReplyingWorkItemCommentId(null);
        setWorkItemReplyText("");
        if (replyEditorRef.current) replyEditorRef.current.innerHTML = "";
      } else {
        setWorkItemCommentText("");
        if (commentEditorRef.current) commentEditorRef.current.innerHTML = "";
      }
      await loadWorkItemComments(viewingWorkItem.id);
      await loadWorkItemActivity(viewingWorkItem.id);
    } catch (error) {
      console.error("Create work item comment error:", error);
      addToast("error", "Không gửi được comment", "BE chưa lưu được trao đổi ticket.");
    }
  }

  const filteredProjectsHub = useMemo(() => {
    let result = [...visibleProjectsList];

    // Search query
    if (projectHubSearch.trim()) {
      const q = projectHubSearch.toLowerCase().trim();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
      );
    }

    // Filter by criteria
    if (projectHubFilter === "active") {
      result = result.filter((p) => documentsList.some((d) => d.projectId === p.id));
    } else if (projectHubFilter === "has_comments") {
      result = result.filter((p) => getProjectOpenCommentsCount(p.id) > 0);
    }

    const getTime = (p: Project) => {
      if (p.createdAt) {
        const t = new Date(p.createdAt).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (p.updatedAt) {
        const t = new Date(p.updatedAt).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      const match = p.id.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };

    // Sort
    result.sort((a, b) => {
      if (projectHubSort === "name_asc") {
        return a.name.localeCompare(b.name, "vi");
      }
      if (projectHubSort === "name_desc") {
        return b.name.localeCompare(a.name, "vi");
      }
      if (projectHubSort === "oldest") {
        return getTime(a) - getTime(b);
      }
      if (projectHubSort === "docs_desc") {
        const countA = documentsList.filter((d) => d.projectId === a.id).length;
        const countB = documentsList.filter((d) => d.projectId === b.id).length;
        return countB - countA;
      }
      // "newest" default
      return getTime(b) - getTime(a);
    });

    return result;
  }, [visibleProjectsList, projectHubSearch, projectHubFilter, projectHubSort, documentsList, getProjectOpenCommentsCount]);

  function handleOpenProjectWorkspace(projectId: string) {
    setSelectedProjectId(projectId);
    const firstDoc = documentsList.find((doc) => doc.projectId === projectId);
    setSelectedDocumentId(firstDoc?.id ?? "empty-document");
    void loadProjectWorkItems(projectId);
    setActiveTabNav("documents");
    addToast("info", "Đã mở không gian dự án", "Đã chuyển đến giao diện tài liệu của dự án.");
  }

  function openEditWorkItemComment(comment: WorkItemComment) {
    setReplyingWorkItemCommentId(null);
    setEditingWorkItemCommentId(comment.id);
    setEditingWorkItemCommentText(comment.content);
  }

  async function handleSaveWorkItemComment(commentId: string) {
    if (!viewingWorkItem?.id || !editingWorkItemCommentText.trim()) return;
    try {
      await updateWorkItemComment(viewingWorkItem.id, commentId, { content: editingWorkItemCommentText.trim() });
      setEditingWorkItemCommentId(null);
      setEditingWorkItemCommentText("");
      await loadWorkItemComments(viewingWorkItem.id);
      await loadWorkItemActivity(viewingWorkItem.id);
      addToast("success", "Đã cập nhật comment", "Nội dung trao đổi ticket đã được lưu.");
    } catch (error) {
      console.error("Update work item comment error:", error);
      addToast("error", "Không sửa được comment", "Bạn chỉ có thể sửa comment do chính mình tạo.");
    }
  }

  function requestDeleteWorkItemComment(comment: WorkItemComment) {
    setConfirmDeleteModal({
      isOpen: true,
      type: "workItemComment",
      id: comment.id,
      parentId: comment.workItemId,
      title: "Xác nhận xóa comment",
      message: "Bạn có chắc chắn muốn xóa comment này khỏi ticket?"
    });
  }

  async function handleDeleteWorkItemComment(workItemId: string, commentId: string) {
    try {
      await deleteWorkItemComment(workItemId, commentId);
      await loadWorkItemComments(workItemId);
      await loadWorkItemActivity(workItemId);
      addToast("info", "Đã xóa comment", "Comment ticket đã được xóa.");
    } catch (error) {
      console.error("Delete work item comment error:", error);
      addToast("error", "Không xóa được comment", "Bạn chỉ có thể xóa comment do chính mình tạo.");
    }
  }

  async function handleUploadDraftWorkItemAttachment(file?: File) {
    if (!file || !workItemDraft || isUploadingWorkItemAttachment) return;
    setIsUploadingWorkItemAttachment(true);
    try {
      const uploaded = await uploadMediaAsset({
        projectId: workItemDraft.projectId,
        documentId: workItemDraft.documentId || undefined,
        file
      });
      const nextAttachmentsText = [workItemDraft.attachmentsText.trim(), uploaded.url]
        .filter(Boolean)
        .join("\n");
      setWorkItemDraft({ ...workItemDraft, attachmentsText: nextAttachmentsText });
      addToast("success", "Đã upload file", "URL file đã được thêm vào ticket.");
    } catch (error) {
      console.error("Upload draft work item attachment error:", error);
      addToast("error", "Không upload được file", "Kiểm tra định dạng file hoặc quyền dự án/tài liệu.");
    } finally {
      setIsUploadingWorkItemAttachment(false);
    }
  }

  async function handleSaveWorkItem() {
    if (!workItemDraft || isSavingWorkItem) return;
    if (!workItemDraft.title.trim()) {
      addToast("warning", "Thiếu tiêu đề", "Vui lòng nhập tiêu đề ticket.");
      return;
    }

    setIsSavingWorkItem(true);
    let projectMembers = projectMembersByProject[workItemDraft.projectId] ?? [];
    try {
      if (workItemDraft.assigneeIds.length && projectMembers.length === 0) {
        try {
          projectMembers = await fetchProjectMembers(workItemDraft.projectId);
          setProjectMembersByProject((prev) => ({ ...prev, [workItemDraft.projectId]: projectMembers }));
        } catch (error) {
          console.error("Cannot reload project members before saving work item:", error);
        }
      }

      const assignableMembers = projectMembers.filter((member) => canAssignMemberToWorkItem(member, workItemDraft));
      const validProjectMemberIds = new Set(assignableMembers.map((member) => member.id));
      if (currentUser) validProjectMemberIds.add(currentUser.id);
      const assigneeIds = Array.from(new Set(workItemDraft.assigneeIds)).filter((id) => validProjectMemberIds.has(id));
      if (workItemDraft.assigneeIds.length !== assigneeIds.length) {
        addToast("error", "Người phụ trách không hợp lệ", "Chỉ có thể gán ticket cho thành viên dự án hoặc người có quyền trên tài liệu liên quan.");
        return;
      }
      const assigneeName = assigneeIds
        .map((id) => assignableMembers.find((member) => member.id === id)?.name ?? (id === currentUser?.id ? currentUser.name : undefined))
        .filter((name): name is string => Boolean(name))
        .join(", ");

      const payload = {
        documentId: workItemDraft.documentId || undefined,
        type: workItemDraft.type,
        status: workItemDraft.status,
        columnId: workItemDraft.columnId,
        priority: workItemDraft.priority,
        title: workItemDraft.title.trim(),
        description: workItemDraft.description.trim() || undefined,
        attachments: parseWorkItemAttachments(workItemDraft.attachmentsText),
        assigneeIds: assigneeIds.length ? assigneeIds : undefined,
        assigneeName: assigneeName || undefined,
        dueDate: workItemDraft.dueDate || undefined,
        checklistItems: parseChecklistText(workItemDraft.checklistText),
        labelNames: parseLabelText(workItemDraft.labelsText)
      };

      const saved = workItemDraft.id
        ? await updateWorkItem(workItemDraft.id, payload)
        : await createWorkItem({ ...payload, projectId: workItemDraft.projectId });
      setWorkItems((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
      setDashboardWorkItems((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
      setIsAssigneeMenuOpen(false);
      setIsWorkItemModalOpen(false);
      setWorkItemDraft(null);
      addToast("success", workItemDraft.id ? "Đã cập nhật ticket" : "Đã tạo ticket", `"${displayWorkItemTitle(saved)}" đã được lưu vào Workboard.`);
    } catch (error) {
      console.error("Save work item error:", error);
      addToast("error", "Không lưu được ticket", error instanceof Error ? error.message : "BE chưa lưu được thay đổi này.");
    } finally {
      setIsSavingWorkItem(false);
    }
  }

  async function handleDuplicateWorkItem(item: WorkItem) {
    try {
      const duplicated = await createWorkItem({
        projectId: item.projectId,
        documentId: item.documentId ?? undefined,
        type: item.type,
        status: item.status,
        columnId: item.columnId ?? item.column?.id ?? undefined,
        priority: item.priority,
        title: nextDuplicateWorkItemTitle(item),
        description: item.description ?? undefined,
        attachments: (item.attachments ?? []).map((attachment) => ({
          url: attachment.url,
          name: attachment.name ?? undefined,
          mimeType: attachment.mimeType ?? undefined
        })),
        assigneeIds: item.assignees?.map((assignee) => assignee.userId) ?? (item.assigneeId ? [item.assigneeId] : undefined),
        assigneeName: workItemAssigneeLabel(item),
        checklistItems: item.checklistItems?.map((entry) => ({ title: entry.title, done: entry.done })),
        labelNames: workItemLabelNames(item),
        dueDate: item.dueDate ? item.dueDate.slice(0, 10) : undefined
      });
      setWorkItems((prev) => duplicated.projectId === selectedProjectId ? [duplicated, ...prev] : prev);
      setDashboardWorkItems((prev) => [duplicated, ...prev]);
      addToast("success", "Đã duplicate ticket", `"${displayWorkItemTitle(duplicated)}" đã được tạo.`);
    } catch (error) {
      console.error("Duplicate work item error:", error);
      addToast("error", "Không duplicate được ticket", "BE chưa tạo được bản sao ticket này.");
    }
  }

  function requestDeleteWorkItem(item: WorkItem) {
    setConfirmDeleteModal({
      isOpen: true,
      type: "workItem",
      id: item.id,
      title: "Xác nhận xóa ticket",
      message: `Bạn có chắc chắn muốn xóa ticket "${displayWorkItemTitle(item)}" khỏi Workboard?`
    });
  }

  async function handleDeleteWorkItem(itemId: string) {
    const item = workItems.find((workItem) => workItem.id === itemId);
    try {
      await deleteWorkItem(itemId);
      setWorkItems((prev) => prev.filter((workItem) => workItem.id !== itemId));
      setDashboardWorkItems((prev) => prev.filter((workItem) => workItem.id !== itemId));
      addToast("info", "Đã xóa ticket", `"${item?.title ?? "Ticket"}" đã được xóa khỏi Workboard.`);
    } catch (error) {
      console.error("Delete work item error:", error);
      addToast("error", "Không xóa được ticket", "BE chưa xóa được ticket này.");
    }
  }

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
    if (isCreatingProject) return;
    if (!currentUser) return;
    if (!newProjName.trim()) {
      addToast("warning", "Thiếu thông tin", "Vui lòng nhập Tên dự án.");
      return;
    }
    const projectCode = newProjCode.trim()
      ? newProjCode.trim().toUpperCase()
      : generateProjectCode(newProjName, projectsList.map((project) => project.code));
    setIsCreatingProject(true);
    try {
      const newProj = await createProject({
        code: projectCode,
        name: newProjName.trim(),
        client: buildProjectClientLabel(newProjCustomer, newProjBusinessUnit)
      });
      setProjectsList((prev) => [...prev, newProj]);
      setProjectMembersByProject((prev) => ({
        ...prev,
        [newProj.id]: [{
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          projectRole: "MANAGER",
          projectRoles: ["MANAGER"],
          documentIds: [],
          documentRoles: [],
          source: "PROJECT"
        }]
      }));
      setSelectedProjectId(newProj.id);
      setSelectedDocumentId("empty-document");
      setActiveTabNav("projects");
      void loadRoleDashboard();
      setNewProjCode("");
      setNewProjName("");
      setNewProjCustomer("Internal Team");
      setNewProjBusinessUnit("Vận hành nội bộ");
      setIsCreateProjectModalOpen(false);
      addToast("success", "Đã tạo dự án mới", `Dự án "${newProj.name}" (${newProj.code}) đã được lưu vào Neon.`);
    } catch (error) {
      console.error("Create project error:", error);
      addToast("error", "Không tạo được dự án", "BE từ chối request hoặc mã dự án đã tồn tại.");
    } finally {
      setIsCreatingProject(false);
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
    if (!editingProject || isSavingEditProject) return;
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

    setIsSavingEditProject(true);
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
    } finally {
      setIsSavingEditProject(false);
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
    } else if (type === "workItem") {
      await handleDeleteWorkItem(id);
    } else if (type === "workItemComment" && confirmDeleteModal.parentId) {
      await handleDeleteWorkItemComment(confirmDeleteModal.parentId, id);
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
          ? `Nội dung "${importedDoc.title}" đã được cập nhật lên ${importedDoc.version} từ file "${file.name}".`
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

  async function openVersionHistoryModal() {
    if (selectedDocument.id === "empty-document") return;
    setIsVersionModalOpen(true);
    setIsLoadingVersions(true);
    try {
      setDocumentVersions(await fetchDocumentVersions(selectedDocument.id));
    } catch (error) {
      console.error("Load document versions error:", error);
      addToast("error", "Không tải được lịch sử phiên bản", "Vui lòng kiểm tra quyền truy cập hoặc thử lại.");
    } finally {
      setIsLoadingVersions(false);
    }
  }

  async function handleRestoreVersion(version: DocumentVersion) {
    if (selectedDocument.id === "empty-document" || restoringVersionId) return;
    setRestoringVersionId(version.id);
    try {
      const restoredDocument = await restoreDocumentVersion(selectedDocument.id, version.id);
      setDocumentsList((prev) => prev.map((doc) => (doc.id === restoredDocument.id ? restoredDocument : doc)));
      setDocumentVersions(await fetchDocumentVersions(restoredDocument.id));
      void loadProjectCollaboration(restoredDocument.projectId || selectedProjectId);
      void loadDocumentCollaboration(restoredDocument.id);
      addToast(
        "success",
        "Đã khôi phục phiên bản",
        `${restoredDocument.title} đã được tạo phiên bản mới ${restoredDocument.version} từ ${version.version}.`
      );
    } catch (error) {
      console.error("Restore document version error:", error);
      addToast("error", "Không khôi phục được phiên bản", "Vui lòng kiểm tra quyền chỉnh sửa tài liệu hoặc thử lại.");
    } finally {
      setRestoringVersionId(null);
    }
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
        setShowLibraryPanel(true);
        setShowCommentsPanel(true);
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
    const scheduleSelectionCheck = (event: MouseEvent) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => handleDocumentSelection(event), 90);
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
    const roleProjectsById = new Map((roleDashboard?.projectBreakdown ?? []).map((project) => [project.id, project]));
    const dashboardItems = dashboardWorkItems.length > 0 ? dashboardWorkItems : workItems;
    const projects = projectsList.map((project) => {
      const roleProject = roleProjectsById.get(project.id);
      return {
        id: project.id,
        code: project.code,
        name: project.name,
        client: project.client,
        documents: roleProject?.documents ?? documentsList.filter((doc) => doc.projectId === project.id).length,
        openComments: roleProject?.openComments ?? getProjectOpenCommentsCount(project.id),
        tags: roleProject?.tags ?? 0,
        traces: roleProject?.traces ?? 0,
        members: roleProject?.members ?? 0,
        updatedAt: roleProject?.updatedAt ?? ""
      };
    });
    const documents = dashboardDocumentsSource();
    const projectCount = totals?.projects ?? projects.length;
    const totalDocuments = totals?.documents ?? documentsList.length;
    const openItems = dashboardItems.filter((item) => item.status !== "DONE");
    const doneItems = dashboardItems.filter((item) => item.status === "DONE");
    const criticalBugs = dashboardItems.filter((item) => item.type === "BUG" && item.priority === "CRITICAL" && item.status !== "DONE");
    const blockedItems = dashboardItems.filter((item) => item.status === "BLOCKED");
    const overdueItems = dashboardItems.filter(isWorkItemOverdue);
    const completionRate = dashboardItems.length ? Math.round((doneItems.length / dashboardItems.length) * 100) : 0;
    const activeProjects = projects.filter((project) =>
      dashboardItems.some((item) => item.projectId === project.id && item.status !== "DONE") ||
      project.openComments > 0
    ).length;

    const projectRows = [...projects]
      .map((project) => {
        const projectItems = dashboardItems.filter((item) => item.projectId === project.id);
        const projectOpenItems = projectItems.filter((item) => item.status !== "DONE");
        const projectDoneItems = projectItems.filter((item) => item.status === "DONE");
        const projectCriticalBugs = projectItems.filter((item) => item.type === "BUG" && item.priority === "CRITICAL" && item.status !== "DONE");
        const projectBlockedItems = projectItems.filter((item) => item.status === "BLOCKED");
        const projectOverdueItems = projectItems.filter(isWorkItemOverdue);
        const updatedCandidates = [
          parseDashboardDate(project.updatedAt),
          ...projectItems.map((item) => parseDashboardDate(item.updatedAt ?? item.createdAt)),
          ...documents
            .filter((document) => document.projectId === project.id)
            .map((document) => parseDashboardDate(document.updatedAt))
        ].filter(Boolean) as Date[];
        const updatedAt = updatedCandidates.length
          ? new Date(Math.max(...updatedCandidates.map((date) => date.getTime())))
          : null;
        const inactiveDays = updatedAt ? Math.max(Math.floor((Date.now() - updatedAt.getTime()) / 86400000), 0) : null;
        const projectInProgressItems = projectItems.filter((item) => item.status === "IN_PROGRESS");
        const projectBugItems = projectItems.filter((item) => item.type === "BUG" && item.status !== "DONE");
        const riskScore = projectBlockedItems.length * 5 + projectCriticalBugs.length * 4 + projectOverdueItems.length * 3 + projectOpenItems.length;
        return {
          ...project,
          items: projectItems.length,
          openItems: projectOpenItems.length,
          doneItems: projectDoneItems.length,
          blockedItems: projectBlockedItems.length,
          criticalBugs: projectCriticalBugs.length,
          overdueItems: projectOverdueItems.length,
          inProgressItems: projectInProgressItems.length,
          bugItems: projectBugItems.length,
          completionRate: projectItems.length ? Math.round((projectDoneItems.length / projectItems.length) * 100) : 0,
          inactiveDays,
          riskScore,
          updatedAt: updatedAt?.toISOString() ?? project.updatedAt,
          width: 0
        };
      })
      .sort((first, second) => second.openItems - first.openItems || second.riskScore - first.riskScore);
    const maxProjectOpenItems = Math.max(...projectRows.map((project) => project.openItems), 1);
    projectRows.forEach((project) => {
      project.width = Math.max((project.openItems / maxProjectOpenItems) * 100, project.openItems > 0 ? 8 : 0);
    });

    const recentWorkItems = [...dashboardItems]
      .filter((item) =>
        item.status !== "BLOCKED" &&
        !isWorkItemOverdue(item) &&
        !(item.type === "BUG" && item.priority === "CRITICAL")
      )
      .sort((first, second) =>
        (parseDashboardDate(second.updatedAt ?? second.createdAt)?.getTime() ?? 0) -
        (parseDashboardDate(first.updatedAt ?? first.createdAt)?.getTime() ?? 0)
      )
      .slice(0, 6);
    const riskItems = [...dashboardItems]
      .filter((item) => {
        const assignees = workItemAssigneeNames(item);
        const isUnassigned = !assignees || assignees.length === 0;
        return (
          item.status !== "DONE" &&
          (
            item.status === "BLOCKED" ||
            isWorkItemOverdue(item) ||
            (item.type === "BUG" && item.priority === "CRITICAL") ||
            isUnassigned ||
            item.priority === "HIGH" ||
            item.priority === "CRITICAL"
          )
        );
      })
      .sort((first, second) => {
        const score = (item: WorkItem) => {
          const assignees = workItemAssigneeNames(item);
          const isUnassigned = !assignees || assignees.length === 0;
          return (
            (item.status === "BLOCKED" ? 50 : 0) +
            (isWorkItemOverdue(item) ? 30 : 0) +
            (item.type === "BUG" && item.priority === "CRITICAL" ? 25 : 0) +
            (isUnassigned ? 20 : 0) +
            (item.priority === "HIGH" ? 10 : 0)
          );
        };
        return score(second) - score(first);
      })
      .slice(0, 5);
    const workboardFeed = [...dashboardItems]
      .sort((first, second) =>
        (parseDashboardDate(second.updatedAt ?? second.createdAt)?.getTime() ?? 0) -
        (parseDashboardDate(first.updatedAt ?? first.createdAt)?.getTime() ?? 0)
      )
      .slice(0, 10)
      .map((item) => {
        const project = projectsList.find((project) => project.id === item.projectId);
        const createdAt = parseDashboardDate(item.createdAt);
        const updatedAt = parseDashboardDate(item.updatedAt);
        const wasUpdated = Boolean(createdAt && updatedAt && Math.abs(updatedAt.getTime() - createdAt.getTime()) > 1000);
        return {
          id: item.id,
          item,
          project,
          action: wasUpdated ? "Cập nhật" : "Tạo mới",
          happenedAt: item.updatedAt ?? item.createdAt,
          statusLabel: dashboardColumnLabelForItem(item),
          summary: `${WORK_ITEM_TYPE_LABEL[item.type]} ${wasUpdated ? "được cập nhật" : "được tạo"} trong ${dashboardColumnLabelForItem(item)}`,
          detail: `${WORK_ITEM_PRIORITY_LABEL[item.priority]} · ${workItemAssigneeLabel(item)}`
        };
      });

    const activitySeries = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      date.setHours(0, 0, 0, 0);
      const next = new Date(date);
      next.setDate(date.getDate() + 1);
      const workItemCount = dashboardItems.filter((item) => {
        const updatedAt = parseDashboardDate(item.updatedAt ?? item.createdAt);
        return updatedAt ? updatedAt >= date && updatedAt < next : false;
      }).length;

      return {
        label: date.toLocaleDateString("vi-VN", { weekday: "short" }).replace("Th ", "T"),
        value: workItemCount
      };
    });
    const maxActivity = Math.max(...activitySeries.map((item) => item.value), 1);
    const statusBreakdown = DEFAULT_WORKBOARD_COLUMNS.map((column) => ({
      id: column.id,
      label: column.name,
      value: dashboardItems.filter((item) => item.status === column.key).length
    }));
    const maxStatusBreakdown = Math.max(...statusBreakdown.map((item) => item.value), 1);
    const workloadRows = Array.from(
      dashboardItems.reduce((map, item) => {
        const assignees = workItemAssigneeNames(item) || [];
        assignees.forEach((name) => {
          if (!name || name === "Chưa giao") return;
          const current = map.get(name) ?? { name, open: 0, done: 0, blocked: 0, overdue: 0, critical: 0, backlog: 0, todo: 0, inProgress: 0, review: 0, bug: 0, total: 0 };
          current.total += 1;
          if (item.status === "DONE") current.done += 1;
          else current.open += 1;
          if (item.status === "BLOCKED") current.blocked += 1;
          if (item.status === "BACKLOG") current.backlog += 1;
          if (item.status === "TODO") current.todo += 1;
          if (item.status === "IN_PROGRESS") current.inProgress += 1;
          if (item.status === "REVIEW") current.review += 1;
          if (isWorkItemOverdue(item)) current.overdue += 1;
          if (item.type === "BUG" && item.priority === "CRITICAL" && item.status !== "DONE") current.critical += 1;
          if (item.type === "BUG" && item.status !== "DONE") current.bug += 1;
          map.set(name, current);
        });
        return map;
      }, new Map<string, { name: string; open: number; done: number; blocked: number; overdue: number; critical: number; backlog: number; todo: number; inProgress: number; review: number; bug: number; total: number }>())
        .values()
    )
      .sort((first, second) =>
        (second.open + second.blocked + second.overdue + second.critical) -
        (first.open + first.blocked + first.overdue + first.critical)
      )
      .slice(0, 6);
    const maxWorkload = Math.max(...workloadRows.map((row) => row.open + row.done), 1);
    const criticalBugSeries = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      date.setHours(0, 0, 0, 0);
      const next = new Date(date);
      next.setDate(date.getDate() + 1);
      const value = dashboardItems.filter((item) => {
        if (item.type !== "BUG" || item.priority !== "CRITICAL") return false;
        const happenedAt = parseDashboardDate(item.updatedAt ?? item.createdAt);
        return happenedAt ? happenedAt >= date && happenedAt < next : false;
      }).length;
      return {
        label: date.toLocaleDateString("vi-VN", { weekday: "short" }).replace("Th ", "T"),
        value
      };
    });
    const maxCriticalBugSeries = Math.max(...criticalBugSeries.map((item) => item.value), 1);
    const projectHealthRows = projectRows
      .map((project) => {
        const penalty = project.blockedItems * 18 + project.criticalBugs * 16 + project.overdueItems * 12 + Math.max(project.openItems - project.doneItems, 0) * 2;
        return {
          ...project,
          healthScore: Math.max(0, Math.min(100, 100 - penalty + Math.round(project.completionRate * 0.25)))
        };
      })
      .sort((first, second) => first.healthScore - second.healthScore)
      .slice(0, 6);

    return {
      projectCount,
      activeProjects,
      totalDocuments,
      openItems: openItems.length,
      criticalBugs: criticalBugs.length,
      blockedItems: blockedItems.length,
      overdueItems: overdueItems.length,
      completionRate,
      projectRows,
      recentWorkItems,
      riskItems,
      workboardFeed,
      activitySeries,
      maxActivity,
      statusBreakdown,
      maxStatusBreakdown,
      workloadRows,
      maxWorkload,
      criticalBugSeries,
      maxCriticalBugSeries,
      projectHealthRows
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
    if (isZenMode) base += " zen-mode";
    if (!showLibraryPanel && !showCommentsPanel) return `${base} hide-both`;
    if (!showLibraryPanel) return `${base} hide-library`;
    if (!showCommentsPanel) return `${base} hide-comments`;
    return base;
  }, [isZenMode, showLibraryPanel, showCommentsPanel]);

  function toggleFocusReadingMode() {
    if (isZenMode) {
      setIsZenMode(false);
      setShowLibraryPanel(true);
      setShowCommentsPanel(true);
      return;
    }

    setIsActionsDropdownOpen(false);
    setIsZenMode(true);
    setShowLibraryPanel(false);
    setShowCommentsPanel(false);
  }

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

  const executiveData = executiveDashboardData();

  return (
    <main className={`${isZenMode ? "app-shell zen-mode" : "app-shell"} ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <button
            className="sidebar-logo-button"
            type="button"
            title={isSidebarCollapsed ? "Mở rộng thanh menu" : "ProjectSpace"}
            aria-label={isSidebarCollapsed ? "Mở rộng thanh menu" : "ProjectSpace"}
            data-tooltip="ProjectSpace"
            onClick={() => {
              if (isSidebarCollapsed) toggleSidebar();
            }}
          >
            <img src="/logo.png" alt="ProjectSpace" className="sidebar-logo-img" />
          </button>
          <div className="brand-info">
            <strong>ProjectSpace</strong>
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
            </button>

            <button
              className={activeTabNav === "projects" ? "nav-item active" : "nav-item"}
              type="button"
              title="Dự án"
              data-tooltip="Dự án"
              onClick={() => setActiveTabNav("projects")}
            >
              <div className="nav-item-content">
                <FolderKanban size={17} />
                <span>Dự án</span>
              </div>
            </button>

            <button
              className={activeTabNav === "documents" ? "nav-item active" : "nav-item"}
              type="button"
              title="Tài liệu"
              data-tooltip="Tài liệu"
              onClick={() => setActiveTabNav("documents")}
            >
              <div className="nav-item-content">
                <FileText size={17} />
                <span>Tài liệu</span>
              </div>
            </button>

            <button
              className={activeTabNav === "review" ? "nav-item active" : "nav-item"}
              type="button"
              title="Workboard"
              data-tooltip="Workboard"
              onClick={() => setActiveTabNav("review")}
            >
              <div className="nav-item-content">
                <Kanban size={17} />
                <span>Workboard</span>
              </div>
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
                  : activeTabNav === "projects"
                    ? "Tổng quan danh mục dự án"
                    : activeTabNav === "review"
                      ? `Project Workboard • ${selectedProject.code}`
                      : `${selectedProject.code} / ${selectedProject.client}`}
            </p>
            <h1>
              {activeTabNav === "dashboard"
                ? (() => {
                  const h = new Date().getHours();
                  const greeting = h < 12 ? "Chào buổi sáng" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối";
                  return `${greeting}, ${currentUser.name.split(" ").slice(-1)[0]}!`;
                })()
                : activeTabNav === "admin" && (currentUser.role === "ADMIN" || currentUser.role === "MANAGER")
                  ? "Quản Lý User & Phân Quyền"
                  : activeTabNav === "projects"
                    ? "Quản Lý Dự Án"
                    : activeTabNav === "review"
                      ? (selectedProject?.name ?? "Workboard")
                      : (selectedProject?.name ?? "Không gian làm việc")}
            </h1>
          </div>

          {activeTabNav === "dashboard" && (
            <div className="topbar-actions">
              <button
                className="exec-action secondary"
                type="button"
                disabled={isRefreshingDashboard}
                onClick={async () => {
                  await loadRoleDashboard();
                  addToast("success", "Đã làm mới dữ liệu", "Cập nhật dữ liệu Dashboard thành công.");
                }}
              >
                <RefreshCw size={14} className={isRefreshingDashboard ? "animate-spin" : ""} />
                <span>{isRefreshingDashboard ? "Đang làm mới..." : "Làm mới"}</span>
              </button>
              <button className="exec-action primary" type="button" onClick={() => setIsCreateProjectModalOpen(true)}>
                <Plus size={15} /> Tạo dự án mới
              </button>
            </div>
          )}

          {activeTabNav === "projects" && (
            <div className="topbar-actions">
              <button
                className="exec-action secondary"
                type="button"
                disabled={isRefreshingDashboard}
                onClick={async () => {
                  await loadRoleDashboard();
                  addToast("success", "Đã làm mới dữ liệu", "Cập nhật dữ liệu danh sách dự án thành công.");
                }}
              >
                <RefreshCw size={14} className={isRefreshingDashboard ? "animate-spin" : ""} />
                <span>{isRefreshingDashboard ? "Đang làm mới..." : "Làm mới"}</span>
              </button>
              <button
                className="exec-action primary"
                type="button"
                onClick={() => setIsCreateProjectModalOpen(true)}
              >
                <FolderPlus size={15} />
                <span>Tạo dự án mới</span>
              </button>
            </div>
          )}

          {activeTabNav === "admin" && (
            <div className="topbar-actions">
              <button
                className="exec-action secondary"
                type="button"
                onClick={() => setAdminTriggerRefresh((prev) => prev + 1)}
                title="Tải lại danh sách người dùng"
              >
                <RefreshCw size={14} />
                <span>Làm mới</span>
              </button>
              {(currentUser.role === "ADMIN" || currentUser.role === "MANAGER") && (
                <button
                  className="exec-action primary"
                  type="button"
                  onClick={() => setAdminTriggerCreate((prev) => prev + 1)}
                >
                  <UserPlus size={15} />
                  <span>Tạo Tài khoản</span>
                </button>
              )}
            </div>
          )}

          {activeTabNav === "review" && (
            <div className="topbar-actions">
              <CustomProjectSelect
                projects={projectsList}
                selectedProjectId={selectedProject.id}
                onSelectProject={(projectId) => {
                  setSelectedProjectId(projectId);
                  const firstDoc = documentsList.find((doc) => doc.projectId === projectId);
                  setSelectedDocumentId(firstDoc?.id ?? "empty-document");
                  void loadProjectWorkItems(projectId);
                }}
              />
              <button
                className="exec-action secondary"
                type="button"
                onClick={openWorkboardConfigModal}
                disabled={!selectedProject.id}
              >
                <SlidersHorizontal size={14} />
                <span>Tùy chỉnh board</span>
              </button>
              <button
                className="exec-action secondary"
                type="button"
                onClick={() => void loadProjectWorkItems(selectedProject.id)}
                disabled={!selectedProject.id || isLoadingWorkItems}
              >
                <RefreshCw size={14} className={isLoadingWorkItems ? "animate-spin" : ""} />
                <span>{isLoadingWorkItems ? "Đang tải" : "Làm mới"}</span>
              </button>
              <button
                className="exec-action primary"
                type="button"
                onClick={() => openCreateWorkItemModal()}
                disabled={!selectedProject.id}
              >
                <Plus size={15} />
                <span>Tạo ticket</span>
              </button>
            </div>
          )}

          {activeTabNav !== "admin" && activeTabNav !== "dashboard" && activeTabNav !== "review" && activeTabNav !== "projects" && (
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
                className="exec-action secondary"
                type="button"
                disabled={isRefreshingDashboard}
                onClick={async () => {
                  await loadRoleDashboard();
                  addToast("success", "Đã làm mới dữ liệu", "Cập nhật dữ liệu thành công.");
                }}
              >
                <RefreshCw size={14} className={isRefreshingDashboard ? "animate-spin" : ""} />
                <span>{isRefreshingDashboard ? "Đang làm mới..." : "Làm mới"}</span>
              </button>
              <button
                className="exec-action primary"
                type="button"
                title="Import file vào dự án"
                disabled={!selectedProjectId}
                onClick={() => {
                  setImportTargetProjectId(selectedProjectId);
                  setIsImportModalOpen(true);
                }}
              >
                <UploadCloud size={15} />
                <span>Import File</span>
              </button>
            </div>
          )}
        </header>



        {activeTabNav === "dashboard" ? (
          <section className="role-dashboard-page executive-dashboard">
            {/* ── KPI strip ── */}
            <div className="exec-kpi-grid">
              {[
                { label: "Project", value: executiveData.projectCount, note: `${executiveData.activeProjects} project còn việc`, color: "kpi-indigo", Icon: FolderKanban },
                { label: "Ticket mở", value: executiveData.openItems, note: "Chưa hoàn thành", color: "kpi-blue", Icon: Clock },
                { label: "Bug critical", value: executiveData.criticalBugs, note: "Cần ưu tiên xử lý", color: "kpi-rose", Icon: AlertTriangle },
                { label: "Blocked", value: executiveData.blockedItems, note: "Luồng đang kẹt", color: "kpi-violet", Icon: GitBranch },
                { label: "Quá hạn", value: executiveData.overdueItems, note: "Chưa xong trước deadline", color: "kpi-amber", Icon: AlertTriangle },
                { label: "Hoàn thành", value: `${executiveData.completionRate}%`, note: "Tỷ lệ done toàn workboard", color: "kpi-emerald", Icon: CheckCheck },
              ].map(({ label, value, note, color, Icon }) => (
                <div className={`exec-kpi-card ${color}`} key={label}>
                  <div className="kpi-icon-box"><Icon size={17} /></div>
                  <strong>{String(value)}</strong>
                  <span>{label}</span>
                  <small>{note}</small>
                </div>
              ))}
            </div>

            <div className="exec-main-grid">
              <section className="exec-panel doc-stats-panel">
                <div className="exec-panel-header">
                  <div>
                    <span>Tổng quan</span>
                    <h3>Tài liệu theo dự án</h3>
                  </div>
                  <strong>{projectsList.length} dự án · {documentsList.length} tài liệu</strong>
                </div>
                <div className="doc-project-list">
                  {projectsList.map((project) => {
                    const projectDocs = documentsList.filter((d) => d.projectId === project.id);
                    const draftCount = projectDocs.filter((d) => d.status === "Draft").length;
                    const deployedCount = projectDocs.filter((d) => d.status === "Triển khai").length;
                    return (
                      <button
                        className="exec-item-row"
                        type="button"
                        key={project.id}
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          const firstDoc = documentsList.find((d) => d.projectId === project.id);
                          if (firstDoc) setSelectedDocumentId(firstDoc.id);
                          setActiveTabNav("documents");
                        }}
                      >
                        <div className="exec-item-left">
                          <span className="exec-item-icon-box">
                            <FileText size={13} />
                          </span>
                          <strong className="exec-item-name">{project.name}</strong>
                        </div>
                        <div className="exec-item-right">
                          <div className="exec-item-chips">
                            {draftCount > 0 && <span className="pr-chip pr-chip-progress">{draftCount} Draft</span>}
                            {deployedCount > 0 && <span className="pr-chip pr-chip-done">{deployedCount} Triển khai</span>}
                          </div>
                          <span className="exec-item-count">{projectDocs.length} tài liệu</span>
                        </div>
                      </button>
                    );
                  })}
                  {projectsList.length === 0 && <div className="empty-collab-state">Chưa có dự án nào.</div>}
                </div>
              </section>

              <section className="exec-panel project-volume">
                <div className="exec-panel-header">
                  <div>
                    <span>Theo Project</span>
                    <h3>Ticket mở theo Project</h3>
                  </div>
                  <strong>{executiveData.projectRows.length} project</strong>
                </div>
                <div className="exec-project-list-v2">
                  {executiveData.projectRows.slice(0, 8).map((project, idx) => (
                    <button
                      className="exec-item-row"
                      type="button"
                      key={project.id}
                      onClick={() => {
                        setSelectedProjectId(project.id);
                        setActiveTabNav("review");
                      }}
                    >
                      <div className="exec-item-left">
                        <span className="project-row-idx">{idx + 1}</span>
                        <strong className="exec-item-name">{project.name}</strong>
                      </div>
                      <div className="exec-item-right">
                        <div className="exec-item-chips">
                          {project.inProgressItems > 0 && <span className="pr-chip pr-chip-progress">{project.inProgressItems} đang làm</span>}
                          {project.bugItems > 0 && <span className="pr-chip pr-chip-bug">{project.bugItems} Bug</span>}
                          {project.doneItems > 0 && <span className="pr-chip pr-chip-done">{project.doneItems} done</span>}
                        </div>
                        <span className="exec-item-count">{project.items} ticket</span>
                      </div>
                    </button>
                  ))}
                  {executiveData.projectRows.length === 0 && (
                    <div className="empty-collab-state">Chưa có project nào.</div>
                  )}
                </div>
              </section>
            </div>

            <div className="exec-insight-grid">
              <section className="exec-panel">
                <div className="exec-panel-header">
                  <div>
                    <span>Trạng thái</span>
                    <h3>Done / In-progress / Blocked</h3>
                  </div>
                  <strong>{executiveData.statusBreakdown.reduce((total, item) => total + item.value, 0)} ticket</strong>
                </div>
                <div className="status-breakdown-list">
                  {executiveData.statusBreakdown.map((item) => (
                    <div className={`status-breakdown-row status-${item.id.toLowerCase()}`} key={item.id}>
                      <span>{item.label}</span>
                      <div><i style={{ width: `${Math.max((item.value / executiveData.maxStatusBreakdown) * 100, item.value > 0 ? 8 : 0)}%` }} /></div>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="exec-panel">
                <div className="exec-panel-header">
                  <div>
                    <span>Workload</span>
                    <h3>Theo người phụ trách</h3>
                  </div>
                  <strong>{executiveData.workloadRows.length} người</strong>
                </div>
                <div className="workload-list">
                  {executiveData.workloadRows.map((row) => {
                    const donePercent = row.total ? Math.round((row.done / row.total) * 100) : 0;
                    return (
                      <button className="wl-person" type="button" key={row.name} onClick={() => {
                        setActiveTabNav("review");
                        setWorkboardAssigneeFilter(row.name);
                      }}>
                        <div className="wl-person-header">
                          <strong>{row.name}</strong>
                          <span className="wl-person-meta">{row.done}/{row.total} done · <em className="wl-done-pct">{donePercent}%</em></span>
                        </div>
                        <div className="wl-bar-track">
                          <div className="wl-bar-fill" style={{ width: `${donePercent}%` }} />
                        </div>
                        <div className="wl-stat-row">
                          {row.backlog > 0 && <span className="wl-chip wl-chip-neutral">{row.backlog} Backlog</span>}
                          {row.todo > 0 && <span className="wl-chip wl-chip-blue">{row.todo} To Do</span>}
                          {row.inProgress > 0 && <span className="wl-chip wl-chip-amber">{row.inProgress} In Progress</span>}
                          {row.blocked > 0 && <span className="wl-chip wl-chip-red">{row.blocked} Blocked</span>}
                          {row.bug > 0 && <span className="wl-chip wl-chip-rose">{row.bug} Bug</span>}
                          {row.overdue > 0 && <span className="wl-chip wl-chip-danger">{row.overdue} Quá hạn</span>}
                          {row.done > 0 && <span className="wl-chip wl-chip-green">{row.done} Done</span>}
                        </div>
                      </button>
                    );
                  })}
                  {executiveData.workloadRows.length === 0 && <div className="empty-collab-state">Chưa có workload.</div>}
                </div>
              </section>

            </div>

            <div className="exec-secondary-grid">
              <section className="exec-panel recent-projects">
                <div className="exec-panel-header">
                  <div>
                    <span>Ưu tiên</span>
                    <h3>Project cần chú ý</h3>
                  </div>
                  <strong>Risk</strong>
                </div>
                <div className="exec-project-list-v2">
                  {executiveData.projectRows
                    .filter((project) => project.blockedItems > 0 || project.overdueItems > 0 || project.criticalBugs > 0)
                    .sort((first, second) =>
                      (second.blockedItems * 5 + second.criticalBugs * 4 + second.overdueItems * 3) -
                      (first.blockedItems * 5 + first.criticalBugs * 4 + first.overdueItems * 3)
                    )
                    .slice(0, 5)
                    .map((project) => (
                      <button
                        className="exec-item-row"
                        type="button"
                        key={project.id}
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          setActiveTabNav("review");
                        }}
                      >
                        <div className="exec-item-left">
                          <span className="ops-code-chip">{project.code}</span>
                          <strong className="exec-item-name">{project.name}</strong>
                        </div>
                        <div className="exec-item-right">
                          <div className="exec-item-chips">
                            {project.blockedItems > 0 && <span className="pr-chip pr-chip-bug">{project.blockedItems} blocked</span>}
                            {project.overdueItems > 0 && <span className="pr-chip pr-chip-bug">{project.overdueItems} quá hạn</span>}
                            {project.criticalBugs > 0 && <span className="pr-chip pr-chip-bug">{project.criticalBugs} critical bug</span>}
                          </div>
                        </div>
                      </button>
                    ))}
                  {executiveData.projectRows.filter((project) => project.blockedItems > 0 || project.overdueItems > 0 || project.criticalBugs > 0).length === 0 && (
                    <div className="empty-collab-state">Không có project nào cần cảnh báo rủi ro.</div>
                  )}
                </div>
              </section>

              <section className="exec-panel recent-docs">
                <div className="exec-panel-header">
                  <div>
                    <span>Ticket</span>
                    <h3>Ticket gần đây</h3>
                  </div>
                  <strong>{executiveData.recentWorkItems.length} item</strong>
                </div>
                <div className="exec-project-list-v2">
                  {executiveData.recentWorkItems.map((item) => {
                    const project = projectsList.find((project) => project.id === item.projectId);
                    return (
                      <button
                        className="exec-item-row"
                        type="button"
                        key={item.id}
                        onClick={() => openDashboardWorkItem(item)}
                      >
                        <div className="exec-item-left">
                          <span className="exec-item-icon-box">
                            {workItemTypeIcon(item.type)}
                          </span>
                          <div className="exec-item-title-group">
                            <strong className="exec-item-name">{displayWorkItemTitle(item)}</strong>
                            <small className="exec-item-sub">{project?.code ?? "Project"}</small>
                          </div>
                        </div>
                        <div className="exec-item-right">
                          <span className={`pr-chip ${item.status === "DONE" ? "pr-chip-done" : item.status === "IN_PROGRESS" ? "pr-chip-progress" : "pr-chip-total"}`}>
                            {dashboardColumnLabelForItem(item)}
                          </span>
                          <span className="exec-item-count">{relativeDashboardTime(item.updatedAt ?? item.createdAt)}</span>
                        </div>
                      </button>
                    );
                  })}
                  {executiveData.recentWorkItems.length === 0 && (
                    <div className="empty-collab-state">Không có ticket thường mới. Ticket cần xử lý nằm ở khối rủi ro.</div>
                  )}
                </div>
              </section>

              <section className="exec-panel quiet-projects">
                <div className="exec-panel-header">
                  <div>
                    <span>Cảnh báo</span>
                    <h3>Rủi ro Workboard</h3>
                  </div>
                  <strong>{executiveData.riskItems.length} item</strong>
                </div>
                <div className="exec-project-list-v2">
                  {executiveData.riskItems.map((item) => {
                    const project = projectsList.find((project) => project.id === item.projectId);
                    const assignees = workItemAssigneeNames(item);
                    const isUnassigned = !assignees || assignees.length === 0;
                    const riskReason = item.status === "BLOCKED"
                      ? "Blocked"
                      : isWorkItemOverdue(item)
                        ? "Quá hạn"
                        : item.type === "BUG" && item.priority === "CRITICAL"
                          ? "Critical bug"
                          : isUnassigned
                            ? "Chưa giao"
                            : `${WORK_ITEM_PRIORITY_LABEL[item.priority]} priority`;
                    const isHighRisk = item.status === "BLOCKED" || item.priority === "CRITICAL" || isWorkItemOverdue(item) || isUnassigned;
                    const riskChipClass = item.status === "BLOCKED" || isWorkItemOverdue(item) || (item.type === "BUG" && item.priority === "CRITICAL")
                      ? "pr-chip-bug"
                      : isUnassigned
                        ? "pr-chip-progress"
                        : "pr-chip-total";

                    return (
                      <button
                        className="exec-item-row"
                        type="button"
                        key={item.id}
                        onClick={() => openDashboardWorkItem(item)}
                      >
                        <div className="exec-item-left">
                          <span className={isHighRisk ? "quiet-dot high" : "quiet-dot"}></span>
                          <div className="exec-item-title-group">
                            <strong className="exec-item-name">{displayWorkItemTitle(item)}</strong>
                            <small className="exec-item-sub">{project?.code ?? "Project"}</small>
                          </div>
                        </div>
                        <div className="exec-item-right">
                          <span className={`pr-chip ${riskChipClass}`}>{riskReason}</span>
                          <span className="exec-item-count">{formatWorkItemDate(item.dueDate)}</span>
                        </div>
                      </button>
                    );
                  })}
                  {executiveData.riskItems.length === 0 && (
                    <div className="empty-collab-state">Không có ticket rủi ro.</div>
                  )}
                </div>
              </section>
            </div>
          </section>
        ) : activeTabNav === "projects" ? (
          <section className="project-hub-page">
            {/* Executive Hero Stats Strip */}
            <div className="project-hub-hero">
              <div className="hub-hero-card hero-primary">
                <div className="hub-card-header">
                  <span className="hub-hero-icon"><FolderKanban size={18} /></span>
                  <span className="hub-hero-label">Tổng số dự án</span>
                </div>
                <div className="hub-card-body">
                  <strong className="hub-hero-value">{visibleProjectsList.length}</strong>
                  <span className="hub-hero-sub-pill">Đang vận hành</span>
                </div>
              </div>

              <div className="hub-hero-card hero-emerald">
                <div className="hub-card-header">
                  <span className="hub-hero-icon"><FileText size={18} /></span>
                  <span className="hub-hero-label">Tài liệu hệ thống</span>
                </div>
                <div className="hub-card-body">
                  <strong className="hub-hero-value">{documentsList.length}</strong>
                  <span className="hub-hero-sub-pill">
                    {documentsList.filter((d) => d.status === "Triển khai").length} triển khai · {documentsList.filter((d) => d.status === "Draft").length} draft
                  </span>
                </div>
              </div>

              <div className="hub-hero-card hero-amber">
                <div className="hub-card-header">
                  <span className="hub-hero-icon"><MessageSquareText size={18} /></span>
                  <span className="hub-hero-label">Trao đổi cần xử lý</span>
                </div>
                <div className="hub-card-body">
                  <strong className="hub-hero-value">
                    {visibleProjectsList.reduce((acc, p) => acc + (getProjectOpenCommentsCount(p.id) || p.openComments || 0), 0)}
                  </strong>
                  <span className="hub-hero-sub-pill">Comment đang mở</span>
                </div>
              </div>

              <div className="hub-hero-card hero-indigo">
                <div className="hub-card-header">
                  <span className="hub-hero-icon"><Kanban size={18} /></span>
                  <span className="hub-hero-label">Workboard Tickets</span>
                </div>
                <div className="hub-card-body">
                  <strong className="hub-hero-value">{dashboardWorkItems.length}</strong>
                  <span className="hub-hero-sub-pill">
                    {dashboardWorkItems.filter((i) => i.status === "DONE").length} đã hoàn thành
                  </span>
                </div>
              </div>
            </div>

            {/* Bento Grid Projects Header with Filter & Sort */}
            <div className="project-hub-section-header">
              <div className="section-header-left">
                <div className="section-title-wrap">
                  <h3>Danh sách dự án</h3>
                  <span className="project-count-badge">{filteredProjectsHub.length} dự án</span>
                </div>
                <p className="section-subtitle">Không gian làm việc & quản lý tài liệu chi tiết cho từng dự án</p>
              </div>

              <div className="project-hub-filter-bar">
                <label className="project-hub-search">
                  <Search size={15} />
                  <input
                    value={projectHubSearch}
                    onChange={(e) => setProjectHubSearch(e.target.value)}
                    placeholder="Tìm tên hoặc mã dự án..."
                  />
                  {projectHubSearch && (
                    <button
                      className="search-clear-btn"
                      type="button"
                      onClick={() => setProjectHubSearch("")}
                      title="Xóa tìm kiếm"
                    >
                      <X size={12} />
                    </button>
                  )}
                </label>

                <CustomHeaderSelect
                  value={projectHubFilter}
                  onChange={setProjectHubFilter}
                  icon={Filter}
                  options={[
                    { value: "all", label: "Tất cả dự án" },
                    { value: "active", label: "Dự án có tài liệu" },
                    { value: "has_comments", label: "Có trao đổi chưa xử lý" }
                  ]}
                />

                <CustomHeaderSelect
                  value={projectHubSort}
                  onChange={setProjectHubSort}
                  icon={SlidersHorizontal}
                  options={[
                    { value: "newest", label: "Sắp xếp: Mới nhất" },
                    { value: "oldest", label: "Sắp xếp: Cũ nhất" },
                    { value: "name_asc", label: "Tên: A → Z" },
                    { value: "name_desc", label: "Tên: Z → A" },
                    { value: "docs_desc", label: "Nhiều tài liệu nhất" }
                  ]}
                />
              </div>
            </div>

            <div className="project-hub-grid">
              {filteredProjectsHub.length === 0 ? (
                <div className="project-hub-empty">
                  <div className="project-hub-empty-icon">
                    <FolderKanban size={36} />
                  </div>
                  <h4>Không tìm thấy dự án phù hợp</h4>
                  <p>Thử điều chỉnh từ khóa tìm kiếm hoặc tạo một không gian dự án mới cho team.</p>
                  <button
                    className="btn-primary"
                    type="button"
                    onClick={() => setIsCreateProjectModalOpen(true)}
                  >
                    <FolderPlus size={16} /> Tạo dự án mới
                  </button>
                </div>
              ) : (
                filteredProjectsHub.map((project) => {
                  const projectDocs = documentsList.filter((d) => d.projectId === project.id);
                  const docCount = projectDocs.length;
                  const draftDocsCount = projectDocs.filter((d) => d.status === "Draft").length;
                  const deployedDocsCount = projectDocs.filter((d) => d.status === "Triển khai").length;
                  const openCommentsCount = getProjectOpenCommentsCount(project.id) || project.openComments || 0;
                  const isSelected = selectedProjectId === project.id;
                  const progressPct = docCount > 0 ? Math.round((deployedDocsCount / docCount) * 100) : 0;
                  const members = projectMembersByProject[project.id] ?? [];
                  const projectWorkItems = dashboardWorkItems.filter((item) => item.projectId === project.id);

                  return (
                    <div
                      className="project-hub-card"
                      key={project.id}
                    >
                      <div className="project-hub-card-top">
                        <div className="project-hub-card-code">
                          <span className="code-tag">{project.code}</span>
                          <span className="active-pill">
                            <span className="active-dot"></span> Vận hành
                          </span>
                        </div>
                        <div className="project-hub-card-actions">
                          <button
                            type="button"
                            className="hub-card-btn"
                            title="Sửa thông tin dự án"
                            onClick={(e) => openEditProjectModal(project, e)}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="hub-card-btn danger"
                            title="Xóa dự án"
                            onClick={(e) => requestDeleteProject(project.id, e)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div className="project-hub-card-body">
                        <h3>{project.name}</h3>
                        <p className="project-hub-unit">
                          <Layers size={13} /> {project.client || "Internal Team • Vận hành nội bộ"}
                        </p>
                      </div>


                      <div className="project-hub-card-metrics">
                        <div className="hub-metric-item" title="Số tài liệu Draft">
                          <PenLine size={13} className="text-amber" />
                          <span>Draft: <strong>{draftDocsCount}</strong></span>
                        </div>
                        <div className="hub-metric-item" title="Số tài liệu Triển khai">
                          <FileCheck2 size={13} className="text-emerald" />
                          <span>Triển khai: <strong>{deployedDocsCount}</strong></span>
                        </div>
                        <div className="hub-metric-item" title="Số trao đổi mở">
                          <MessageSquareText size={13} className="text-indigo" />
                          <span>Trao đổi: <strong>{openCommentsCount}</strong></span>
                        </div>
                      </div>

                      <div className="project-hub-card-footer">
                        {(() => {
                          const allMembers = members.length > 0 ? members : [{ id: currentUser.id, name: currentUser.name, email: currentUser.email, role: currentUser.role }];
                          const tooltipText = allMembers.map((m) => `${m.name} (${m.projectRole || m.role || "Thành viên"})`).join("\n");

                          return (
                            <div className="project-members-stack">
                              <div className="members-stack-avatars" title={tooltipText}>
                                {allMembers.slice(0, 3).map((m, idx) => (
                                  <span key={m.id || idx} className="member-avatar-chip">
                                    {m.name.charAt(0).toUpperCase()}
                                  </span>
                                ))}
                                {allMembers.length > 3 && (
                                  <span className="member-avatar-chip more">+{allMembers.length - 3}</span>
                                )}

                                {/* Hover Tooltip Card */}
                                <div className="members-tooltip-popup">
                                  <div className="tooltip-header">
                                    <Users size={12} />
                                    <span>Người có quyền ({allMembers.length})</span>
                                  </div>
                                  <div className="tooltip-member-list">
                                    {allMembers.map((m, idx) => {
                                      const roleStr = m.projectRole || m.role;
                                      const roleLabel = roleStr === "MANAGER" || roleStr === "ADMIN"
                                        ? "Quản trị viên (Manager)"
                                        : roleStr === "EDITOR"
                                          ? "Chỉnh sửa (Editor)"
                                          : roleStr === "REVIEWER"
                                            ? "Xem & Duyệt (Reviewer)"
                                            : roleStr === "VIEWER"
                                              ? "Chỉ xem (Viewer)"
                                              : "Thành viên";
                                      return (
                                        <div className="tooltip-member-item" key={m.id || idx}>
                                          <span className="mini-avatar">{m.name.charAt(0).toUpperCase()}</span>
                                          <div className="member-text">
                                            <strong>{m.name}</strong>
                                            <small>{roleLabel}</small>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>

                              <span className="project-workitem-count">
                                <Kanban size={12} /> {projectWorkItems.length} tickets
                              </span>
                            </div>
                          );
                        })()}

                        <button
                          type="button"
                          className="btn-primary full-w hub-open-btn"
                          onClick={() => handleOpenProjectWorkspace(project.id)}
                        >
                          <span>Truy cập dự án</span>
                          <ExternalLink size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        ) : activeTabNav === "admin" ? (
          <Suspense fallback={<div className="content-loading">Đang tải quản trị user...</div>}>
            <AdminPanel
              projects={projectsList}
              documents={documentsList}
              currentUser={currentUser}
              onToast={addToast}
              triggerCreate={adminTriggerCreate}
              triggerRefresh={adminTriggerRefresh}
            />
          </Suspense>
        ) : activeTabNav === "review" ? (
          <section className="project-workboard-page">
            <div className="workboard-metrics">
              {[
                { label: "Đang mở", value: workboardMetrics.openItems.length, Icon: Clock, tone: "indigo" },
                { label: "Bug critical", value: workboardMetrics.criticalBugs.length, Icon: AlertTriangle, tone: "rose" },
                { label: "Quá hạn", value: workboardMetrics.overdueItems.length, Icon: AlertTriangle, tone: "amber" },
                { label: "Blocked", value: workboardMetrics.blockedItems.length, Icon: GitBranch, tone: "violet" },
                { label: "Hoàn thành", value: `${workboardMetrics.completionRate}%`, Icon: CheckCheck, tone: "emerald" }
              ].map(({ label, value, Icon, tone }) => (
                <div className={`workboard-metric ${tone}`} key={label}>
                  <span><Icon size={16} /></span>
                  <strong>{value}</strong>
                  <small>{label}</small>
                </div>
              ))}
            </div>

            <div className="workboard-controls">
              <div className="workboard-filter-menu-bar">
                <div className="filter-bar-label">
                  <SlidersHorizontal size={14} />
                  <span>Bộ lọc:</span>
                </div>

                <label className="workboard-search-box">
                  <Search size={14} />
                  <input
                    value={workboardSearchQuery}
                    onChange={(event) => setWorkboardSearchQuery(event.target.value)}
                    placeholder="Tìm ticket..."
                  />
                </label>

                {/* LOẠI filter */}
                <div className="custom-form-select-wrapper filter-select-wrapper" style={{ position: "relative" }}>
                  <span className="select-label">Loại:</span>
                  <button type="button" className="form-select-trigger" onClick={() => setOpenFilterDropdown(openFilterDropdown === "type" ? null : "type")}>
                    <span className="trigger-label-text">{workboardTypeFilter === "ALL" ? `Tất cả loại (${workItems.length})` : WORK_ITEM_TYPE_LABEL[workboardTypeFilter]}</span>
                    <ChevronDown size={13} className={`trigger-arrow-icon${openFilterDropdown === "type" ? " rotate" : ""}`} />
                  </button>
                  {openFilterDropdown === "type" && (
                    <>
                      <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setOpenFilterDropdown(null)} />
                      <div className="custom-form-select-menu">
                        {(["ALL", "TASK", "BUG", "REVIEW", "CHANGE_REQUEST", "QUESTION"] as const).map((v) => {
                          const isSelected = workboardTypeFilter === v;
                          return (
                            <button key={v} type="button" className={`custom-select-option${isSelected ? " selected" : ""}`} onClick={() => { setWorkboardTypeFilter(v as any); setOpenFilterDropdown(null); }}>
                              <span>{v === "ALL" ? `Tất cả loại (${workItems.length})` : WORK_ITEM_TYPE_LABEL[v]}</span>
                              {isSelected && <CheckCheck size={14} className="option-check-mark" />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* PRIORITY filter */}
                <div className="custom-form-select-wrapper filter-select-wrapper" style={{ position: "relative" }}>
                  <span className="select-label">Priority:</span>
                  <button type="button" className="form-select-trigger" onClick={() => setOpenFilterDropdown(openFilterDropdown === "priority" ? null : "priority")}>
                    <span className="trigger-label-text">{workboardPriorityFilter === "ALL" ? "Tất cả độ ưu tiên" : WORK_ITEM_PRIORITY_LABEL[workboardPriorityFilter]}</span>
                    <ChevronDown size={13} className={`trigger-arrow-icon${openFilterDropdown === "priority" ? " rotate" : ""}`} />
                  </button>
                  {openFilterDropdown === "priority" && (
                    <>
                      <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setOpenFilterDropdown(null)} />
                      <div className="custom-form-select-menu">
                        {(["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((v) => {
                          const isSelected = workboardPriorityFilter === v;
                          return (
                            <button key={v} type="button" className={`custom-select-option${isSelected ? " selected" : ""}`} onClick={() => { setWorkboardPriorityFilter(v as any); setOpenFilterDropdown(null); }}>
                              <span>{v === "ALL" ? "Tất cả độ ưu tiên" : WORK_ITEM_PRIORITY_LABEL[v]}</span>
                              {isSelected && <CheckCheck size={14} className="option-check-mark" />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* GIAO filter */}
                <div className="custom-form-select-wrapper filter-select-wrapper" style={{ position: "relative" }}>
                  <span className="select-label">Giao:</span>
                  <button type="button" className="form-select-trigger" onClick={() => setOpenFilterDropdown(openFilterDropdown === "assignee" ? null : "assignee")}>
                    <span className="trigger-label-text">{workboardAssigneeFilter === "ALL" ? "Tất cả người phụ trách" : workboardAssigneeFilter}</span>
                    <ChevronDown size={13} className={`trigger-arrow-icon${openFilterDropdown === "assignee" ? " rotate" : ""}`} />
                  </button>
                  {openFilterDropdown === "assignee" && (
                    <>
                      <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setOpenFilterDropdown(null)} />
                      <div className="custom-form-select-menu">
                        {["ALL", ...workboardAssigneeOptions].map((v) => {
                          const isSelected = workboardAssigneeFilter === v;
                          return (
                            <button key={v} type="button" className={`custom-select-option${isSelected ? " selected" : ""}`} onClick={() => { setWorkboardAssigneeFilter(v); setOpenFilterDropdown(null); }}>
                              <span>{v === "ALL" ? "Tất cả người phụ trách" : v}</span>
                              {isSelected && <CheckCheck size={14} className="option-check-mark" />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* NGƯỜI TẠO filter */}
                <div className="custom-form-select-wrapper filter-select-wrapper" style={{ position: "relative" }}>
                  <span className="select-label">Người tạo:</span>
                  <button type="button" className="form-select-trigger" onClick={() => setOpenFilterDropdown(openFilterDropdown === "creator" ? null : "creator")}>
                    <span className="trigger-label-text">{workboardCreatorFilter === "ALL" ? "Tất cả người tạo" : workboardCreatorFilter}</span>
                    <ChevronDown size={13} className={`trigger-arrow-icon${openFilterDropdown === "creator" ? " rotate" : ""}`} />
                  </button>
                  {openFilterDropdown === "creator" && (
                    <>
                      <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setOpenFilterDropdown(null)} />
                      <div className="custom-form-select-menu">
                        {["ALL", ...workboardCreatorOptions].map((v) => {
                          const isSelected = workboardCreatorFilter === v;
                          return (
                            <button key={v} type="button" className={`custom-select-option${isSelected ? " selected" : ""}`} onClick={() => { setWorkboardCreatorFilter(v); setOpenFilterDropdown(null); }}>
                              <span>{v === "ALL" ? "Tất cả người tạo" : v}</span>
                              {isSelected && <CheckCheck size={14} className="option-check-mark" />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* SẮP XẾP filter */}
                <div className="custom-form-select-wrapper filter-select-wrapper" style={{ position: "relative" }}>
                  <span className="select-label">Sắp xếp:</span>
                  <button type="button" className="form-select-trigger" onClick={() => setOpenFilterDropdown(openFilterDropdown === "sort" ? null : "sort")}>
                    <span className="trigger-label-text">{({ BOARD_ORDER: "Thứ tự board", UPDATED_DESC: "Mới cập nhật", DUE_ASC: "Hạn gần nhất", PRIORITY_DESC: "Priority cao nhất" } as Record<string, string>)[workboardSortBy]}</span>
                    <ChevronDown size={13} className={`trigger-arrow-icon${openFilterDropdown === "sort" ? " rotate" : ""}`} />
                  </button>
                  {openFilterDropdown === "sort" && (
                    <>
                      <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setOpenFilterDropdown(null)} />
                      <div className="custom-form-select-menu">
                        {([{ value: "BOARD_ORDER", label: "Thứ tự board" }, { value: "UPDATED_DESC", label: "Mới cập nhật" }, { value: "DUE_ASC", label: "Hạn gần nhất" }, { value: "PRIORITY_DESC", label: "Priority cao nhất" }]).map(({ value, label }) => {
                          const isSelected = workboardSortBy === value;
                          return (
                            <button key={value} type="button" className={`custom-select-option${isSelected ? " selected" : ""}`} onClick={() => { setWorkboardSortBy(value as typeof workboardSortBy); setOpenFilterDropdown(null); }}>
                              <span>{label}</span>
                              {isSelected && <CheckCheck size={14} className="option-check-mark" />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {(workboardTypeFilter !== "ALL" ||
                  workboardPriorityFilter !== "ALL" ||
                  workboardAssigneeFilter !== "ALL" ||
                  workboardCreatorFilter !== "ALL" ||
                  workboardSearchQuery.trim() ||
                  workboardSortBy !== "BOARD_ORDER") && (
                    <button
                      className="btn-reset-filters"
                      type="button"
                      title="Xóa tất cả bộ lọc"
                      onClick={() => {
                        setWorkboardSearchQuery("");
                        setWorkboardTypeFilter("ALL");
                        setWorkboardPriorityFilter("ALL");
                        setWorkboardAssigneeFilter("ALL");
                        setWorkboardCreatorFilter("ALL");
                        setWorkboardSortBy("BOARD_ORDER");
                      }}
                    >
                      <X size={12} /> Reset
                    </button>
                  )}
              </div>

              <div className="workboard-filter-summary">
                <span>Hiển thị <strong>{visibleWorkItems.length}</strong> / {workItems.length} công việc</span>
              </div>
            </div>

            <div className="workboard-kanban" aria-label="Project workboard">
              {selectedWorkboardColumns.map((column) => {
                const columnItems = visibleWorkItems.filter((item) => workItemBelongsToColumn(item, column, selectedWorkboardColumns));
                return (
                  <section
                    className={`workboard-column status-${statusForWorkboardColumn(column).toLowerCase()} ${draggingWorkItemId ? "drop-ready" : ""}`}
                    style={{ "--column-color": column.color } as CSSProperties}
                    key={column.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      void handleDropWorkItem(column);
                    }}
                  >
                    <div className="workboard-column-header">
                      <div>
                        <strong>{column.name}</strong>
                        <small>{workboardColumnHint(column)}</small>
                      </div>
                      <div className="workboard-column-actions">
                        <span className="count-badge">{columnItems.length}</span>
                        <button
                          type="button"
                          title={`Tạo ticket ở ${column.name}`}
                          onClick={() => openCreateWorkItemModal(column)}
                          disabled={!selectedProject.id}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="workboard-card-list">
                      {columnItems.map((item) => (
                        <article
                          className={`workboard-card priority-${item.priority.toLowerCase()} ${draggingWorkItemId === item.id ? "dragging" : ""}`}
                          key={item.id}
                          draggable
                          onDragStart={() => setDraggingWorkItemId(item.id)}
                          onDragEnd={() => setDraggingWorkItemId(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const rect = event.currentTarget.getBoundingClientRect();
                            const placement = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                            void handleDropWorkItem(column, item.id, placement);
                          }}
                        >
                          <button className="workboard-card-main" type="button" onClick={() => openViewWorkItemModal(item)}>
                            <div className="workboard-card-badges">
                              <span className={`workitem-type type-${item.type.toLowerCase()}`}>
                                {workItemTypeIcon(item.type)} {WORK_ITEM_TYPE_LABEL[item.type]}
                              </span>
                              <span className={`workitem-priority priority-${item.priority.toLowerCase()}`}>
                                {WORK_ITEM_PRIORITY_LABEL[item.priority]}
                              </span>
                            </div>
                            <strong>{displayWorkItemTitle(item)}</strong>
                            <span><Users size={12} /> Tạo bởi: {getWorkItemCreatorName(item)}</span>
                            <span><UserCheck size={12} /> Giao: {workItemAssigneeLabel(item)}</span>
                            <span><Clock size={12} /> Tạo {formatWorkItemDate(item.createdAt)} · Hạn {formatWorkItemDate(item.dueDate)}</span>
                          </button>
                          <div className="workboard-card-actions">
                            <button
                              type="button"
                              title="Duplicate ticket"
                              onClick={() => void handleDuplicateWorkItem(item)}
                            >
                              <Copy size={13} />
                            </button>
                            {isOwnWorkItem(item) && (
                              <>
                                <button
                                  type="button"
                                  title="Sửa ticket"
                                  onClick={() => openEditWorkItemModal(item)}
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  className="danger"
                                  type="button"
                                  title="Xóa ticket"
                                  onClick={() => requestDeleteWorkItem(item)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      ))}
                      {columnItems.length === 0 && (
                        <div className="workboard-empty-column">Kéo ticket vào đây để đổi trạng thái.</div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        ) : (
          <section className={gridLayoutClass}>
            {/* Panel 1: Document Library (Collapsible) */}
            {/* Panel 1: Document Library (Collapsible) */}
            {showLibraryPanel && (
              <div className="panel library">
                <div className="panel-header">
                  <div className="panel-title">
                    <h2>Tài liệu</h2>
                  </div>
                  <div className="panel-action-group">
                    <button
                      className="btn-add-mini"
                      type="button"
                      title="Import tệp tài liệu mới vào dự án"
                      disabled={!selectedProjectId}
                      onClick={() => {
                        setImportTargetProjectId(selectedProjectId);
                        setIsImportModalOpen(true);
                      }}
                    >
                      <UploadCloud size={13} /> Import
                    </button>
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

                <div className="library-project-bar">
                  <CustomProjectSelect
                    projects={projectsList}
                    selectedProjectId={selectedProjectId}
                    onSelectProject={handleSelectProject}
                  />
                </div>

                <div className="panel-mode-tabs">
                  <button
                    className={leftPanelMode === "docs" ? "mode-tab active" : "mode-tab"}
                    type="button"
                    onClick={() => setLeftPanelMode("docs")}
                  >
                    <FileText size={13} />
                    <span>Tài liệu</span>
                    <span className="mode-count">{filteredDocuments.length}</span>
                  </button>
                  <button
                    className={leftPanelMode === "toc" ? "mode-tab active" : "mode-tab"}
                    type="button"
                    onClick={() => setLeftPanelMode("toc")}
                  >
                    <ListTree size={13} />
                    <span>Mục lục</span>
                    <span className="mode-count">{selectedDocument.id === "empty-document" ? 0 : tocItems.length}</span>
                  </button>
                </div>

                {leftPanelMode === "docs" ? (
                  <>
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

                    {/* Documents List */}
                    <div className="document-table">
                      {filteredDocuments.length === 0 ? (
                        <div className="document-empty-state">
                          <BookOpen size={24} />
                          <p>Không có tài liệu nào phù hợp.</p>
                        </div>
                      ) : (
                        filteredDocuments.map((doc) => {
                          const docCommentsCount = documentCommentCounts[doc.id] ?? doc.openCommentsCount ?? 0;
                          const fullTitle = normalizeVietnameseText(doc.title);
                          const fileKind = doc.fileType === "pdf" ? "pdf" : doc.fileType === "md" ? "md" : "doc";
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
                              <div className="doc-row-top">
                                <div className={`doc-icon ${fileKind}`}>
                                  {doc.fileType === "pdf" ? (
                                    <FileText size={15} />
                                  ) : doc.fileType === "md" ? (
                                    <FileCode size={15} />
                                  ) : (
                                    <FileCheck2 size={15} />
                                  )}
                                </div>
                                <div className="doc-info">
                                  <strong title={fullTitle}>{fullTitle}</strong>
                                  <small>{doc.type} • {doc.owner}</small>
                                </div>
                              </div>
                              <div className="doc-row-bottom">
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
                    onClick={openShareAccessModal}
                    title={selectedDocument.id === "empty-document" ? "Chia sẻ quyền truy cập dự án" : "Chia sẻ quyền truy cập tài liệu"}
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

                        <button
                          type="button"
                          className="menu-item"
                          onClick={() => {
                            setIsActionsDropdownOpen(false);
                            void openVersionHistoryModal();
                          }}
                        >
                          <Layers size={14} /> Lịch sử phiên bản
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

                  <button
                    className={`btn-secondary focus-read-btn ${isZenMode ? "active" : ""}`}
                    type="button"
                    onClick={toggleFocusReadingMode}
                    title={isZenMode ? "Thoát chế độ tập trung đọc" : "Bật chế độ tập trung đọc"}
                  >
                    <BookOpen size={14} />
                    <span>{isZenMode ? "Thoát đọc" : "Tập trung đọc"}</span>
                  </button>
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
                            <div className="comment-footer-meta">
                              <small className="comment-time">{comment.createdAt}</small>
                            </div>
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
                              {isOwnDocumentComment(comment) && (
                                <div className="comment-menu-wrapper" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    className="btn-comment-action icon-only"
                                    type="button"
                                    title="Tùy chọn (Sửa / Xóa)"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setActiveCommentMenuId(activeCommentMenuId === comment.id ? null : comment.id);
                                    }}
                                  >
                                    <MoreVertical size={13} />
                                  </button>

                                  {activeCommentMenuId === comment.id && (
                                    <div className="comment-menu-dropdown">
                                      {comment.status === "open" && (
                                        <button
                                          type="button"
                                          className="comment-menu-item"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setActiveCommentMenuId(null);
                                            setEditingCommentId(comment.id);
                                            setEditingCommentText(comment.text);
                                          }}
                                        >
                                          <Pencil size={12} /> Sửa nhận xét
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        className="comment-menu-item danger"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setActiveCommentMenuId(null);
                                          requestDeleteComment(comment.id);
                                        }}
                                      >
                                        <Trash2 size={12} /> Xóa nhận xét
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
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
                                    {reply.status === "open" && isOwnDocumentComment(reply) && (
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
                                    {isOwnDocumentComment(reply) && (
                                      <button
                                        className="btn-comment-action danger"
                                        type="button"
                                        title="Xóa phản hồi"
                                        onClick={() => requestDeleteComment(reply.id)}
                                      >
                                        <Trash2 size={11} /> Xóa
                                      </button>
                                    )}
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

      {isVersionModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content version-modal-content">
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <div className="modal-header-badge">
                  <Layers size={20} />
                </div>
                <div>
                  <h3>Lịch sử phiên bản</h3>
                  <p className="modal-subtitle">{selectedDocument.title}</p>
                </div>
              </div>
              <button
                className="icon-btn"
                type="button"
                onClick={() => setIsVersionModalOpen(false)}
                disabled={Boolean(restoringVersionId)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {isLoadingVersions ? (
                <div className="version-empty-state">Đang tải lịch sử phiên bản...</div>
              ) : documentVersions.length === 0 ? (
                <div className="version-empty-state">Tài liệu chưa có phiên bản nào được lưu.</div>
              ) : (
                <div className="version-list">
                  {documentVersions.map((version, index) => {
                    const isCurrentVersion = version.version === selectedDocument.version;
                    return (
                      <div key={version.id} className={isCurrentVersion ? "version-row current" : "version-row"}>
                        <div className="version-row-main">
                          <div>
                            <strong>{version.version}</strong>
                            {isCurrentVersion && <span className="version-current-badge">Hiện tại</span>}
                          </div>
                          <p>{version.changeNote || (index === documentVersions.length - 1 ? "Phiên bản khởi tạo" : "Cập nhật tài liệu")}</p>
                          <small>
                            {version.createdBy || "Hệ thống"} • {new Date(version.createdAt).toLocaleString("vi-VN")}
                          </small>
                        </div>
                        <button
                          className="btn-secondary"
                          type="button"
                          disabled={isCurrentVersion || Boolean(restoringVersionId)}
                          onClick={() => void handleRestoreVersion(version)}
                        >
                          {restoringVersionId === version.id ? "Đang khôi phục..." : "Khôi phục"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setIsVersionModalOpen(false)}
                disabled={Boolean(restoringVersionId)}
              >
                Đóng
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
                  <h3>Tạo Dự Án Mới</h3>
                  <p className="modal-subtitle">Dự án sẽ nằm trong phạm vi công ty/phòng ban của tài khoản hiện tại</p>
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
              <button
                className="btn-secondary"
                type="button"
                disabled={isCreatingProject}
                onClick={() => setIsCreateProjectModalOpen(false)}
              >
                Hủy
              </button>
              <button
                className="btn-primary"
                type="button"
                disabled={isCreatingProject}
                onClick={handleCreateProject}
              >
                {isCreatingProject ? (
                  <>
                    <Loader2 className="spin-icon" size={16} /> Đang tạo...
                  </>
                ) : (
                  <>
                    <FolderPlus size={16} /> Tạo Dự Án
                  </>
                )}
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
              <button className="icon-btn" type="button" disabled={isSavingEditProject} onClick={() => setIsEditProjectModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group project-name-priority">
                <label>Tên Dự Án (Project Name)</label>
                <input
                  className="form-input"
                  value={editProjName}
                  disabled={isSavingEditProject}
                  onChange={(e) => setEditProjName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Mã Dự Án (Project Code)</label>
                <input
                  className="form-input"
                  placeholder="Để trống hệ thống sẽ tự sinh mã"
                  value={editProjCode}
                  disabled={isSavingEditProject}
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
                    disabled={isSavingEditProject}
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
                    disabled={isSavingEditProject}
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
              <button
                className="btn-secondary"
                type="button"
                disabled={isSavingEditProject}
                onClick={() => setIsEditProjectModalOpen(false)}
              >
                Hủy
              </button>
              <button
                className="btn-primary"
                type="button"
                disabled={isSavingEditProject}
                onClick={handleSaveEditProject}
              >
                {isSavingEditProject ? (
                  <>
                    <Loader2 className="spin-icon" size={16} /> Đang lưu...
                  </>
                ) : (
                  <>
                    <Pencil size={16} /> Lưu Thay Đổi
                  </>
                )}
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

      {/* Work Item Detail Modal */}
      {viewingWorkItem && (
        <div className="modal-backdrop">
          <div className="modal-content workitem-detail-modal">
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <div className={`modal-header-badge type-${viewingWorkItem.type.toLowerCase()}`}>
                  {workItemTypeIcon(viewingWorkItem.type)}
                </div>
                <div>
                  <h3>{displayWorkItemTitle(viewingWorkItem)}</h3>
                  <p className="modal-subtitle">
                    <span className={`workitem-type type-${viewingWorkItem.type.toLowerCase()}`}>
                      {workItemTypeIcon(viewingWorkItem.type)} {WORK_ITEM_TYPE_LABEL[viewingWorkItem.type]}
                    </span>
                    • {workboardColumnLabelForItem(viewingWorkItem)}
                  </p>
                </div>
              </div>
              <div className="modal-header-actions">
                <button className="btn-secondary" type="button" onClick={() => void handleDuplicateWorkItem(viewingWorkItem)}>
                  <Copy size={14} /> Nhân bản
                </button>
                {isOwnWorkItem(viewingWorkItem) && (
                  <button className="btn-secondary" type="button" onClick={() => openEditWorkItemModal(viewingWorkItem)}>
                    <Pencil size={14} /> Sửa
                  </button>
                )}
                <button className="icon-btn" type="button" onClick={() => setViewingWorkItemId(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="modal-body">
              <div className="workitem-detail-summary">
                <div className={`summary-card priority-${viewingWorkItem.priority.toLowerCase()}`}>
                  <span className="summary-label"><AlertTriangle size={12} /> Priority</span>
                  <strong className="summary-value priority-badge">{WORK_ITEM_PRIORITY_LABEL[viewingWorkItem.priority]}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-label"><UserIcon size={12} /> Người phụ trách</span>
                  <strong className="summary-value">{workItemAssigneeLabel(viewingWorkItem)}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-label"><ShieldCheck size={12} /> Người tạo</span>
                  <strong className="summary-value">{viewingWorkItem.createdByName ?? viewingWorkItem.createdBy?.name ?? viewingWorkItem.createdByEmail ?? "Không rõ"}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-label"><Calendar size={12} /> Ngày tạo</span>
                  <strong className="summary-value">{formatWorkItemDate(viewingWorkItem.createdAt)}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-label"><Clock size={12} /> Hạn xử lý</span>
                  <strong className="summary-value">{formatWorkItemDate(viewingWorkItem.dueDate)}</strong>
                </div>
              </div>

              <div className="workitem-detail-block">
                <label className="block-label"><FileText size={13} /> Mô tả công việc</label>
                <div className="description-content">{viewingWorkItem.description || "Chưa có mô tả."}</div>
              </div>

              {viewingWorkItem.document && (
                <div className="workitem-source-note">
                  <BookOpen size={15} />
                  <div>
                    <span>Tài liệu đính kèm liên quan:</span>
                    <strong>{viewingWorkItem.document.title}</strong>
                  </div>
                </div>
              )}

              {workItemLabelNames(viewingWorkItem).length > 0 && (
                <div className="workitem-detail-block">
                  <label className="block-label"><Tags size={13} /> Labels</label>
                  <div className="workitem-label-list">
                    {workItemLabelNames(viewingWorkItem).map((label) => (
                      <span className="workitem-label-chip" key={label}>{label}</span>
                    ))}
                  </div>
                </div>
              )}

              {(viewingWorkItem.checklistItems ?? []).length > 0 && (
                <div className="workitem-detail-block">
                  <label className="block-label"><CheckCheck size={13} /> Checklist</label>
                  <div className="workitem-checklist-list">
                    {(viewingWorkItem.checklistItems ?? []).map((item) => (
                      <div className={item.done ? "workitem-checklist-row done" : "workitem-checklist-row"} key={item.id}>
                        <CheckCircle2 size={14} />
                        <span>{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="workitem-detail-block">
                <label>Ảnh / Video đính kèm</label>
                {(viewingWorkItem.attachments ?? []).length > 0 ? (
                  <div className="workitem-attachment-grid">
                    {(viewingWorkItem.attachments ?? []).map((attachment) => (
                      <a
                        className="workitem-attachment-preview"
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        key={attachment.url}
                        title={attachment.name ?? attachment.url}
                      >
                        {isImageAttachment(attachment) ? (
                          <img src={attachment.url} alt={attachment.name ?? "Ticket attachment"} />
                        ) : isVideoAttachment(attachment) ? (
                          <video src={attachment.url} controls />
                        ) : (
                          <span>{attachment.name ?? "Mở link đính kèm"}</span>
                        )}
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="empty-collab-state">Chưa có ảnh hoặc video đính kèm.</div>
                )}
              </div>

              <div className="workitem-detail-block">
                <div className="block-header-with-action">
                  <label className="block-label">
                    <ActivityIcon size={13} /> Activity history
                    {workItemActivity.length > 0 && <span className="activity-count-badge">{workItemActivity.length}</span>}
                  </label>
                  {workItemActivity.length > 3 && (
                    <button
                      className="btn-toggle-activity"
                      type="button"
                      onClick={() => setShowAllWorkItemActivity((prev) => !prev)}
                    >
                      {showAllWorkItemActivity ? (
                        <>Thu gọn <ChevronUp size={13} /></>
                      ) : (
                        <>Xem tất cả ({workItemActivity.length}) <ChevronDown size={13} /></>
                      )}
                    </button>
                  )}
                </div>

                <div className="workitem-activity-list">
                  {isLoadingWorkItemActivity ? (
                    <div className="empty-collab-state">Đang tải lịch sử ticket...</div>
                  ) : workItemActivity.length === 0 ? (
                    <div className="empty-collab-state">Chưa có lịch sử thay đổi cho ticket này.</div>
                  ) : (
                    (showAllWorkItemActivity ? workItemActivity : workItemActivity.slice(0, 3)).map((activity) => (
                      <div className="workitem-activity-row" key={activity.id}>
                        <span className="activity-dot"></span>
                        <div className="activity-row-content">
                          <strong>{workItemActivityLabel(activity)}</strong>
                          <small>{activity.actor?.name ?? activity.actor?.email ?? "Hệ thống"} · {relativeDashboardTime(activity.createdAt)}</small>
                          {workItemActivityDetail(activity) && <small className="activity-detail-text">{workItemActivityDetail(activity)}</small>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="workitem-comments-section">
                <div className="section-subheader">
                  <div>
                    <h4>Comment & reply</h4>
                    <p>Trao đổi xử lý ticket này.</p>
                  </div>
                </div>

                <div className="workitem-comment-composer">
                  <div className="workitem-mention-input">
                    <div
                      ref={commentEditorRef}
                      className="workitem-mention-editor"
                      contentEditable
                      onInput={() => {
                        if (commentEditorRef.current) {
                          const text = getEditorText(commentEditorRef.current);
                          handleWorkItemCommentTextChange(text, "comment");
                        }
                      }}
                      onFocus={() => {
                        const text = commentEditorRef.current ? getEditorText(commentEditorRef.current) : workItemCommentText;
                        setActiveWorkItemMentionTarget(getMentionTrigger(text) ? "comment" : null);
                      }}
                      onBlur={() => window.setTimeout(() => setActiveWorkItemMentionTarget(null), 150)}
                      data-placeholder="Nhập comment... Gõ @ để mention người xử lý"
                    />
                    {renderWorkItemMentionMenu("comment")}
                  </div>
                  <button className="btn-primary" type="button" onClick={() => void handleAddWorkItemComment()}>
                    <Send size={14} /> Gửi
                  </button>
                </div>

                <div className="workitem-comment-list">
                  {groupedWorkItemComments().map((comment) => (
                    <div className="workitem-comment-card" key={comment.id}>
                      <div className="workitem-comment-meta">
                        <strong>{comment.createdByName ?? comment.createdBy?.name ?? "Người dùng"}</strong>
                        <span>{relativeDashboardTime(comment.createdAt)}</span>
                      </div>
                      {editingWorkItemCommentId === comment.id ? (
                        <div className="workitem-reply-composer">
                          <textarea
                            rows={2}
                            value={editingWorkItemCommentText}
                            onChange={(event) => setEditingWorkItemCommentText(event.target.value)}
                            placeholder="Sửa comment..."
                          />
                          <button className="btn-primary" type="button" onClick={() => void handleSaveWorkItemComment(comment.id)}>
                            <CheckCircle2 size={13} /> Lưu
                          </button>
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() => {
                              setEditingWorkItemCommentId(null);
                              setEditingWorkItemCommentText("");
                            }}
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <>
                          <p>{renderMentionedText(comment.content)}</p>
                          <div className="workitem-comment-actions">
                            <button
                              className="btn-secondary compact"
                              type="button"
                              onClick={() => {
                                setEditingWorkItemCommentId(null);
                                setReplyingWorkItemCommentId(comment.id);
                                setWorkItemReplyText("");
                              }}
                            >
                              <MessageSquarePlus size={13} /> Reply
                            </button>
                            {isOwnWorkItemComment(comment) && (
                              <>
                                <button className="btn-secondary compact" type="button" onClick={() => openEditWorkItemComment(comment)}>
                                  <Pencil size={13} /> Sửa
                                </button>
                                <button className="btn-secondary compact danger" type="button" onClick={() => requestDeleteWorkItemComment(comment)}>
                                  <Trash2 size={13} /> Xóa
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}

                      {comment.replies?.map((reply) => (
                        <div className="workitem-reply-card" key={reply.id}>
                          <div className="workitem-comment-meta">
                            <strong>{reply.createdByName ?? reply.createdBy?.name ?? "Người dùng"}</strong>
                            <span>{relativeDashboardTime(reply.createdAt)}</span>
                          </div>
                          {editingWorkItemCommentId === reply.id ? (
                            <div className="workitem-reply-composer">
                              <textarea
                                rows={2}
                                value={editingWorkItemCommentText}
                                onChange={(event) => setEditingWorkItemCommentText(event.target.value)}
                                placeholder="Sửa reply..."
                              />
                              <button className="btn-primary" type="button" onClick={() => void handleSaveWorkItemComment(reply.id)}>
                                <CheckCircle2 size={13} /> Lưu
                              </button>
                              <button
                                className="btn-secondary"
                                type="button"
                                onClick={() => {
                                  setEditingWorkItemCommentId(null);
                                  setEditingWorkItemCommentText("");
                                }}
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <>
                              <p>{renderMentionedText(reply.content)}</p>
                              {isOwnWorkItemComment(reply) && (
                                <div className="workitem-comment-actions">
                                  <button className="btn-secondary compact" type="button" onClick={() => openEditWorkItemComment(reply)}>
                                    <Pencil size={13} /> Sửa
                                  </button>
                                  <button className="btn-secondary compact danger" type="button" onClick={() => requestDeleteWorkItemComment(reply)}>
                                    <Trash2 size={13} /> Xóa
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}

                      {replyingWorkItemCommentId === comment.id && (
                        <div className="workitem-reply-composer">
                          <div className="workitem-mention-input">
                            <div
                              ref={replyEditorRef}
                              className="workitem-mention-editor"
                              contentEditable
                              onInput={() => {
                                if (replyEditorRef.current) {
                                  const text = getEditorText(replyEditorRef.current);
                                  handleWorkItemCommentTextChange(text, "reply");
                                }
                              }}
                              onFocus={() => {
                                const text = replyEditorRef.current ? getEditorText(replyEditorRef.current) : workItemReplyText;
                                setActiveWorkItemMentionTarget(getMentionTrigger(text) ? "reply" : null);
                              }}
                              onBlur={() => window.setTimeout(() => setActiveWorkItemMentionTarget(null), 150)}
                              data-placeholder="Nhập reply... Gõ @ để mention"
                            />
                            {renderWorkItemMentionMenu("reply")}
                          </div>
                          <button className="btn-primary" type="button" onClick={() => void handleAddWorkItemComment(comment.id)}>
                            <Send size={13} /> Gửi
                          </button>
                          <button className="btn-secondary" type="button" onClick={() => setReplyingWorkItemCommentId(null)}>
                            Hủy
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {groupedWorkItemComments().length === 0 && (
                    <div className="empty-collab-state">Chưa có comment nào cho ticket này.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Workboard Config Modal */}
      {isWorkboardConfigOpen && (
        <div className="modal-backdrop">
          <div className="modal-content workboard-config-modal">
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <div className="modal-header-badge">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3>Tùy chỉnh Workboard</h3>
                  <p className="modal-subtitle">{selectedProject.code} • Cấu hình cột Kanban theo project</p>
                </div>
              </div>
              <button className="icon-btn" type="button" onClick={() => setIsWorkboardConfigOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="wbcfg-columns">
                {workboardColumnDrafts.map((draft, index) => (
                  <div
                    className="wbcfg-card"
                    key={draft.id ?? `new-${index}`}
                    draggable
                    onDragStart={(e) => {
                      wbcfgDragRef.current = { fromIndex: index, toIndex: index };
                      e.dataTransfer.effectAllowed = "move";
                      (e.currentTarget as HTMLElement).classList.add("wbcfg-dragging");
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (wbcfgDragRef.current) wbcfgDragRef.current.toIndex = index;
                      // Visual drop indicator
                      document.querySelectorAll(".wbcfg-card").forEach((el) => el.classList.remove("wbcfg-drag-over"));
                      (e.currentTarget as HTMLElement).classList.add("wbcfg-drag-over");
                    }}
                    onDragEnd={(e) => {
                      (e.currentTarget as HTMLElement).classList.remove("wbcfg-dragging");
                      document.querySelectorAll(".wbcfg-card").forEach((el) => el.classList.remove("wbcfg-drag-over"));
                      if (wbcfgDragRef.current) {
                        reorderWorkboardColumnDraft(wbcfgDragRef.current.fromIndex, wbcfgDragRef.current.toIndex);
                        wbcfgDragRef.current = null;
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                    }}
                  >
                    <div className="wbcfg-card-header" style={{ cursor: "grab" }}>
                      <div className="wbcfg-card-handle">
                        <GripVertical size={14} className="wbcfg-grip-icon" />
                        <span className="wbcfg-order-num">{index + 1}</span>
                        <div className="wbcfg-color-dot" style={{ background: draft.color }} />
                        <span className="wbcfg-card-title">{draft.name || "Cột mới"}</span>
                      </div>
                      <div className="wbcfg-card-actions">
                        <button className="wbcfg-move-btn" type="button" onClick={() => moveWorkboardColumnDraft(index, -1)} disabled={index === 0} title="Di chuyển lên">
                          <ChevronUp size={14} />
                        </button>
                        <button className="wbcfg-move-btn" type="button" onClick={() => moveWorkboardColumnDraft(index, 1)} disabled={index === workboardColumnDrafts.length - 1} title="Di chuyển xuống">
                          <ChevronDown size={14} />
                        </button>
                        <button
                          className="wbcfg-move-btn wbcfg-delete-btn"
                          type="button"
                          title="Xóa cột"
                          onClick={() => requestRemoveWorkboardColumn(index)}
                          disabled={workboardColumnDrafts.length <= 1}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="wbcfg-card-body">
                      <div className="wbcfg-field wbcfg-field-name">
                        <label>Tên cột</label>
                        <input
                          className="form-input"
                          value={draft.name}
                          onChange={(event) => updateWorkboardColumnDraft(index, { name: event.target.value })}
                          placeholder="Tên hiển thị..."
                        />
                      </div>
                      <div className="wbcfg-field wbcfg-field-color">
                        <label>Màu</label>
                        <div className="wbcfg-color-wrapper">
                          <input
                            type="color"
                            value={draft.color}
                            onChange={(event) => updateWorkboardColumnDraft(index, { color: event.target.value })}
                          />
                        </div>
                      </div>
                      <div className="wbcfg-field wbcfg-field-type">
                        <label>Nhóm trạng thái</label>
                        <div className="custom-form-select-wrapper" style={{ position: "relative" }}>
                          <button
                            type="button"
                            className="form-select-trigger"
                            onClick={() => setWbcfgOpenDropdown(wbcfgOpenDropdown === index ? null : index)}
                          >
                            <span className="trigger-label-text">
                              {WORKBOARD_COLUMN_TYPE_OPTIONS.find((o) => o.value === draft.type)?.label ?? "Chọn..."}
                            </span>
                            <ChevronDown size={14} className={`trigger-arrow-icon${wbcfgOpenDropdown === index ? " rotate" : ""}`} />
                          </button>
                          {wbcfgOpenDropdown === index && (
                            <>
                              <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setWbcfgOpenDropdown(null)} />
                              <div className="custom-form-select-menu">
                                {WORKBOARD_COLUMN_TYPE_OPTIONS.map((option) => {
                                  const isSelected = draft.type === option.value;
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      className={`custom-select-option${isSelected ? " selected" : ""}`}
                                      onClick={() => {
                                        updateWorkboardColumnDraft(index, { type: option.value });
                                        setWbcfgOpenDropdown(null);
                                      }}
                                    >
                                      <span>{option.label}</span>
                                      {isSelected && <CheckCheck size={14} className="option-check-mark" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="wbcfg-field wbcfg-field-flags">
                        <label className={`wbcfg-pill${draft.isDefault ? " active" : ""}`}>
                          <input
                            type="checkbox"
                            checked={draft.isDefault}
                            onChange={(event) => updateWorkboardColumnDraft(index, { isDefault: event.target.checked })}
                          />
                          Mặc định
                        </label>
                        <label className={`wbcfg-pill${draft.isDone ? " active" : ""}`}>
                          <input
                            type="checkbox"
                            checked={draft.isDone}
                            onChange={(event) => updateWorkboardColumnDraft(index, { isDone: event.target.checked, type: event.target.checked ? "DONE" : draft.type })}
                          />
                          Done
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="wbcfg-add-btn" type="button" onClick={addWorkboardColumnDraft}>
                <Plus size={15} /> Thêm cột mới
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" type="button" onClick={() => setIsWorkboardConfigOpen(false)} disabled={isSavingWorkboardColumns}>
                Hủy
              </button>
              <button className="btn-primary" type="button" onClick={() => void handleSaveWorkboardColumns()} disabled={isSavingWorkboardColumns}>
                {isSavingWorkboardColumns ? <><Loader2 className="spin-icon" size={15} /> Đang lưu...</> : <><CheckCircle2 size={15} /> Lưu board</>}
              </button>
            </div>

            {/* Inline Delete Confirmation Overlay */}
            {pendingDeleteColumnIndex !== null && (
              <div className="wbcfg-confirm-overlay">
                <div className="wbcfg-confirm-card">
                  <div className="wbcfg-confirm-icon">
                    <Trash2 size={22} />
                  </div>
                  <h4>Xóa cột "{workboardColumnDrafts[pendingDeleteColumnIndex]?.name || "Cột mới"}"?</h4>
                  <p>Cột này sẽ bị xóa khỏi board. Các ticket trong cột cần được di chuyển trước khi lưu.</p>
                  <div className="wbcfg-confirm-actions">
                    <button className="btn-secondary" type="button" onClick={cancelRemoveWorkboardColumn}>
                      Giữ lại
                    </button>
                    <button className="wbcfg-confirm-delete-btn" type="button" onClick={confirmRemoveWorkboardColumn}>
                      <Trash2 size={14} /> Xóa cột
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isWorkItemModalOpen && workItemDraft && (
        <div className="modal-backdrop">
          <div className="modal-content workitem-modal-content">
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <div className="modal-header-badge">
                  <FolderKanban size={20} />
                </div>
                <div>
                  <h3>{workItemDraft.id ? "Cập nhật ticket" : "Tạo ticket mới"}</h3>
                  <p className="modal-subtitle">{selectedProject.code} • Task, bug, review và thay đổi phát sinh</p>
                </div>
              </div>
              <button className="icon-btn" type="button" onClick={() => {
                setIsAssigneeMenuOpen(false);
                setIsWorkItemModalOpen(false);
              }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {/* Primary Title Field */}
              <div className="workitem-title-field">
                <label>
                  <PenLine size={13} /> Tiêu đề ticket <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  className="form-input"
                  value={workItemDraft.title}
                  onChange={(event) => setWorkItemDraft({ ...workItemDraft, title: event.target.value })}
                  placeholder="Ví dụ: Sửa validation ngày hết hạn"
                  autoFocus
                />
              </div>

              {/* 2-Column Property Grid */}
              <div className="workitem-form-grid">
                <div className="form-group">
                  <label><Tags size={13} /> Loại item</label>
                  <CustomFormSelect
                    value={workItemDraft.type}
                    onChange={(val) => setWorkItemDraft({ ...workItemDraft, type: val })}
                    options={(["TASK", "BUG", "REVIEW", "CHANGE_REQUEST", "QUESTION"] as const).map((type) => ({
                      value: type,
                      label: WORK_ITEM_TYPE_LABEL[type]
                    }))}
                  />
                </div>

                <div className="form-group">
                  <label><FolderKanban size={13} /> Trạng thái</label>
                  <CustomFormSelect
                    value={workItemDraft.columnId}
                    onChange={(colId) => {
                      const column = selectedWorkboardColumns.find((entry) => entry.id === colId);
                      setWorkItemDraft({
                        ...workItemDraft,
                        columnId: colId,
                        status: statusForWorkboardColumn(column)
                      });
                    }}
                    options={selectedWorkboardColumns.map((column) => ({
                      value: column.id,
                      label: column.name
                    }))}
                  />
                </div>

                <div className="form-group">
                  <label><AlertTriangle size={13} /> Priority</label>
                  <CustomFormSelect
                    value={workItemDraft.priority}
                    onChange={(pri) => setWorkItemDraft({ ...workItemDraft, priority: pri })}
                    options={(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((priority) => ({
                      value: priority,
                      label: WORK_ITEM_PRIORITY_LABEL[priority]
                    }))}
                  />
                </div>

                <div className="form-group">
                  <label><Calendar size={13} /> Hạn xử lý</label>
                  <CustomDatePicker
                    value={workItemDraft.dueDate}
                    onChange={(val) => setWorkItemDraft({ ...workItemDraft, dueDate: val })}
                  />
                </div>

                <div className="form-group">
                  <label><FileText size={13} /> Tài liệu liên quan</label>
                  <CustomFormSelect
                    value={workItemDraft.documentId ?? ""}
                    onChange={(docId) => setWorkItemDraft({ ...workItemDraft, documentId: docId })}
                    options={[
                      { value: "", label: "Không gắn tài liệu" },
                      ...projectDeployedDocuments.map((doc) => ({
                        value: doc.id,
                        label: doc.title
                      }))
                    ]}
                  />
                </div>

                <div className="form-group">
                  <label><UserCheck size={13} /> Người phụ trách</label>
                  <div className="workitem-assignee-select" ref={workItemAssigneeDropdownRef}>
                    <button
                      className="workitem-assignee-summary"
                      type="button"
                      onClick={() => setIsAssigneeMenuOpen((open) => !open)}
                    >
                      <span>
                        {selectedWorkItemAssignees.length > 0
                          ? selectedWorkItemAssignees.join(", ")
                          : "Chọn người phụ trách"}
                      </span>
                      <ChevronDown size={15} />
                    </button>
                    {isAssigneeMenuOpen && (
                      <div className="workitem-assignee-menu">
                        {workItemAssigneeOptions.map((member) => {
                          const checked = workItemDraft.assigneeIds.includes(member.id) || selectedWorkItemAssignees.includes(member.name);
                          return (
                            <label className="workitem-assignee-option" key={member.email || member.id || member.name}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleWorkItemAssignee(member)}
                              />
                              <span>
                                <strong>{member.name}</strong>
                                <small>
                                  {member.email}
                                  {!isProjectAssigneeOption(member) ? " · Quyền tài liệu" : ""}
                                </small>
                              </span>
                            </label>
                          );
                        })}
                        {workItemAssigneeOptions.length === 0 && (
                          <div className="workitem-assignee-empty">Dự án chưa có thành viên có thể gán.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label style={{ fontSize: "0.72rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <FileText size={13} /> Mô tả công việc
                </label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={workItemDraft.description}
                  onChange={(event) => setWorkItemDraft({ ...workItemDraft, description: event.target.value })}
                  placeholder="Mô tả chi tiết nội dung cần xử lý..."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label><Tags size={13} /> Labels</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={workItemDraft.labelsText}
                    onChange={(event) => setWorkItemDraft({ ...workItemDraft, labelsText: event.target.value })}
                    placeholder="Frontend, API, UAT..."
                  />
                </div>
                <div className="form-group">
                  <label><CheckCheck size={13} /> Checklist</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={workItemDraft.checklistText}
                    onChange={(event) => setWorkItemDraft({ ...workItemDraft, checklistText: event.target.value })}
                    placeholder="[ ] Việc cần làm&#10;[x] Việc đã xong"
                  />
                </div>
              </div>

              {/* Attachments Section Box */}
              <div className="workitem-attachments-box">
                <label style={{ fontSize: "0.72rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6 }}>
                  <Paperclip size={13} /> Ảnh / Video đính kèm
                </label>
                <div className="workitem-upload-row" style={{ margin: 0 }}>
                  <label className={`workitem-upload-btn ${isUploadingWorkItemAttachment ? "disabled" : ""}`}>
                    <UploadCloud size={14} />
                    {isUploadingWorkItemAttachment ? "Đang upload..." : "Upload tệp đính kèm"}
                    <input
                      type="file"
                      accept="image/*,video/mp4,video/webm,video/quicktime"
                      disabled={isUploadingWorkItemAttachment}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        void handleUploadDraftWorkItemAttachment(file);
                      }}
                    />
                  </label>
                  <small style={{ color: "#64748b", fontSize: "0.72rem" }}>URL sau khi upload sẽ tự động chèn bên dưới.</small>
                </div>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={workItemDraft.attachmentsText}
                  onChange={(event) => setWorkItemDraft({ ...workItemDraft, attachmentsText: event.target.value })}
                  placeholder="Dán URL ảnh hoặc video, mỗi dòng một file..."
                />
                <small className="field-helper" style={{ color: "#94a3b8", fontSize: "0.7rem", margin: 0 }}>Hỗ trợ preview ảnh (.png, .jpg, .webp) và video (.mp4, .webm, .mov).</small>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" type="button" disabled={isSavingWorkItem} onClick={() => {
                setIsAssigneeMenuOpen(false);
                setIsWorkItemModalOpen(false);
              }}>
                Hủy
              </button>
              <button className="btn-primary" type="button" disabled={isSavingWorkItem} onClick={() => void handleSaveWorkItem()}>
                {isSavingWorkItem ? (
                  <>
                    <Loader2 className="spin-icon" size={15} /> {workItemDraft.id ? "Đang cập nhật..." : "Đang lưu..."}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} /> {workItemDraft.id ? "Cập nhật ticket" : "Lưu ticket"}
                  </>
                )}
              </button>
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
            initialScope={shareInitialScope}
            documentId={selectedDocument.id}
            documentTitle={selectedDocument.title}
            projectId={selectedProject.id}
            projectTitle={selectedProject.name}
            onClose={() => setIsShareModalOpen(false)}
            onAccessChanged={handleShareAccessChanged}
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
