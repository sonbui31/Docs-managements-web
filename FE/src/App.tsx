import {
  AlertTriangle,
  Archive,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Eye,
  File,
  FileCheck2,
  FileCode,
  FilePlus,
  FileText,
  FolderKanban,
  FolderPlus,
  Layers,
  ListTree,
  LogOut,
  Maximize2,
  MessageSquarePlus,
  MessageSquareText,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  Pencil,
  Search,
  Send,
  Share2,
  Sparkles,
  Trash2,
  UploadCloud,
  UserCheck,
  Users,
  X
} from "lucide-react";
import mermaid from "mermaid";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createComment,
  createDocument,
  createProject,
  downloadExport,
  fetchComments,
  fetchDocumentsByProject,
  fetchProjects,
  importDocument
} from "./api";
import { AdminPanel } from "./AdminPanel";
import { AuthPage } from "./AuthPage";
import { fetchCurrentUser, getStoredUser, logout } from "./authApi";
import { initialComments, documents as initialDocuments, projects as initialProjects } from "./data";
import { SessionsModal } from "./SessionsModal";
import type { CommentThread, DocumentStatus, Project, ProjectDocument, ToastMessage, User } from "./types";


// Initialize Mermaid Diagram Engine with a clean, high-contrast, white-background theme
mermaid.initialize({
  startOnLoad: false,
  theme: "base",
  securityLevel: "loose",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  themeVariables: {
    primaryColor: "#ffffff",
    primaryTextColor: "#0f172a",
    primaryBorderColor: "#4f46e5",
    lineColor: "#4f46e5",
    secondaryColor: "#f8fafc",
    tertiaryColor: "#f1f5f9",
    nodeBorder: "#4f46e5",
    clusterBkg: "#ffffff",
    clusterBorder: "#cbd5e1",
    defaultLinkColor: "#4f46e5",
    titleColor: "#0f172a",
    edgeLabelBackground: "#ffffff",
    nodeTextColor: "#0f172a",
    fontSize: "14px"
  }
});

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
        <td><span class="status-pill approved"><span class="status-dot"></span>Approved</span></td>
      </tr>
      <tr>
        <td><code>REQ-002</code></td>
        <td>Import & Xem File</td>
        <td>Đọc và hiển thị nội dung tệp Markdown/Word/PDF.</td>
        <td><span class="badge high">Cao</span></td>
        <td><span class="status-pill approved"><span class="status-dot"></span>Approved</span></td>
      </tr>
      <tr>
        <td><code>REQ-003</code></td>
        <td>Bảng Ma Trận Động</td>
        <td>Hiển thị sắc nét các dòng, cột và dữ liệu bảng kiểm thử.</td>
        <td><span class="badge high">Cao</span></td>
        <td><span class="status-pill review"><span class="status-dot"></span>In Review</span></td>
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
      F --> G[✅ Phê Duyệt & Lưu Kho Approved]

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
  contentHtml: `<h3>Chưa có tài liệu trong dự án</h3><p>Hãy tạo tài liệu mới hoặc import file .md, .docx, .pdf để xem nội dung HTML tại đây.</p>`
};

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

  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectsList[0].id);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>(documentsList[0].id);
  const [activeTabNav, setActiveTabNav] = useState<"projects" | "review" | "vault" | "admin">("projects");
  const [statusFilter, setStatusFilter] = useState<"All" | DocumentStatus>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Metric Scope Switcher State ("project" vs "document")
  const [metricScope, setMetricScope] = useState<"project" | "document">("project");
  // Show / Hide top metrics strip (default hidden for clean reading focus)
  const [showMetrics, setShowMetrics] = useState<boolean>(false);

  // Layout View Controls for Maximum Reading Focus
  const [showLibraryPanel, setShowLibraryPanel] = useState<boolean>(true);
  const [showCommentsPanel, setShowCommentsPanel] = useState<boolean>(true);
  const [fontSize, setFontSize] = useState<"sm" | "md" | "lg">("md");
  const [isZenMode, setIsZenMode] = useState<boolean>(false);

  // Left Panel Tab Mode ("docs" vs "toc")
  const [leftPanelMode, setLeftPanelMode] = useState<"docs" | "toc">("docs");
  // Interactive Table of Contents (Outline) State
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [activeTocId, setActiveTocId] = useState<string>("");
  const [isTocPopoverOpen, setIsTocPopoverOpen] = useState<boolean>(false);

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
  const [isSelectionComposerOpen, setIsSelectionComposerOpen] = useState<boolean>(false);

  // Comments state
  const [commentsList, setCommentsList] = useState<CommentThread[]>(initialComments);
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
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Create Project Modal state
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState<boolean>(false);
  const [newProjCode, setNewProjCode] = useState<string>("");
  const [newProjName, setNewProjName] = useState<string>("");
  const [newProjClient, setNewProjClient] = useState<string>("");

  // Edit Project Modal state
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjCode, setEditProjCode] = useState<string>("");
  const [editProjName, setEditProjName] = useState<string>("");
  const [editProjClient, setEditProjClient] = useState<string>("");

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

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);

  // Update importTargetProjectId when selectedProjectId changes
  useEffect(() => {
    setImportTargetProjectId(selectedProjectId);
    setNewDocProjectId(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    void loadWorkspaceFromBackend();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    void fetchCurrentUser()
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    if (!isBackendConnected || !selectedDocumentId || selectedDocumentId === "empty-document") return;
    setSelectedCommentTarget(null);
    setActiveBlockId(null);
    void loadCommentsForDocument(selectedDocumentId);
  }, [isBackendConnected, selectedDocumentId]);

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
      setSelectedProjectId(finalProjectId);
      setSelectedDocumentId(firstDocument?.id ?? "empty-document");
      setIsBackendConnected(true);
    } catch (error) {
      console.error("Cannot load backend workspace:", error);
      setIsBackendConnected(false);
      addToast("warning", "Đang dùng dữ liệu mẫu", "FE chưa gọi được BE. Kiểm tra Nest server ở port 3000.");
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
    } catch (error) {
      console.error("Cannot load comments:", error);
    }
  }

  function handleDocumentSelection() {
    const selection = window.getSelection();
    const selectedText = selection?.toString().replace(/\s+/g, " ").trim() ?? "";

    if (!selection || selectedText.length < 2 || !documentContainerRef.current) return;

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

    const range = selection.getRangeAt(0);
    const sourceElement =
      closestReadableElement(range.commonAncestorContainer) ??
      closestReadableElement(anchorNode);
    const explicitReq = sourceElement?.closest<HTMLElement>("[data-req], [data-block-id]");
    const blockId =
      explicitReq?.dataset.req ??
      explicitReq?.dataset.blockId ??
      `SEL-${Math.abs(hashText(selectedText)).toString().slice(0, 6)}`;
    const rect = range.getBoundingClientRect();
    const fallbackRect = range.getClientRects()[0];
    const targetRect = rect.width || rect.height ? rect : fallbackRect;

    setSelectedCommentTarget({
      blockId,
      selectedText: selectedText.slice(0, 1000)
    });
    setIsSelectionComposerOpen(false);
    if (targetRect) {
      setSelectionPopover({
        top: Math.max(72, targetRect.top - 46),
        left: Math.min(window.innerWidth - 56, Math.max(16, targetRect.left + targetRect.width / 2 - 18))
      });
    }
    setActiveBlockId(blockId);
    setShowCommentsPanel(true);
  }

  function clearSelectedCommentTarget() {
    setSelectedCommentTarget(null);
    setSelectionPopover(null);
    setIsSelectionComposerOpen(false);
    setActiveBlockId(null);
    window.getSelection()?.removeAllRanges();
    clearActiveCommentHighlight();
  }

  function closestReadableElement(node: Node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    return element?.closest<HTMLElement>("p, li, td, th, blockquote, h1, h2, h3, h4, .req-block, pre");
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

  function handleCommentCardClick(comment: CommentThread) {
    if (!comment.selectedText) return;
    setSelectedCommentTarget(null);
    setSelectionPopover(null);
    setIsSelectionComposerOpen(false);
    setActiveBlockId(comment.blockId);
    window.setTimeout(() => highlightCommentText(comment.selectedText!), 80);
  }

  function clearActiveCommentHighlight() {
    if (!documentContainerRef.current) return;
    const marks = Array.from(
      documentContainerRef.current.querySelectorAll<HTMLElement>(".active-comment-highlight")
    );
    marks.forEach((mark) => {
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

  function highlightCommentText(selectedText: string) {
    if (!documentContainerRef.current) return;
    clearActiveCommentHighlight();

    const target = selectedText.replace(/\s+/g, " ").trim();
    if (!target) return;

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
        fallbackElement.scrollIntoView({ behavior: "smooth", block: "center" });
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
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function findCommentBlockElement(target: string) {
    if (!documentContainerRef.current) return null;
    const normalizedTarget = target.replace(/\s+/g, " ").trim().toLowerCase();
    const candidates = Array.from(
      documentContainerRef.current.querySelectorAll<HTMLElement>(
        "p, li, td, th, blockquote, h1, h2, h3, h4, .req-block"
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
    if (activeTabNav === "vault") {
      return documentsList.filter((doc) => doc.status === "Approved");
    }
    if (activeTabNav === "review") {
      return documentsList.filter((doc) => doc.status === "In Review" || doc.status === "Draft");
    }
    return documentsList.filter((doc) => doc.projectId === selectedProjectId);
  }, [documentsList, selectedProjectId, activeTabNav]);

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

  const selectedDocument = useMemo(
    () => documentsList.find((doc) => doc.id === selectedDocumentId) ?? projectDocuments[0] ?? documentsList[0] ?? EMPTY_DOCUMENT,
    [documentsList, selectedDocumentId, projectDocuments]
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
      .map((comment) => ({
        ...comment,
        replies: repliesByParent.get(comment.id) ?? []
      }));
  }, [commentsList, selectedDocument]);

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
    if (!newProjName.trim() || !newProjCode.trim()) {
      addToast("warning", "Thiếu thông tin", "Vui lòng nhập Mã và Tên dự án.");
      return;
    }
    try {
      const newProj = await createProject({
        code: newProjCode.trim().toUpperCase(),
        name: newProjName.trim(),
        client: newProjClient.trim() || "Internal Team"
      });
      setProjectsList((prev) => [...prev, newProj]);
      setSelectedProjectId(newProj.id);
      setSelectedDocumentId("empty-document");
      setActiveTabNav("projects");
      setNewProjCode("");
      setNewProjName("");
      setNewProjClient("");
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
    setEditingProject(proj);
    setEditProjCode(proj.code);
    setEditProjName(proj.name);
    setEditProjClient(proj.client);
    setIsEditProjectModalOpen(true);
  }

  // Save Edit Project Handler
  function handleSaveEditProject() {
    if (!editingProject) return;
    if (!editProjName.trim() || !editProjCode.trim()) {
      addToast("warning", "Thiếu thông tin", "Vui lòng nhập Mã và Tên dự án.");
      return;
    }

    setProjectsList((prev) =>
      prev.map((p) =>
        p.id === editingProject.id
          ? { ...p, code: editProjCode.trim().toUpperCase(), name: editProjName.trim(), client: editProjClient.trim() }
          : p
      )
    );
    setIsEditProjectModalOpen(false);
    setEditingProject(null);
    addToast("success", "Đã cập nhật dự án", `Dự án "${editProjName}" đã lưu thay đổi.`);
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
  function handleDeleteProject(projectId: string) {
    const projToDelete = projectsList.find((p) => p.id === projectId);
    const updatedProjects = projectsList.filter((p) => p.id !== projectId);
    setProjectsList(updatedProjects);
    setDocumentsList((prev) => prev.filter((d) => d.projectId !== projectId));

    if (selectedProjectId === projectId) {
      const nextProj = updatedProjects[0];
      setSelectedProjectId(nextProj.id);
      const nextDoc = documentsList.find((d) => d.projectId === nextProj.id);
      if (nextDoc) setSelectedDocumentId(nextDoc.id);
    }

    addToast("info", "Đã xóa dự án", `Dự án "${projToDelete?.name || projectId}" và các tài liệu liên quan đã bị xóa.`);
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
  function handleSaveEditDocument() {
    if (!editingDoc) return;
    if (!editDocTitle.trim()) {
      addToast("warning", "Thiếu tiêu đề", "Vui lòng nhập tên/tiêu đề tài liệu.");
      return;
    }

    setDocumentsList((prev) =>
      prev.map((d) =>
        d.id === editingDoc.id
          ? {
            ...d,
            title: editDocTitle.trim(),
            type: editDocType,
            owner: editDocOwner.trim(),
            status: editDocStatus,
            version: editDocVersion.trim(),
            updatedAt: "Vừa sửa"
          }
          : d
      )
    );

    setIsEditDocModalOpen(false);
    setEditingDoc(null);
    addToast("success", "Đã cập nhật thuộc tính tài liệu", `Tài liệu "${editDocTitle}" đã lưu các thay đổi.`);
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
  function handleDeleteDocument(documentId: string) {
    const docToDelete = documentsList.find((d) => d.id === documentId);
    const updatedDocs = documentsList.filter((d) => d.id !== documentId);
    setDocumentsList(updatedDocs);

    if (selectedDocumentId === documentId) {
      const nextDoc = updatedDocs.find((d) => d.projectId === selectedProjectId) || updatedDocs[0];
      if (nextDoc) setSelectedDocumentId(nextDoc.id);
    }

    addToast("info", "Đã xóa tài liệu", `Tài liệu "${docToDelete?.title || documentId}" đã được xóa.`);
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
  function handleDeleteComment(commentId: string) {
    setCommentsList((prev) => prev.filter((c) => c.id !== commentId && c.parentId !== commentId));
    addToast("info", "Đã xóa nhận xét", "Ghi chú nhận xét đã được xóa thành công.");
  }

  // Execute Confirmed Delete Handler
  function executeConfirmDelete() {
    const { type, id } = confirmDeleteModal;
    if (!id) return;

    if (type === "project") {
      handleDeleteProject(id);
    } else if (type === "document") {
      handleDeleteDocument(id);
    } else if (type === "comment") {
      handleDeleteComment(id);
    }

    setConfirmDeleteModal({ isOpen: false, type: null, id: null, title: "", message: "" });
  }

  // Handle File Import with REAL text reading for pure document viewing & commenting
  async function handleImport(file?: File) {
    if (!file) return;
    setIsImporting(true);
    const targetProject = projectsList.find((p) => p.id === importTargetProjectId) || selectedProject;

    try {
      const importedDoc = await importDocument(file, targetProject.id);

      setDocumentsList((prev) => [importedDoc, ...prev]);
      setProjectsList((prev) =>
        prev.map((p) => (p.id === targetProject.id ? { ...p, documents: p.documents + 1 } : p))
      );

      setSelectedProjectId(targetProject.id);
      setSelectedDocumentId(importedDoc.id);
      setIsImportModalOpen(false);

      addToast("success", "Import file thành công!", `BE đã chuyển "${file.name}" sang HTML và lưu vào Neon.`);
    } catch (error) {
      console.error("Import file error:", error);
      addToast("error", "Import thất bại", "BE chưa nhận được file hoặc định dạng chưa được hỗ trợ.");
    } finally {
      setIsImporting(false);
    }
  }

  // Edit Comment Handler
  function handleSaveEditComment(commentId: string) {
    if (!editingCommentText.trim()) return;
    setCommentsList((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, text: editingCommentText.trim() } : c))
    );
    setEditingCommentId(null);
    setEditingCommentText("");
    addToast("success", "Đã cập nhật nhận xét", "Nội dung nhận xét đã được lưu thay đổi.");
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
        content: newCommentText.trim(),
        createdBy: "BA User"
      });
      setCommentsList((prev) => [newComment, ...prev]);
      setNewCommentText("");
      setSelectedCommentTarget(null);
      setSelectionPopover(null);
      setIsSelectionComposerOpen(false);
      window.getSelection()?.removeAllRanges();
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
        content: replyText.trim(),
        createdBy: "BA User"
      });
      setCommentsList((prev) => [newReply, ...prev]);
      setReplyText("");
      setReplyingCommentId(null);
      addToast("success", "Đã trả lời nhận xét", "Reply đã được lưu vào thread.");
    } catch (error) {
      console.error("Create reply error:", error);
      addToast("error", "Không gửi được reply", "Kiểm tra BE hoặc thử lại sau.");
    }
  }

  // Keyboard shortcut listener (⌘K for search, ESC to exit Zen mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("main-search")?.focus();
      }
      if (e.key === "Escape" || e.key === "Esc") {
        setIsZenMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const documentContainerRef = useRef<HTMLDivElement>(null);
  const inlineCommentTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let timer = 0;
    const scheduleSelectionCheck = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(handleDocumentSelection, 90);
    };

    document.addEventListener("selectionchange", scheduleSelectionCheck);
    document.addEventListener("mouseup", scheduleSelectionCheck);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("selectionchange", scheduleSelectionCheck);
      document.removeEventListener("mouseup", scheduleSelectionCheck);
    };
  }, [selectedDocument.id]);

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

      if (seen.has(container) || container.getAttribute("data-mermaid-done") === "true") return;

      const textSource = codeNode ?? node;
      const cleanCode = normalizeMermaidCode(textSource.textContent || textSource.innerText || "");
      const className = `${node.className} ${codeNode?.className ?? ""}`;

      if (isMermaidDiagram(cleanCode, className)) {
        seen.add(container);
        targetList.push({ container, code: cleanCode });
      }
    });

    if (targetList.length === 0) return;

    targetList.forEach(({ container, code }, index) => {
      const id = `mermaid-svg-${Date.now()}-${index}-${Math.floor(Math.random() * 10000)}`;
      void mermaid
        .render(id, code)
        .then(({ svg }) => {
          container.innerHTML = svg;
          container.className = "mermaid-container";
          container.setAttribute("data-mermaid-done", "true");
        })
        .catch((err) => {
          console.error("Mermaid rendering failed:", err, code);
          container.className = "mermaid-error";
          container.innerHTML = `<strong>Không render được sơ đồ Mermaid.</strong><pre>${escapeHtml(code)}</pre>`;
          container.setAttribute("data-mermaid-done", "true");
          const errEl = document.getElementById(`d${id}`);
          if (errEl) errEl.remove();
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

  // Extract document headings (h1, h2, h3, h4) to generate Table of Contents (TOC)
  useEffect(() => {
    let isSubscribed = true;

    const parseHeadings = () => {
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

    parseHeadings();
    const timer = window.setTimeout(parseHeadings, 300);

    return () => {
      isSubscribed = false;
      window.clearTimeout(timer);
    };
  }, [selectedDocument.id, selectedDocument.contentHtml]);

  // Smooth scroll and focus target heading in reader
  const scrollToHeading = (item: TocItem) => {
    setActiveTocId(item.id);
    setIsTocPopoverOpen(false);

    if (!documentContainerRef.current) return;
    const container = documentContainerRef.current;
    const headings = container.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5");

    let targetHeading: HTMLElement | null = headings[item.index] || document.getElementById(item.id);

    if (!targetHeading && item.text) {
      headings.forEach((h) => {
        if (h.textContent?.trim() === item.text) {
          targetHeading = h;
        }
      });
    }

    if (targetHeading) {
      targetHeading.setAttribute("id", item.id);
      const docPage = (targetHeading.closest(".doc-page") || container.closest(".doc-page")) as HTMLElement | null;

      if (docPage) {
        const elTop = targetHeading.getBoundingClientRect().top;
        const docPageTop = docPage.getBoundingClientRect().top;
        const targetScrollTop = docPage.scrollTop + (elTop - docPageTop) - 24;

        docPage.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: "smooth"
        });
      } else {
        targetHeading.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      targetHeading.classList.remove("heading-focus-pulse");
      void targetHeading.offsetWidth;
      targetHeading.classList.add("heading-focus-pulse");

      setTimeout(() => {
        targetHeading?.classList.remove("heading-focus-pulse");
      }, 2500);
    }
  };

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
    return commentsList.filter((c) => c.status === "open").length;
  }, [commentsList]);

  const approvedDocsTotalCount = useMemo(() => {
    return documentsList.filter((d) => d.status === "Approved").length;
  }, [documentsList]);

  const docOpenCommentsCount = useMemo(() => {
    return commentsList.filter((c) => (c.documentId === selectedDocument.id || c.documentId === "d-brd") && c.status === "open").length;
  }, [commentsList, selectedDocument]);

  // Compute grid layout class name
  const gridLayoutClass = useMemo(() => {
    let base = "work-grid";
    if (isZenMode) base += " zen-mode";
    if (!showLibraryPanel && !showCommentsPanel) return `${base} hide-both`;
    if (!showLibraryPanel) return `${base} hide-library`;
    if (!showCommentsPanel) return `${base} hide-comments`;
    return base;
  }, [isZenMode, showLibraryPanel, showCommentsPanel]);

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
    <main className={isZenMode ? "app-shell zen-mode" : "app-shell"}>

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="BA DocControl" className="sidebar-logo-img" />
          <div className="brand-info">
            <strong>BA DocControl</strong>
            <small>Quản Lý Tài Liệu BA</small>
          </div>
        </div>

        <div>
          <div className="nav-section-title">Danh mục</div>
          <nav className="nav-list" aria-label="Project navigation">
            <button
              className={activeTabNav === "projects" ? "nav-item active" : "nav-item"}
              type="button"
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
              onClick={() => setActiveTabNav("review")}
            >
              <div className="nav-item-content">
                <MessageSquareText size={17} />
                <span>Ghi chú & Review</span>
              </div>
              <span className="nav-badge">{openCommentsTotalCount}</span>
            </button>

            <button
              className={activeTabNav === "vault" ? "nav-item active" : "nav-item"}
              type="button"
              onClick={() => setActiveTabNav("vault")}
            >
              <div className="nav-item-content">
                <Archive size={17} />
                <span>Kho Approved</span>
              </div>
              <span className="nav-badge">{approvedDocsTotalCount}</span>
            </button>

            {currentUser.role === "ADMIN" && (
              <button
                className={activeTabNav === "admin" ? "nav-item active" : "nav-item"}
                type="button"
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

        <div>
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
            {projectsList.map((project) => (
              <button
                key={project.id}
                className={project.id === selectedProjectId && activeTabNav === "projects" ? "project-card selected" : "project-card"}
                type="button"
                onClick={() => handleSelectProject(project.id)}
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
                  <span style={{ color: project.openComments > 0 ? "var(--accent-amber)" : "var(--text-muted)" }}>
                    {project.openComments} trao đổi
                  </span>
                </div>
              </button>
            ))}
          </section>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile">
            <img
              src={currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
              alt={currentUser.name}
              style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: "1.5px solid var(--accent-primary)" }}
            />
            <div className="user-info">
              <strong>{currentUser.name}</strong>
              <small style={{ color: "var(--accent-primary)", fontWeight: 500 }}>
                {currentUser.role === "ADMIN" ? "Admin" : currentUser.role === "MANAGER" ? "Manager" : "Nhân viên"}
              </small>
            </div>
            <button
              type="button"
              className="logout-icon-btn"
              title="Phiên đăng nhập"
              onClick={() => setIsSessionsModalOpen(true)}
            >
              <UserCheck size={16} />
            </button>
            <button
              type="button"
              className="logout-icon-btn"
              title="Đăng xuất khỏi tài khoản"
              onClick={() => {
                void logout();
                setCurrentUser(null);
                addToast("info", "Đã đăng xuất", "Hẹn gặp lại bạn!");
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

      </aside>

      {/* Main Workspace */}
      <section className="workspace">
        {/* Compact Topbar Header */}
        <header className="topbar">
          <div className="topbar-title-area">
            <p className="eyebrow">
              {activeTabNav === "admin"
                ? "Quản trị hệ thống • Users & Permissions"
                : activeTabNav === "vault"
                ? "Tài Liệu Đã Duyệt • Approved Vault"
                : activeTabNav === "review"
                  ? "Hàng chờ Kiểm duyệt • Ghi chú & Review"
                  : `${selectedProject.code} / ${selectedProject.client}`}
            </p>
            <h1>
              {activeTabNav === "admin"
                ? "Quản Lý User & Phân Quyền"
                : activeTabNav === "vault"
                ? "Kho Tài Liệu Approved"
                : activeTabNav === "review"
                  ? "Hàng Chờ Đánh Giá & Ghi Chú"
                  : selectedProject.name}
            </h1>
          </div>

          {activeTabNav !== "admin" && (
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={15} />
              <input
                id="main-search"
                placeholder="Tìm tài liệu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="kbd-shortcut">⌘K</span>
            </label>





            {/* Toggle Metrics Strip Button */}
            <button
              className={showMetrics ? "icon-btn active" : "icon-btn"}
              type="button"
              title="Ẩn / Hiện thanh thông số dự án"
              onClick={() => setShowMetrics(!showMetrics)}
            >
              <BarChart2 size={15} />
              <span>Chỉ số</span>
              {showMetrics ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

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

        {/* Collapsible Dashboard Control Strip */}
        {showMetrics && activeTabNav !== "admin" && (
          <section className="control-strip-wrapper">
            <div className="control-strip-header">
              <div className="metric-scope-switcher">
                <button
                  className={metricScope === "project" ? "scope-tab-btn active" : "scope-tab-btn"}
                  type="button"
                  onClick={() => setMetricScope("project")}
                >
                  <Layers size={13} /> Theo Dự Án ({selectedProject.code})
                </button>
                <button
                  className={metricScope === "document" ? "scope-tab-btn active" : "scope-tab-btn"}
                  type="button"
                  onClick={() => setMetricScope("document")}
                >
                  <File size={13} /> Theo Tài Liệu Đang Chọn ({selectedDocument.type})
                </button>
              </div>
              <span className="scope-badge">
                {metricScope === "project" ? `Dự án: ${selectedProject.name}` : `Tài liệu: ${selectedDocument.title}`}
              </span>
            </div>

            <div className="control-strip" aria-label="Project metrics">
              {/* Metric Card 1 */}
              <div className="metric-card emerald">
                <div className="metric-header">
                  <small>{metricScope === "project" ? "Tiến độ Dự Án" : "Tiến độ Tài Liệu"}</small>
                  <CheckCircle2 size={16} color="var(--accent-emerald)" />
                </div>
                <div className="metric-value">
                  {metricScope === "project" ? `${selectedProject.progress}%` : `${selectedDocument.progress ?? 75}%`}
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: metricScope === "project" ? `${selectedProject.progress}%` : `${selectedDocument.progress ?? 75}%`
                    }}
                  />
                </div>
              </div>

              {/* Metric Card 2 */}
              <div className="metric-card">
                <div className="metric-header">
                  <small>{metricScope === "project" ? "Tài Liệu Dự Án" : "Số Yêu Cầu (REQ)"}</small>
                  <FileCheck2 size={16} color="var(--accent-cyan)" />
                </div>
                <div className="metric-value">
                  {metricScope === "project" ? projectDocuments.length : (selectedDocument.reqCount ?? 12)}
                </div>
                <small style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>
                  {metricScope === "project" ? "Thuộc phạm vi hiển thị" : `Phiên bản ${selectedDocument.version}`}
                </small>
              </div>

              {/* Metric Card 3 */}
              <div className="metric-card amber">
                <div className="metric-header">
                  <small>{metricScope === "project" ? "Thảo Luận Dự Án" : "Thảo Luận Tài Liệu"}</small>
                  <MessageSquareText size={16} color="var(--accent-amber)" />
                </div>
                <div className="metric-value">
                  {metricScope === "project" ? selectedProject.openComments : docOpenCommentsCount}
                </div>
                <small style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>
                  {metricScope === "project" ? "Tổng trao đổi trong dự án" : "Ghi chú cần giải đáp"}
                </small>
              </div>

              {/* Import Action Card */}
              <div className="import-card">
                <div className="import-card-text">
                  <strong>Import tệp vào dự án ({selectedProject.code})</strong>
                  <small>Chuyển đổi .md, .docx, .pdf sang chuẩn xem cho team</small>
                </div>
                <button
                  className="btn-import"
                  type="button"
                  onClick={() => {
                    setImportTargetProjectId(selectedProjectId);
                    setIsImportModalOpen(true);
                  }}
                >
                  <Sparkles size={15} /> Import ngay
                </button>
              </div>
            </div>
          </section>
        )}



        {activeTabNav === "admin" ? (
          <AdminPanel projects={projectsList} documents={documentsList} onToast={addToast} />
        ) : (
        <section className={gridLayoutClass}>
          {/* Panel 1: Document Library (Collapsible) */}
          {showLibraryPanel && (
            <div className="panel library">
              <div className="panel-header">
                <div className="panel-title">
                  <p className="eyebrow">
                    {activeTabNav === "vault"
                      ? "Kho Approved"
                      : activeTabNav === "review"
                        ? "Hàng chờ Review"
                        : `Thư viện • ${selectedProject.code}`}
                  </p>
                  <h2>Tài liệu ({filteredDocuments.length})</h2>
                </div>
                <div className="panel-action-group">
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

              {/* Panel Mode Switcher Tabs (Tài liệu vs Mục lục) */}
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
                  <ListTree size={12} /> Mục lục ({tocItems.length})
                </button>
              </div>

              {leftPanelMode === "docs" ? (
                <>
                  {/* Status Filter Tabs (Draft | In Review | Approved) */}
                  <div className="library-filter-tabs">
                    {(["All", "Draft", "In Review", "Approved"] as const).map((tab) => (
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
                      <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: "0.78rem" }}>
                        Không có tài liệu nào phù hợp.
                      </div>
                    ) : (
                      filteredDocuments.map((doc) => (
                        <button
                          key={doc.id}
                          className={doc.id === selectedDocumentId ? "document-row selected" : "document-row"}
                          type="button"
                          onClick={() => setSelectedDocumentId(doc.id)}
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
                            <strong>{doc.title}</strong>
                            <small>{doc.type} • {doc.owner}</small>
                          </div>
                          <div className="doc-status-col">
                            <span className="version-tag">{doc.version}</span>
                            <span className={`status-pill ${doc.status.toLowerCase().replace(" ", "")}`}>
                              <span className="status-dot" />
                              {doc.status}
                            </span>
                          </div>
                        </button>
                      ))
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
                          className={`toc-item level-${item.level} ${activeTocId === item.id ? "active" : ""}`}
                          onClick={() => scrollToHeading(item)}
                        >
                          <span className="toc-item-text">{item.text}</span>
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
                {!showLibraryPanel && !isZenMode && (
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
                {/* Document Metadata Edit & Delete Buttons */}
                <button
                  className="btn-secondary"
                  type="button"
                  title="Sửa thông tin thuộc tính tài liệu (Tên, Loại, Owner, Trạng thái)"
                  onClick={() => openEditDocumentModal(selectedDocument)}
                >
                  <Pencil size={14} /> Sửa tài liệu
                </button>
                <button
                  className="btn-secondary danger"
                  type="button"
                  title="Xóa tài liệu này"
                  onClick={() => requestDeleteDocument(selectedDocument.id)}
                >
                  <Trash2 size={14} /> Xóa
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    addToast("success", "Đã sao chép liên kết", "Team members có thể mở nhanh tài liệu này.");
                  }}
                >
                  <Share2 size={14} /> Chia sẻ
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => {
                    if (selectedDocument.id === "empty-document") return;
                    void downloadExport(selectedDocument.id, "pdf");
                  }}
                >
                  <Download size={14} /> Xuất PDF
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => {
                    if (selectedDocument.id === "empty-document") return;
                    void downloadExport(selectedDocument.id, "docx");
                  }}
                >
                  <Download size={14} /> Xuất Word
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
              {selectedCommentTarget && selectionPopover && !isSelectionComposerOpen && (
                <button
                  className="selection-comment-popover"
                  type="button"
                  title="Comment đoạn đã bôi đen"
                  style={{ top: selectionPopover.top, left: selectionPopover.left }}
                  onPointerDown={(event) => event.preventDefault()}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseUp={(event) => event.stopPropagation()}
                  onClick={focusSelectedCommentComposer}
                >
                  <MessageSquarePlus size={17} />
                </button>
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
          {showCommentsPanel && (
            <aside className="panel comments-panel">
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
              <div className="comments-list">
                {displayedComments.map((comment) => (
                  <div
                    key={comment.id}
                    className={comment.selectedText ? "comment-card clickable" : "comment-card"}
                    onClick={() => handleCommentCardClick(comment)}
                  >
                    <div className="comment-card-header">
                      <div className="comment-author-info">
                        <div className="author-avatar">{comment.author[0]}</div>
                        <div className="author-name">
                          <strong>{comment.author}</strong>
                          <small>{comment.authorRole || "Reviewer"}</small>
                        </div>
                      </div>
                      <span className="req-tag">{comment.blockId}</span>
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
                          <div key={reply.id} className="reply-card">
                            <div className="reply-meta">
                              <strong>{reply.author}</strong>
                              <span>{reply.createdAt}</span>
                            </div>
                            <p>{reply.text}</p>
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
                            <Send size={12} /> Gửi reply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </aside>
          )}
        </section>
        )}
      </section>

      {/* Modal 1: Create New Project */}
      {isCreateProjectModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateProjectModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tạo Dự Án Quản Lý Mới</h3>
              <button className="icon-btn" type="button" onClick={() => setIsCreateProjectModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Mã Dự Án (Project Code)</label>
                <input
                  className="form-input"
                  placeholder="Ví dụ: CRM-25, MOB-09..."
                  value={newProjCode}
                  onChange={(e) => setNewProjCode(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Tên Dự Án (Project Name)</label>
                <input
                  className="form-input"
                  placeholder="Ví dụ: E-Commerce Mobile App..."
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Khách Hàng / Khối Nghiệp Vụ (Client/Department)</label>
                <input
                  className="form-input"
                  placeholder="Ví dụ: Retail Banking, Operations..."
                  value={newProjClient}
                  onChange={(e) => setNewProjClient(e.target.value)}
                />
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
        </div>
      )}

      {/* Modal 2: Edit Existing Project */}
      {isEditProjectModalOpen && editingProject && (
        <div className="modal-backdrop" onClick={() => setIsEditProjectModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chỉnh Sửa Thông Tin Dự Án</h3>
              <button className="icon-btn" type="button" onClick={() => setIsEditProjectModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Mã Dự Án (Project Code)</label>
                <input
                  className="form-input"
                  value={editProjCode}
                  onChange={(e) => setEditProjCode(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Tên Dự Án (Project Name)</label>
                <input
                  className="form-input"
                  value={editProjName}
                  onChange={(e) => setEditProjName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Khách Hàng / Khối Nghiệp Vụ (Client)</label>
                <input
                  className="form-input"
                  value={editProjClient}
                  onChange={(e) => setEditProjClient(e.target.value)}
                />
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
        </div>
      )}

      {/* Modal 3: Create New Document */}
      {isCreateDocModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateDocModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tạo Tài Liệu Mới Cho Dự Án</h3>
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
        </div>
      )}

      {/* Modal 4: Edit Existing Document Metadata */}
      {isEditDocModalOpen && editingDoc && (
        <div className="modal-backdrop" onClick={() => setIsEditDocModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chỉnh Sửa Thuộc Tính Tài Liệu</h3>
              <button className="icon-btn" type="button" onClick={() => setIsEditDocModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Tên / Tiêu Đề Tài Liệu</label>
                <input
                  className="form-input"
                  value={editDocTitle}
                  onChange={(e) => setEditDocTitle(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Loại Tài Liệu</label>
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

                <div className="form-group">
                  <label>Trạng Thái Tài Liệu</label>
                  <select
                    className="form-select"
                    value={editDocStatus}
                    onChange={(e) => setEditDocStatus(e.target.value as DocumentStatus)}
                  >
                    <option value="Draft">Draft (Bản nháp)</option>
                    <option value="In Review">In Review (Đang đánh giá)</option>
                    <option value="Approved">Approved (Đã duyệt)</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Người Phụ Trách (Owner)</label>
                  <input
                    className="form-input"
                    value={editDocOwner}
                    onChange={(e) => setEditDocOwner(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Phiên Bản (Version)</label>
                  <input
                    className="form-input"
                    value={editDocVersion}
                    onChange={(e) => setEditDocVersion(e.target.value)}
                  />
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
        </div>
      )}

      {/* Modal 5: Confirmation Delete Popup Modal */}
      {confirmDeleteModal.isOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setConfirmDeleteModal({ isOpen: false, type: null, id: null, title: "", message: "" })}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
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
        <div className="modal-backdrop" onClick={() => setIsImportModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import tệp vào Dự Án</h3>
              <button
                className="icon-btn"
                type="button"
                onClick={() => setIsImportModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {/* Project Target Dropdown Selector */}
              <div className="form-group">
                <label style={{ fontWeight: 700, color: "var(--accent-primary)" }}>
                  🎯 Chọn Dự Án Đích để Import vào:
                </label>
                <select
                  className="form-select"
                  value={importTargetProjectId}
                  onChange={(e) => setImportTargetProjectId(e.target.value)}
                >
                  {projectsList.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      [{proj.code}] {proj.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Drag & Drop File Zone */}
              <label
                className={isDragOver ? "dropzone drag-over" : "dropzone"}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) void handleImport(file);
                }}
              >
                <input
                  type="file"
                  accept=".md,.docx,.pdf"
                  style={{ display: "none" }}
                  onChange={(e) => void handleImport(e.target.files?.[0])}
                />
                <div className="dropzone-icon">
                  <UploadCloud size={24} />
                </div>
                <div>
                  <strong style={{ fontSize: "0.95rem" }}>
                    {isImporting ? "Đang xử lý tệp & hiển thị tài liệu..." : "Kéo & thả tệp vào đây hoặc Click để chọn"}
                  </strong>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
                    Hỗ trợ định dạng `.md`, `.docx`, `.pdf`
                  </p>
                </div>
              </label>

              <div style={{ background: "var(--bg-surface)", padding: 12, borderRadius: 8, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                <strong>Quy trình:</strong> Tệp được chọn sẽ được tự động chuyển đổi sang giao diện đọc chuẩn để team xem và thảo luận comment trực tiếp.
              </div>
            </div>
          </div>
        </div>
      )}

      {isSessionsModalOpen && (
        <SessionsModal
          onClose={() => setIsSessionsModalOpen(false)}
          onLogoutAll={() => {
            setIsSessionsModalOpen(false);
            setCurrentUser(null);
            addToast("info", "Đã đăng xuất mọi thiết bị", "Tất cả phiên đăng nhập đã bị thu hồi.");
          }}
        />
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
