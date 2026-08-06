import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FileCode,
  FileText,
  Filter,
  FolderGit2,
  FolderKanban,
  Key,
  Lock,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X
} from "lucide-react";
import {
  assignUsersToDocuments,
  assignUsersToProjects,
  createUser,
  deleteUser,
  fetchUsers,
  type ManagedUser,
  removeUserFromDocument,
  removeUserFromProject,
  updateUser
} from "./authApi";
import type { Project, ProjectDocument, ProjectRole, User, UserRole, UserStatus } from "./types";

type Props = {
  projects: Project[];
  documents: ProjectDocument[];
  currentUser: User;
  onToast: (type: "success" | "info" | "warning" | "error", title: string, message: string) => void;
};

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Admin Quản trị",
  MANAGER: "Manager Quản lý",
  EMPLOYEE: "Nhân viên"
};

const statusLabels: Record<UserStatus, string> = {
  ACTIVE: "Hoạt động",
  DISABLED: "Vô hiệu hóa",
  LOCKED: "Tạm khóa"
};

const projectRoleLabels: Record<ProjectRole, { label: string; desc: string }> = {
  VIEWER: { label: "Viewer", desc: "Chỉ được xem tài liệu" },
  REVIEWER: { label: "Reviewer", desc: "Xem & để lại bình luận, góp ý" },
  EDITOR: { label: "Editor", desc: "Chỉnh sửa nội dung & yêu cầu" },
  MANAGER: { label: "Manager", desc: "Quản lý toàn bộ dự án" }
};

export interface MultiSelectItem {
  id: string;
  name: string;
  subtext?: string;
  badge?: string;
  badgeClass?: string;
}

export function SearchableMultiSelect({
  label,
  items,
  selectedIds,
  onChange,
  placeholder = "Tìm kiếm..."
}: {
  label: string;
  items: MultiSelectItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          (item.subtext && item.subtext.toLowerCase().includes(search.toLowerCase()))
      ),
    [items, search]
  );

  const toggleItem = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="form-group">
      <div className="label-with-action">
        <label>
          {label} <span className="selection-count">{selectedIds.length}</span>
        </label>
        <div className="quick-select-actions">
          <button type="button" onClick={() => onChange(items.map((i) => i.id))}>Tất cả</button>
          <span className="dot-divider">•</span>
          <button type="button" onClick={() => onChange([])}>Bỏ chọn</button>
        </div>
      </div>

      <div className="dropdown-select-container" ref={containerRef}>
        <div className={`dropdown-trigger-box ${isOpen ? "active" : ""}`} onClick={() => setIsOpen(!isOpen)}>
          <span className="trigger-text">
            {selectedIds.length === 0 ? placeholder : `Đã chọn ${selectedIds.length} mục trong danh sách`}
          </span>
          <ChevronDown size={16} className={`trigger-chevron ${isOpen ? "rotate" : ""}`} />
        </div>

        {isOpen && (
          <div className="dropdown-menu-panel">
            <div className="dropdown-search-header">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Gõ để tìm kiếm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {search && (
                <button type="button" className="clear-search-btn" onClick={() => setSearch("")}>
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="dropdown-options-container">
              {filteredItems.length === 0 ? (
                <div className="dropdown-no-results">Không tìm thấy kết quả phù hợp</div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`dropdown-option-item ${isSelected ? "selected" : ""}`}
                      onClick={() => toggleItem(item.id)}
                    >
                      <span className="option-check-box">
                        {isSelected && <Check size={11} />}
                      </span>
                      <div className="option-text-wrapper">
                        <span className="option-title">{item.name}</span>
                        {item.subtext && <span className="option-sub">{item.subtext}</span>}
                      </div>
                      {item.badge && (
                        <span className={`option-badge-pill ${item.badgeClass || ""}`}>{item.badge}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected Tag Chips Preview */}
      {selectedIds.length > 0 && (
        <div className="selected-chips-wrapper">
          {selectedIds.map((id) => {
            const item = items.find((i) => i.id === id);
            if (!item) return null;
            return (
              <span key={id} className="selected-tag-chip">
                <span className="chip-text">{item.name}</span>
                <button
                  type="button"
                  className="chip-remove"
                  onClick={() => onChange(selectedIds.filter((i) => i !== id))}
                  title="Gỡ bỏ"
                >
                  <X size={11} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminPanel({ projects, documents, currentUser, onToast }: Props) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const canManageAccounts = currentUser.role === "ADMIN";

  // Directory Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | UserStatus>("ALL");
  const [activeTab, setActiveTab] = useState<"users" | "projects" | "documents">("users");

  // Modal Visibility States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignProjectModal, setShowAssignProjectModal] = useState(false);
  const [showAssignDocModal, setShowAssignDocModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<ManagedUser | null>(null);

  // Form States - Create User
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>("EMPLOYEE");

  // Form States - Assign Project
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);
  const [assignProjectIds, setAssignProjectIds] = useState<string[]>(projects[0]?.id ? [projects[0].id] : []);
  const [assignRoles, setAssignRoles] = useState<ProjectRole[]>(["VIEWER"]);

  // Form States - Assign Document
  const [assignDocUserIds, setAssignDocUserIds] = useState<string[]>([]);
  const [assignDocIds, setAssignDocIds] = useState<string[]>(documents[0]?.id ? [documents[0].id] : []);
  const [assignDocRoles, setAssignDocRoles] = useState<ProjectRole[]>(["VIEWER"]);

  const assignableUsers = useMemo(() => users, [users]);

  const userSelectItems: MultiSelectItem[] = useMemo(
    () =>
      assignableUsers.map((u) => ({
        id: u.id,
        name: u.name,
        subtext: u.email,
        badge: u.role,
        badgeClass: `role-${u.role.toLowerCase()}`
      })),
    [assignableUsers]
  );

  const projectSelectItems: MultiSelectItem[] = useMemo(
    () =>
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        subtext: p.client || "Team Nội bộ",
        badge: p.code,
        badgeClass: "code-badge"
      })),
    [projects]
  );

  const documentSelectItems: MultiSelectItem[] = useMemo(
    () =>
      documents.map((d) => {
        const pCode = projects.find((p) => p.id === d.projectId)?.code ?? "DOC";
        return {
          id: d.id,
          name: `[${pCode}] ${d.title}`,
          subtext: `Phiên bản ${d.version}`,
          badge: d.type,
          badgeClass: "type-badge"
        };
      }),
    [documents, projects]
  );

  // Computed Statistics
  const totalUsers = users.length;
  const activeUsersCount = useMemo(() => users.filter((u) => u.status === "ACTIVE" || !u.status).length, [users]);
  const adminCount = useMemo(() => users.filter((u) => u.role === "ADMIN").length, [users]);
  const managerCount = useMemo(() => users.filter((u) => u.role === "MANAGER").length, [users]);
  const employeeCount = useMemo(() => users.filter((u) => u.role === "EMPLOYEE").length, [users]);

  const activePercent = totalUsers ? Math.round((activeUsersCount / totalUsers) * 100) : 0;
  const totalProjectAssignments = useMemo(() => users.reduce((acc, u) => acc + u.projects.length, 0), [users]);
  const totalDocAssignments = useMemo(() => users.reduce((acc, u) => acc + u.documents.length, 0), [users]);

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    setAssignProjectIds((current) => {
      const validIds = new Set(projects.map((project) => project.id));
      const kept = current.filter((id) => validIds.has(id));
      return kept.length ? kept : projects[0]?.id ? [projects[0].id] : [];
    });
  }, [projects]);

  useEffect(() => {
    setAssignDocIds((current) => {
      const validIds = new Set(documents.map((document) => document.id));
      const kept = current.filter((id) => validIds.has(id));
      return kept.length ? kept : documents[0]?.id ? [documents[0].id] : [];
    });
  }, [documents]);

  async function loadUsers(showToastOnError = false) {
    setLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data);
      const nonAdmin = data.find((u) => u.role !== "ADMIN")?.id || data[0]?.id || "";
      setAssignUserIds((current) => {
        const validIds = new Set(data.map((user) => user.id));
        const kept = current.filter((id) => validIds.has(id));
        return kept.length ? kept : nonAdmin ? [nonAdmin] : [];
      });
      setAssignDocUserIds((current) => {
        const validIds = new Set(data.map((user) => user.id));
        const kept = current.filter((id) => validIds.has(id));
        return kept.length ? kept : nonAdmin ? [nonAdmin] : [];
      });
    } catch (error: any) {
      console.error("Load users failed:", error);
      if (showToastOnError) {
        onToast("error", "Không tải được dữ liệu người dùng", error?.message || "Vui lòng kiểm tra kết nối API.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Filtered Users computation
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.projects.some(
          (p) => p.code.toLowerCase().includes(query) || p.name.toLowerCase().includes(query)
        ) ||
        user.documents.some(
          (d) => d.title.toLowerCase().includes(query) || d.projectCode.toLowerCase().includes(query)
        );

      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
      const userStatus = user.status ?? "ACTIVE";
      const matchesStatus = statusFilter === "ALL" || userStatus === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Generators & Helpers
  function generateRandomPassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
    setShowPassword(true);
  }

  function openQuickAssignProject(userId: string) {
    setAssignUserIds([userId]);
    setShowAssignProjectModal(true);
  }

  function openQuickAssignDocument(userId: string) {
    setAssignDocUserIds([userId]);
    setShowAssignDocModal(true);
  }

  function toggleId(selectedIds: string[], id: string, setSelectedIds: (ids: string[]) => void) {
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id]);
  }

  function toggleRole(selectedRoles: ProjectRole[], role: ProjectRole, setSelectedRoles: (roles: ProjectRole[]) => void) {
    setSelectedRoles(selectedRoles.includes(role) ? selectedRoles.filter((selectedRole) => selectedRole !== role) : [...selectedRoles, role]);
  }

  // API Handlers
  async function handleCreateUser() {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      onToast("warning", "Thiếu thông tin bắt buộc", "Vui lòng nhập họ tên, email và mật khẩu khởi tạo.");
      return;
    }

    try {
      await createUser({ name: newName.trim(), email: newEmail.trim(), password: newPassword, role: newRole });
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("EMPLOYEE");
      setShowCreateModal(false);
      await loadUsers();
      onToast("success", "Tạo tài khoản thành công", `Đã khởi tạo người dùng ${newName} với vai trò ${roleLabels[newRole]}.`);
    } catch (error: any) {
      console.error("Create user failed:", error);
      onToast("error", "Không tạo được tài khoản", error?.message || "Email có thể đã được sử dụng hoặc chưa hợp lệ.");
    }
  }

  async function handleUpdateUser(id: string, payload: Partial<{ role: UserRole; status: UserStatus }>) {
    try {
      await updateUser(id, payload);
      await loadUsers();
      onToast("success", "Cập nhật thành công", "Đã lưu thay đổi vai trò/trạng thái tài khoản.");
    } catch (error: any) {
      console.error("Update user failed:", error);
      onToast("error", "Cập nhật thất bại", error?.message || "Không thể hạ quyền Admin hệ thống.");
    }
  }

  async function handleDeleteUser(id: string) {
    try {
      await deleteUser(id);
      setDeletingUser(null);
      await loadUsers();
      onToast("info", "Đã khóa mềm tài khoản", "Tài khoản đã chuyển sang trạng thái Vô hiệu hóa.");
    } catch (error: any) {
      console.error("Delete user failed:", error);
      onToast("error", "Không xóa được tài khoản", error?.message || "Admin hệ thống không thể bị xóa.");
    }
  }

  async function handleAssignProject() {
    if (!assignUserIds.length || !assignProjectIds.length || !assignRoles.length) {
      onToast("warning", "Thiếu thông tin", "Vui lòng chọn người dùng, dự án và ít nhất một quyền hạn.");
      return;
    }

    try {
      const result = await assignUsersToProjects(assignUserIds, assignProjectIds, assignRoles);
      setShowAssignProjectModal(false);
      await loadUsers();
      onToast("success", "Đã phân quyền dự án", `Đã áp dụng ${result.assigned} lượt quyền trực tiếp trên dự án.`);
    } catch (error: any) {
      console.error("Assign project failed:", error);
      onToast("error", "Gán dự án thất bại", error?.message || "Vui lòng kiểm tra quyền quản lý.");
    }
  }

  async function handleRemoveProject(userId: string, projectId: string) {
    try {
      await removeUserFromProject(userId, projectId);
      await loadUsers();
      onToast("info", "Đã bỏ gán dự án", "Người dùng không còn quyền trực tiếp trên dự án này.");
    } catch (error: any) {
      console.error("Remove project failed:", error);
      onToast("error", "Bỏ gán thất bại", error?.message || "Vui lòng thử lại sau.");
    }
  }

  async function handleAssignDocument() {
    if (!assignDocUserIds.length || !assignDocIds.length || !assignDocRoles.length) {
      onToast("warning", "Thiếu thông tin", "Vui lòng chọn người dùng, tài liệu và ít nhất một quyền hạn.");
      return;
    }

    try {
      const result = await assignUsersToDocuments(assignDocUserIds, assignDocIds, assignDocRoles);
      setShowAssignDocModal(false);
      await loadUsers();
      onToast("success", "Đã phân quyền tài liệu", `Đã cập nhật ${result.assigned} lượt quyền riêng biệt trên tài liệu.`);
    } catch (error: any) {
      console.error("Assign document failed:", error);
      onToast("error", "Gán quyền tài liệu thất bại", error?.message || "Vui lòng kiểm tra dữ liệu tài liệu.");
    }
  }

  async function handleRemoveDocument(userId: string, documentId: string) {
    try {
      await removeUserFromDocument(userId, documentId);
      await loadUsers();
      onToast("info", "Đã bỏ quyền tài liệu", "Quyền tài liệu riêng biệt đã bị hủy.");
    } catch (error: any) {
      console.error("Remove document failed:", error);
      onToast("error", "Bỏ quyền thất bại", error?.message || "Vui lòng thử lại sau.");
    }
  }

  return (
    <div className="admin-dashboard">
      {/* Top Header Banner */}
      <header className="admin-header">
        <div className="admin-header-title">
          <div className="admin-header-icon-badge">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2>Quản lý Người dùng & Phân quyền</h2>
            <p>Quản trị tài khoản người dùng. Quyền dự án/tài liệu được chia sẻ trực tiếp từ nút Chia sẻ.</p>
          </div>
        </div>

        <div className="admin-header-actions">
          <button
            type="button"
            className="btn-admin-secondary"
            onClick={() => void loadUsers(true)}
            disabled={loading}
            title="Tải lại danh sách"
          >
            <RefreshCw size={16} className={loading ? "spin-icon" : ""} />
            <span>{loading ? "Đang tải..." : "Làm mới"}</span>
          </button>

          {canManageAccounts && (
            <button
              type="button"
              className="btn-admin-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <UserPlus size={16} />
              <span>+ Tạo Tài khoản</span>
            </button>
          )}
        </div>
      </header>

      {/* KPI Stats Overview Cards */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-title">TỔNG NGUỜI DÙNG</span>
            <div className="admin-stat-icon indigo">
              <Users size={18} />
            </div>
          </div>
          <div className="admin-stat-value">{totalUsers}</div>
          <div className="admin-stat-breakdown">
            <span className="stat-pill admin" title="Quản trị viên">{adminCount} Admin</span>
            <span className="stat-pill manager" title="Quản lý dự án">{managerCount} Mgr</span>
            <span className="stat-pill employee" title="Nhân viên">{employeeCount} NV</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-title">TRẠNG THÁI HOẠT ĐỘNG</span>
            <div className="admin-stat-icon emerald">
              <UserCheck size={18} />
            </div>
          </div>
          <div className="admin-stat-value">{activeUsersCount} <span className="stat-unit">/ {totalUsers}</span></div>
          <div className="admin-stat-footer">
            <span className="active-dot-pulse" />
            <span>{activePercent}% tài khoản đang khả dụng</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-title">PHÂN QUYỀN DỰ ÁN</span>
            <div className="admin-stat-icon cyan">
              <FolderGit2 size={18} />
            </div>
          </div>
          <div className="admin-stat-value">{projects.length} <span className="stat-unit">Dự án</span></div>
          <div className="admin-stat-footer text-muted">
            <span>{totalProjectAssignments} lượt gán trực tiếp</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-title">PHÂN QUYỀN TÀI LIỆU</span>
            <div className="admin-stat-icon amber">
              <FileText size={18} />
            </div>
          </div>
          <div className="admin-stat-value">{documents.length} <span className="stat-unit">Tài liệu</span></div>
          <div className="admin-stat-footer text-muted">
            <span>{totalDocAssignments} quy định quyền riêng biệt</span>
          </div>
        </div>
      </div>

      {/* View Tabs & Search Toolbar */}
      <div className="admin-control-bar">
        <div className="admin-tabs">
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            <Users size={16} />
            <span>Danh sách Người dùng</span>
            <span className="tab-count">{filteredUsers.length}</span>
          </button>
        </div>

        {/* Filter Controls (for Users tab) */}
        {activeTab === "users" && (
          <div className="admin-filters">
            <div className="admin-search-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Tìm tên, email, mã dự án..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button type="button" className="clear-search-btn" onClick={() => setSearchQuery("")}>
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="admin-filter-selects">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                title="Lọc theo Vai trò Hệ thống"
              >
                <option value="ALL">Tất cả Vai trò</option>
                <option value="ADMIN">Admin Quản trị</option>
                <option value="MANAGER">Manager Quản lý</option>
                <option value="EMPLOYEE">Nhân viên</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                title="Lọc theo Trạng thái"
              >
                <option value="ALL">Tất cả Trạng thái</option>
                <option value="ACTIVE">Hoạt động</option>
                <option value="DISABLED">Vô hiệu hóa</option>
                <option value="LOCKED">Khóa tạm</option>
              </select>

              {(searchQuery || roleFilter !== "ALL" || statusFilter !== "ALL") && (
                <button
                  type="button"
                  className="btn-reset-filters"
                  onClick={() => {
                    setSearchQuery("");
                    setRoleFilter("ALL");
                    setStatusFilter("ALL");
                  }}
                  title="Đặt lại bộ lọc"
                >
                  <X size={14} /> Bỏ lọc
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Tab Content */}
      <main className="admin-content">
        {/* TAB 1: USER DIRECTORY TABLE */}
        {activeTab === "users" && (
          <div className="admin-table-container">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>THÔNG TIN NGUỜI DÙNG</th>
                  <th>VAI TRÒ HỆ THỐNG</th>
                  <th>TRẠNG THÁI</th>
                  <th>DỰ ÁN & TÀI LIỆU ĐƯỢC GÁN</th>
                  <th className="text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const isSystemAdmin = user.role === "ADMIN";
                  const initial = user.name.trim().charAt(0).toUpperCase() || "U";
                  const currentStatus = user.status ?? "ACTIVE";

                  return (
                    <tr key={user.id} className={`user-row ${isSystemAdmin ? "is-admin" : ""}`}>
                      {/* User Info */}
                      <td className="col-user">
                        <div className="user-profile">
                          <div className={`user-avatar-circle role-${user.role.toLowerCase()}`}>
                            {initial}
                          </div>
                          <div className="user-details">
                            <div className="user-name-row">
                              <strong className="user-name">{user.name}</strong>
                              {isSystemAdmin && (
                                <span className="badge-system-admin" title="Admin Hệ thống có toàn quyền">
                                  <Shield size={12} /> Root Admin
                                </span>
                              )}
                            </div>
                            <span className="user-email">{user.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* System Role */}
                      <td className="col-role">
                        <div className="select-role-wrapper">
                          <select
                            value={user.role}
                            disabled={!canManageAccounts || isSystemAdmin}
                            className={`role-select role-${user.role.toLowerCase()}`}
                            onChange={(e) => void handleUpdateUser(user.id, { role: e.target.value as UserRole })}
                          >
                            {Object.entries(roleLabels).map(([val, lbl]) => (
                              <option key={val} value={val}>
                                {lbl}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="col-status">
                        <div className="select-status-wrapper">
                          <select
                            value={currentStatus}
                            disabled={!canManageAccounts || isSystemAdmin}
                            className={`status-select status-${currentStatus.toLowerCase()}`}
                            onChange={(e) => void handleUpdateUser(user.id, { status: e.target.value as UserStatus })}
                          >
                            {Object.entries(statusLabels).map(([val, lbl]) => (
                              <option key={val} value={val}>
                                {lbl}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Projects & Documents Assigned Chips */}
                      <td className="col-permissions">
                        <div className="permissions-chip-container">
                          {/* Projects chips */}
                          {user.projects.map((proj) => (
                            <div
                              key={proj.projectId}
                              className="chip-tag project-chip"
                              title={`Dự án: ${proj.name} (Role: ${proj.role})`}
                            >
                              <span className="chip-code">{proj.code}</span>
                              <span className="chip-role">{proj.role}</span>
                            </div>
                          ))}

                          {/* Documents chips */}
                          {user.documents.map((doc) => (
                            <div
                              key={doc.documentId}
                              className="chip-tag document-chip"
                              title={`Tài liệu: ${doc.title} (Role: ${doc.role})`}
                            >
                              <span className="chip-code">{doc.projectCode}/{doc.type}</span>
                              <span className="chip-role">{doc.role}</span>
                            </div>
                          ))}

                          {user.projects.length === 0 && user.documents.length === 0 && (
                            <span className="no-assignments-text">Chưa gán dự án/tài liệu</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="col-actions text-right">
                        <div className="action-buttons-group">
                          {canManageAccounts && (
                            <button
                              type="button"
                              className="btn-icon-action danger"
                              disabled={isSystemAdmin}
                              title={isSystemAdmin ? "Không thể xóa Root Admin" : "Khóa / Vô hiệu hóa tài khoản"}
                              onClick={() => setDeletingUser(user)}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!filteredUsers.length && (
                  <tr>
                    <td colSpan={5}>
                      <div className="admin-empty-state">
                        <UserX size={40} className="empty-icon" />
                        <h3>{loading ? "Đang tải dữ liệu người dùng..." : "Không tìm thấy người dùng phù hợp"}</h3>
                        <p>{searchQuery || roleFilter !== "ALL" || statusFilter !== "ALL" ? "Thử thay đổi từ khóa hoặc bộ lọc của bạn." : "Nhấn Nút '+ Tạo Tài khoản' để thêm người dùng đầu tiên."}</p>
                        {(searchQuery || roleFilter !== "ALL" || statusFilter !== "ALL") && (
                          <button
                            type="button"
                            className="btn-admin-secondary"
                            onClick={() => {
                              setSearchQuery("");
                              setRoleFilter("ALL");
                              setStatusFilter("ALL");
                            }}
                          >
                            Đặt lại tìm kiếm
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: PROJECT ACCESS MATRIX */}
        {activeTab === "projects" && (
          <div className="admin-matrix-grid">
            {projects.map((project) => {
              const assignedUsers = users.filter((u) => u.projects.some((p) => p.projectId === project.id));

              return (
                <div key={project.id} className="project-matrix-card">
                  <div className="matrix-card-header">
                    <div>
                      <span className="project-code-badge">{project.code}</span>
                      <h4 className="project-title">{project.name}</h4>
                      <small className="project-client">Khách hàng: {project.client}</small>
                    </div>
                    <button
                      type="button"
                      className="btn-mini-primary"
                      onClick={() => {
                        setAssignProjectIds([project.id]);
                        setShowAssignProjectModal(true);
                      }}
                    >
                      <Plus size={14} /> Gán User
                    </button>
                  </div>

                  <div className="matrix-card-body">
                    <div className="matrix-users-list">
                      {assignedUsers.map((user) => {
                        const projectPermission = user.projects.find((p) => p.projectId === project.id);
                        return (
                          <div key={user.id} className="matrix-user-item">
                            <div className="user-mini-info">
                              <div className="user-avatar-mini">{user.name.charAt(0).toUpperCase()}</div>
                              <div>
                                <span className="user-mini-name">{user.name}</span>
                                <span className="user-mini-email">{user.email}</span>
                              </div>
                            </div>

                            <div className="matrix-user-controls">
                              <span className={`role-pill role-${projectPermission?.role.toLowerCase()}`}>
                                {projectPermission?.role}
                              </span>
                              <button
                                type="button"
                                className="remove-matrix-btn"
                                title="Gỡ quyền dự án"
                                onClick={() => void handleRemoveProject(user.id, project.id)}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {assignedUsers.length === 0 && (
                        <div className="matrix-empty">
                          <FolderKanban size={24} />
                          <span>Chưa có người dùng nào được gán trực tiếp vào dự án này</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: DOCUMENT ACCESS MATRIX */}
        {activeTab === "documents" && (
          <div className="admin-matrix-grid">
            {documents.map((doc) => {
              const assignedUsers = users.filter((u) => u.documents.some((d) => d.documentId === doc.id));
              const docProject = projects.find((p) => p.id === doc.projectId);

              return (
                <div key={doc.id} className="project-matrix-card doc-card">
                  <div className="matrix-card-header">
                    <div>
                      <div className="doc-badges">
                        <span className="project-code-badge">{docProject?.code ?? "DOC"}</span>
                        <span className="doc-type-badge">{doc.type}</span>
                      </div>
                      <h4 className="project-title">{doc.title}</h4>
                      <small className="project-client">Phiên bản: v{doc.version} | Cập nhật: {doc.updatedAt}</small>
                    </div>
                    <button
                      type="button"
                      className="btn-mini-primary"
                      onClick={() => {
                        setAssignDocIds([doc.id]);
                        setShowAssignDocModal(true);
                      }}
                    >
                      <Plus size={14} /> Gán Quyền
                    </button>
                  </div>

                  <div className="matrix-card-body">
                    <div className="matrix-users-list">
                      {assignedUsers.map((user) => {
                        const docPermission = user.documents.find((d) => d.documentId === doc.id);
                        return (
                          <div key={user.id} className="matrix-user-item">
                            <div className="user-mini-info">
                              <div className="user-avatar-mini doc">{user.name.charAt(0).toUpperCase()}</div>
                              <div>
                                <span className="user-mini-name">{user.name}</span>
                                <span className="user-mini-email">{user.email}</span>
                              </div>
                            </div>

                            <div className="matrix-user-controls">
                              <span className={`role-pill role-${docPermission?.role.toLowerCase()}`}>
                                {docPermission?.role}
                              </span>
                              <button
                                type="button"
                                className="remove-matrix-btn"
                                title="Gỡ quyền riêng tài liệu"
                                onClick={() => void handleRemoveDocument(user.id, doc.id)}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {assignedUsers.length === 0 && (
                        <div className="matrix-empty">
                          <FileText size={24} />
                          <span>Dùng quyền mặc định của Dự án (Chưa có quy định riêng)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ==================== MODALS ==================== */}

      {/* 1. CREATE USER MODAL */}
      {showCreateModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <div className="modal-header">
              <div className="modal-header-info">
                <div className="modal-header-icon">
                  <UserPlus size={20} />
                </div>
                <div className="modal-header-text">
                  <h3>Tạo Tài khoản Người dùng Mới</h3>
                  <p>Khởi tạo tài khoản hệ thống cho thành viên hoặc quản lý</p>
                </div>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowCreateModal(false)} title="Đóng">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Họ và Tên <span className="req">*</span></label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Email Đăng nhập <span className="req">*</span></label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <div className="label-with-action">
                  <label>Mật khẩu Khởi tạo <span className="req">*</span></label>
                  <button type="button" className="btn-inline-text" onClick={generateRandomPassword}>
                    <Key size={13} /> Tạo ngẫu nhiên
                  </button>
                </div>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Tối thiểu 6 ký tự"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="toggle-password-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Vai trò Hệ thống</label>
                <div className="role-cards-selector">
                  <label className={`role-option-card ${newRole === "EMPLOYEE" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="userRole"
                      value="EMPLOYEE"
                      checked={newRole === "EMPLOYEE"}
                      onChange={() => setNewRole("EMPLOYEE")}
                    />
                    <div>
                      <strong>Nhân viên (Employee)</strong>
                      <small>Xem và thao tác trên các dự án/tài liệu được phân quyền</small>
                    </div>
                  </label>

                  <label className={`role-option-card ${newRole === "MANAGER" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="userRole"
                      value="MANAGER"
                      checked={newRole === "MANAGER"}
                      onChange={() => setNewRole("MANAGER")}
                    />
                    <div>
                      <strong>Quản lý (Manager)</strong>
                      <small>Quản lý nội dung, duyệt yêu cầu & gán quyền thành viên</small>
                    </div>
                  </label>

                  <label className={`role-option-card ${newRole === "ADMIN" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="userRole"
                      value="ADMIN"
                      checked={newRole === "ADMIN"}
                      onChange={() => setNewRole("ADMIN")}
                    />
                    <div>
                      <strong>Quản trị viên (Admin)</strong>
                      <small>Toàn quyền cấu hình hệ thống, người dùng và phân quyền</small>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-admin-secondary" onClick={() => setShowCreateModal(false)}>
                Hủy bỏ
              </button>
              <button type="button" className="btn-admin-primary" onClick={() => void handleCreateUser()}>
                <UserPlus size={16} /> Tạo tài khoản
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ASSIGN PROJECT MODAL */}
      {showAssignProjectModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <div className="modal-header">
              <div className="modal-header-info">
                <div className="modal-header-icon cyan">
                  <FolderKanban size={20} />
                </div>
                <div className="modal-header-text">
                  <h3>Phân quyền Trực tiếp trên Dự án</h3>
                  <p>Cấp quyền truy cập dự án cụ thể cho người dùng</p>
                </div>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowAssignProjectModal(false)} title="Đóng">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* User Searchable Dropdown */}
              <SearchableMultiSelect
                label="Chọn Người dùng"
                placeholder="Tìm kiếm người dùng theo tên, email..."
                items={userSelectItems}
                selectedIds={assignUserIds}
                onChange={setAssignUserIds}
              />

              {/* Project Searchable Dropdown */}
              <SearchableMultiSelect
                label="Chọn Dự án"
                placeholder="Tìm kiếm dự án theo tên, mã..."
                items={projectSelectItems}
                selectedIds={assignProjectIds}
                onChange={setAssignProjectIds}
              />

              <div className="form-group">
                <label>Quyền hạn trên Dự án <span className="selection-count">{assignRoles.length}</span></label>
                <div className="project-role-grid">
                  {(Object.keys(projectRoleLabels) as ProjectRole[]).map((rKey) => {
                    const isSelected = assignRoles.includes(rKey);
                    return (
                      <div
                        key={rKey}
                        className={`project-role-card ${isSelected ? "selected" : ""}`}
                        onClick={() => toggleRole(assignRoles, rKey, setAssignRoles)}
                      >
                        <div className="role-card-header">
                          <div className={`role-card-icon ${rKey.toLowerCase()}`}>
                            {rKey === "VIEWER" && <Eye size={15} />}
                            {rKey === "REVIEWER" && <MessageSquareText size={15} />}
                            {rKey === "EDITOR" && <Pencil size={15} />}
                            {rKey === "MANAGER" && <ShieldCheck size={15} />}
                          </div>
                          <strong>{projectRoleLabels[rKey].label}</strong>
                          {isSelected && <span className="role-selected-check"><Check size={11} /></span>}
                        </div>
                        <small>{projectRoleLabels[rKey].desc}</small>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-admin-secondary" onClick={() => setShowAssignProjectModal(false)}>
                Hủy bỏ
              </button>
              <button type="button" className="btn-admin-primary" onClick={() => void handleAssignProject()}>
                <Check size={16} /> Lưu phân quyền Dự án
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. ASSIGN DOCUMENT MODAL */}
      {showAssignDocModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <div className="modal-header">
              <div className="modal-header-info">
                <div className="modal-header-icon amber">
                  <FileText size={20} />
                </div>
                <div className="modal-header-text">
                  <h3>Phân quyền Riêng biệt trên Tài liệu</h3>
                  <p>Quyền tài liệu riêng có độ ưu tiên cao hơn quyền dự án chung</p>
                </div>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowAssignDocModal(false)} title="Đóng">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* User Searchable Dropdown */}
              <SearchableMultiSelect
                label="Chọn Người dùng"
                placeholder="Tìm kiếm người dùng theo tên, email..."
                items={userSelectItems}
                selectedIds={assignDocUserIds}
                onChange={setAssignDocUserIds}
              />

              {/* Document Searchable Dropdown */}
              <SearchableMultiSelect
                label="Chọn Tài liệu"
                placeholder="Tìm kiếm tài liệu theo tên, mã..."
                items={documentSelectItems}
                selectedIds={assignDocIds}
                onChange={setAssignDocIds}
              />

              <div className="form-group">
                <label>Quyền hạn trên Tài liệu <span className="selection-count">{assignDocRoles.length}</span></label>
                <div className="project-role-grid">
                  {(Object.keys(projectRoleLabels) as ProjectRole[]).map((rKey) => {
                    const isSelected = assignDocRoles.includes(rKey);
                    return (
                      <div
                        key={rKey}
                        className={`project-role-card ${isSelected ? "selected" : ""}`}
                        onClick={() => toggleRole(assignDocRoles, rKey, setAssignDocRoles)}
                      >
                        <div className="role-card-header">
                          <div className={`role-card-icon ${rKey.toLowerCase()}`}>
                            {rKey === "VIEWER" && <Eye size={15} />}
                            {rKey === "REVIEWER" && <MessageSquareText size={15} />}
                            {rKey === "EDITOR" && <Pencil size={15} />}
                            {rKey === "MANAGER" && <ShieldCheck size={15} />}
                          </div>
                          <strong>{projectRoleLabels[rKey].label}</strong>
                          {isSelected && <span className="role-selected-check"><Check size={11} /></span>}
                        </div>
                        <small>{projectRoleLabels[rKey].desc}</small>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-admin-secondary" onClick={() => setShowAssignDocModal(false)}>
                Hủy bỏ
              </button>
              <button type="button" className="btn-admin-primary" onClick={() => void handleAssignDocument()}>
                <Check size={16} /> Lưu quyền Tài liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. CONFIRM DELETE / DISABLE MODAL */}
      {deletingUser && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card mini">
            <div className="modal-header">
              <div className="modal-header-info">
                <div className="modal-header-icon danger">
                  <ShieldAlert size={20} />
                </div>
                <div className="modal-header-text">
                  <h3>Xác nhận Khóa / Vô hiệu hóa</h3>
                  <p>Tài khoản người dùng sẽ bị vô hiệu hóa truy cập</p>
                </div>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setDeletingUser(null)} title="Đóng">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="confirm-text">
                Bạn có chắc chắn muốn vô hiệu hóa tài khoản <strong>{deletingUser.name}</strong> ({deletingUser.email})?
              </p>
              <p className="confirm-subtext">
                Tài khoản sẽ bị gỡ quyền đăng nhập nhưng dữ liệu lịch sử đóng góp vẫn được lưu trữ an toàn.
              </p>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-admin-secondary" onClick={() => setDeletingUser(null)}>
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn-admin-danger"
                onClick={() => void handleDeleteUser(deletingUser.id)}
              >
                <Trash2 size={16} /> Đồng ý Vô hiệu hóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
