import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Copy, FileText, FolderKanban, Search, Send, ShieldCheck, Trash2, X } from "lucide-react";
import {
  assignUserToDocument,
  assignUserToProject,
  fetchShareUsers,
  type ManagedUser,
  removeUserFromDocument,
  removeUserFromProject
} from "./authApi";
import type { ProjectRole } from "./types";

type ShareScope = "document" | "project";

type ShareAccessModalProps = {
  isOpen: boolean;
  initialScope: ShareScope;
  documentId: string;
  documentTitle: string;
  projectId: string;
  projectTitle: string;
  onClose: () => void;
  onAccessChanged?: (scope: ShareScope, targetId: string) => void | Promise<void>;
  onToast: (type: "success" | "info" | "warning" | "error", title: string, message: string) => void;
};

const shareRoleLabels: Record<ProjectRole, { label: string; desc: string }> = {
  VIEWER: { label: "Xem", desc: "Chỉ xem" },
  REVIEWER: { label: "Bình luận", desc: "Xem và bình luận" },
  EDITOR: { label: "Sửa", desc: "Chỉnh sửa nội dung" },
  MANAGER: { label: "Quản lý", desc: "Quản lý và chia sẻ" }
};

const shareRoles = Object.keys(shareRoleLabels) as ProjectRole[];
const globalRoleLabels: Record<ManagedUser["role"], string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  EMPLOYEE: "Nhân viên"
};

export function ShareAccessModal({
  isOpen,
  initialScope,
  documentId,
  documentTitle,
  projectId,
  projectTitle,
  onClose,
  onAccessChanged,
  onToast
}: ShareAccessModalProps) {
  const [scope, setScope] = useState<ShareScope>(initialScope);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<ProjectRole[]>(["VIEWER"]);
  const [pendingNewAccess, setPendingNewAccess] = useState<Record<string, ProjectRole[]>>({});
  const [pendingRoleChanges, setPendingRoleChanges] = useState<Record<string, ProjectRole[]>>({});
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setScope(initialScope);
    setSelectedUserIds([]);
    setPendingNewAccess({});
    setPendingRoleChanges({});
    setIsUserDropdownOpen(false);
    setQuery("");
    void loadUsers(initialScope);
  }, [isOpen, initialScope]);

  async function loadUsers(nextScope: ShareScope = scope) {
    const nextTargetId = nextScope === "document" ? documentId : projectId;
    if (!nextTargetId || nextTargetId === "empty-document") {
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      setUsers(await fetchShareUsers(nextScope, nextTargetId));
    } catch (error: any) {
      onToast("error", "Không tải được danh sách người dùng", error?.message || "Vui lòng thử lại.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  const targetId = scope === "document" ? documentId : projectId;
  const targetTitle = scope === "document" ? documentTitle : projectTitle;
  const targetLabel = scope === "document" ? "tài liệu" : "dự án";

  const accessUsers = useMemo(() => {
    if (!targetId) return [];
    const savedAccess = users
      .map((user) => {
        const permission = scope === "document"
          ? user.documents.find((item) => item.documentId === targetId)
          : user.projects.find((item) => item.projectId === targetId);
        return permission ? { user, role: permission.role, roles: permission.roles?.length ? permission.roles : [permission.role] } : null;
      })
      .filter(Boolean) as Array<{ user: ManagedUser; role: ProjectRole; roles: ProjectRole[]; isPendingNew?: boolean }>;
    const savedUserIds = new Set(savedAccess.map(({ user }) => user.id));
    const pendingAccess = Object.entries(pendingNewAccess)
      .map(([userId, roles]) => {
        if (savedUserIds.has(userId)) return null;
        const user = users.find((item) => item.id === userId);
        return user ? { user, role: roles[0], roles, isPendingNew: true } : null;
      })
      .filter(Boolean) as Array<{ user: ManagedUser; role: ProjectRole; roles: ProjectRole[]; isPendingNew: true }>;
    return [...savedAccess, ...pendingAccess];
  }, [pendingNewAccess, scope, targetId, users]);

  const accessibleUserIds = useMemo(
    () => new Set(accessUsers.map(({ user }) => user.id)),
    [accessUsers]
  );

  const inheritedAccessUsers = useMemo(() => {
    if (scope !== "document" || !projectId) return [];
    return users
      .map((user) => {
        const permission = user.projects.find((item) => item.projectId === projectId);
        if (!permission) return null;
        return { user, role: permission.role, roles: permission.roles?.length ? permission.roles : [permission.role] };
      })
      .filter((item): item is Array<{ user: ManagedUser; role: ProjectRole; roles: ProjectRole[] }>[number] => Boolean(item))
      .filter(({ user }) => !accessibleUserIds.has(user.id));
  }, [accessibleUserIds, projectId, scope, users]);

  const candidateUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users
      .filter((user) => !accessibleUserIds.has(user.id))
      .filter((user) => {
        if (!normalizedQuery) return true;
        return `${user.name} ${user.email} ${user.role} ${globalRoleLabels[user.role]}`.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 20);
  }, [accessibleUserIds, query, users]);

  const selectedUsers = useMemo(
    () => users.filter((user) => selectedUserIds.includes(user.id)),
    [selectedUserIds, users]
  );

  function toggleSelectedUser(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  function toggleSelectedRole(role: ProjectRole) {
    setSelectedRoles((prev) => toggleRole(prev, role));
  }

  function toggleRole(currentRoles: ProjectRole[], role: ProjectRole) {
    if (currentRoles.includes(role)) {
      return currentRoles.length === 1 ? currentRoles : currentRoles.filter((item) => item !== role);
    }
    return [...currentRoles, role];
  }

  function draftRolesFor(userId: string, roles: ProjectRole[]) {
    return pendingRoleChanges[userId] ?? roles;
  }

  function setDraftRoles(userId: string, savedRoles: ProjectRole[], nextRoles: ProjectRole[]) {
    setPendingRoleChanges((prev) => {
      const next = { ...prev };
      if (sameRoles(savedRoles, nextRoles)) {
        delete next[userId];
      } else {
        next[userId] = nextRoles;
      }
      return next;
    });
  }

  function sameRoles(left: ProjectRole[], right: ProjectRole[]) {
    if (left.length !== right.length) return false;
    const rightSet = new Set(right);
    return left.every((role) => rightSet.has(role));
  }

  async function handleShare() {
    if (!targetId || selectedUserIds.length === 0) {
      onToast("warning", "Chưa chọn người nhận", "Hãy chọn ít nhất một người dùng để chia sẻ.");
      return;
    }

    const userCount = selectedUserIds.length;
    setPendingNewAccess((prev) => {
      const next = { ...prev };
      selectedUserIds.forEach((userId) => {
        next[userId] = selectedRoles;
      });
      return next;
    });
    setSelectedUserIds([]);
    setIsUserDropdownOpen(false);
    onToast(
      "info",
      "Đã thêm vào danh sách chờ",
      `Bấm Xong để cấp quyền ${selectedRoles.map((role) => shareRoleLabels[role].label).join(", ")} cho ${userCount} người.`
    );
  }

  async function handleRemove(userId: string) {
    if (!targetId) return;
    if (pendingNewAccess[userId]) {
      setPendingNewAccess((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      return;
    }

    setSaving(true);
    try {
      if (scope === "document") {
        await removeUserFromDocument(userId, targetId);
      } else {
        await removeUserFromProject(userId, targetId);
      }
      setPendingRoleChanges((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      await loadUsers();
      await onAccessChanged?.(scope, targetId);
      onToast("info", "Đã gỡ quyền", `Người dùng đã được gỡ khỏi ${targetLabel}.`);
    } catch (error: any) {
      onToast("error", "Không gỡ được quyền", error?.message || "Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    onToast("success", "Đã sao chép liên kết", "Bạn có thể gửi link này cho người đã được cấp quyền.");
  }

  async function handleDone() {
    if (!targetId) {
      onClose();
      return;
    }

    const changedEntries = Object.entries(pendingRoleChanges) as Array<[string, ProjectRole[]]>;
    const newEntries = Object.entries(pendingNewAccess) as Array<[string, ProjectRole[]]>;
    if (changedEntries.length === 0 && newEntries.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        [...newEntries, ...changedEntries].map(([userId, roles]) =>
          scope === "document"
            ? assignUserToDocument(userId, targetId, roles)
            : assignUserToProject(userId, targetId, roles)
        )
      );
      setPendingNewAccess({});
      setPendingRoleChanges({});
      await loadUsers();
      await onAccessChanged?.(scope, targetId);
      onToast("success", "Đã cập nhật quyền", `Đã lưu ${newEntries.length + changedEntries.length} thay đổi quyền trên ${targetLabel}.`);
      onClose();
    } catch (error: any) {
      onToast("error", "Không lưu được quyền", error?.message || "Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop share-modal-backdrop" onClick={onClose}>
      <div className="modal-content share-modal-content" onClick={(event) => event.stopPropagation()}>
        {/* Header */}
        <div className="share-modal-header">
          <div className="share-modal-title-area">
            <span className="share-modal-badge">
              <ShieldCheck size={13} /> Chia sẻ quyền truy cập
            </span>
            <h3>Chia sẻ "{targetTitle}"</h3>
          </div>
          <button className="share-close-btn" type="button" onClick={onClose} title="Đóng">
            <X size={18} />
          </button>
        </div>

        {/* Scope Tabs */}
        <div className="share-scope-tabs-container">
          <div className="share-scope-tabs">
            <button
              type="button"
              className={scope === "document" ? "active" : ""}
              onClick={() => {
                setScope("document");
                setSelectedUserIds([]);
                setPendingNewAccess({});
                setPendingRoleChanges({});
                void loadUsers("document");
              }}
              disabled={!documentId || documentId === "empty-document"}
            >
              <FileText size={15} />
              <span>Tài liệu này</span>
            </button>
            <button
              type="button"
              className={scope === "project" ? "active" : ""}
              onClick={() => {
                setScope("project");
                setSelectedUserIds([]);
                setPendingNewAccess({});
                setPendingRoleChanges({});
                void loadUsers("project");
              }}
              disabled={!projectId}
            >
              <FolderKanban size={15} />
              <span>Toàn dự án</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="share-modal-body">
          {/* Invite Card */}
          <div className="share-invite-box">
            <label className="share-box-label">Thêm người dùng mới vào {targetLabel}</label>
            
            <div className="share-search-row">
              <div className="share-user-dropdown">
                <button
                  type="button"
                  className={isUserDropdownOpen ? "share-dropdown-trigger open" : "share-dropdown-trigger"}
                  onClick={() => setIsUserDropdownOpen((open) => !open)}
                >
                  <span className="share-trigger-text">
                    {selectedUsers.length
                      ? `Đã chọn ${selectedUsers.length} người dùng`
                      : "Chọn một hoặc nhiều người dùng..."}
                  </span>
                  <ChevronDown size={16} className={`chevron-icon ${isUserDropdownOpen ? "open" : ""}`} />
                </button>

                {isUserDropdownOpen && (
                  <div className="share-dropdown-menu">
                    <div className="share-search-box">
                      <Search size={15} />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Tìm theo tên hoặc email..."
                        autoFocus
                      />
                      {query && (
                        <button type="button" onClick={() => setQuery("")} className="clear-search-btn">
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    <div className="share-candidate-list dropdown-list">
                      {loading ? (
                        <div className="share-empty-state">Đang tải người dùng...</div>
                      ) : candidateUsers.length === 0 ? (
                        <div className="share-empty-state">Không có người dùng phù hợp để thêm.</div>
                      ) : (
                        candidateUsers.map((user) => {
                          const selected = selectedUserIds.includes(user.id);
                          return (
                            <button
                              key={user.id}
                              type="button"
                              className={selected ? "share-user-option selected" : "share-user-option"}
                              onClick={() => toggleSelectedUser(user.id)}
                            >
                              <span className="share-avatar">{user.name.charAt(0).toUpperCase()}</span>
                              <span className="share-user-copy">
                                <strong>{user.name}</strong>
                                <small>{user.email}</small>
                              </span>
                              <span className={`share-user-role-badge role-${user.role.toLowerCase()}`}>
                                {globalRoleLabels[user.role]}
                              </span>
                              <span className={`share-checkbox ${selected ? "checked" : ""}`}>
                                {selected && <Check size={12} />}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Selected Users Chips */}
            {selectedUsers.length > 0 && (
              <div className="share-selected-users">
                {selectedUsers.map((user) => (
                  <div key={user.id} className="share-user-chip">
                    <span className="chip-avatar">{user.name.charAt(0).toUpperCase()}</span>
                    <span className="chip-name">{user.name}</span>
                    <button type="button" onClick={() => toggleSelectedUser(user.id)} title="Bỏ chọn">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Role selection for invite */}
            <div className="share-role-selection">
              <span className="role-select-label">Gán vai trò:</span>
              <div className="share-role-checks compact">
                {shareRoles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={`share-role-check role-${role.toLowerCase()} ${selectedRoles.includes(role) ? "selected" : ""}`}
                    onClick={() => toggleSelectedRole(role)}
                    title={shareRoleLabels[role].desc}
                  >
                    {selectedRoles.includes(role) && <Check size={12} />}
                    <span>{shareRoleLabels[role].label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn-primary share-send-btn"
              onClick={() => void handleShare()}
              disabled={saving || selectedUserIds.length === 0}
            >
              <Send size={15} />
              <span>Thêm {selectedUserIds.length || 0} người</span>
            </button>
          </div>

          {/* Existing Access List */}
          <div className="share-access-section">
            <div className="share-section-title">
              <ShieldCheck size={16} />
              <span>Quyền trực tiếp trên {targetLabel}</span>
              <span className="share-count-badge">{accessUsers.length}</span>
            </div>

            <div className="share-access-list">
              {accessUsers.length === 0 ? (
                <div className="share-empty-state">Chưa có quyền trực tiếp trên {targetLabel} này.</div>
              ) : (
	                accessUsers.map(({ user, roles, isPendingNew }) => {
                    const draftRoles = isPendingNew ? roles : draftRolesFor(user.id, roles);
                    const hasPendingChange = Boolean(isPendingNew || pendingRoleChanges[user.id]);

                    return (
	                  <div key={user.id} className={`share-access-item${hasPendingChange ? " pending" : ""}`}>
	                    <div className="share-user-info">
	                      <span className="share-avatar">{user.name.charAt(0).toUpperCase()}</span>
	                      <span className="share-user-copy">
	                        <strong>{user.name}</strong>
	                        <small>{user.email} · {globalRoleLabels[user.role]} · {hasPendingChange ? "Chờ lưu" : "Quyền trực tiếp"}</small>
	                      </span>
	                      <span className={`share-user-role-badge role-${user.role.toLowerCase()}`}>
	                        {globalRoleLabels[user.role]}
	                      </span>
	                    </div>

                    <div className="share-role-checks">
                      {shareRoles.map((nextRole) => (
                        <button
                          key={nextRole}
                          type="button"
                          className={`share-role-check role-${nextRole.toLowerCase()} ${draftRoles.includes(nextRole) ? "selected" : ""}`}
                          onClick={() => {
                            const nextRoles = toggleRole(draftRoles, nextRole);
                            if (isPendingNew) {
                              setPendingNewAccess((prev) => ({ ...prev, [user.id]: nextRoles }));
                            } else {
                              setDraftRoles(user.id, roles, nextRoles);
                            }
                          }}
                          disabled={saving || (draftRoles.length === 1 && draftRoles.includes(nextRole))}
                          title={shareRoleLabels[nextRole].desc}
                        >
                          {draftRoles.includes(nextRole) && <Check size={12} />}
                          <span>{shareRoleLabels[nextRole].label}</span>
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="share-remove-btn"
                      title="Gỡ quyền truy cập"
                      onClick={() => void handleRemove(user.id)}
                      disabled={saving}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
                })
              )}
            </div>
          </div>

          {scope === "document" && (
            <div className="share-access-section inherited">
              <div className="share-section-title">
                <FolderKanban size={16} />
                <span>Kế thừa từ dự án</span>
                <span className="share-count-badge">{inheritedAccessUsers.length}</span>
              </div>

              <div className="share-access-list">
                {inheritedAccessUsers.length === 0 ? (
                  <div className="share-empty-state">Không có quyền kế thừa từ dự án.</div>
                ) : (
	                  inheritedAccessUsers.map(({ user, roles }) => (
	                    <div key={user.id} className="share-access-item inherited">
	                      <div className="share-user-info">
	                        <span className="share-avatar">{user.name.charAt(0).toUpperCase()}</span>
	                        <span className="share-user-copy">
	                          <strong>{user.name}</strong>
	                          <small>{user.email} · {globalRoleLabels[user.role]} · Kế thừa từ project</small>
	                        </span>
	                        <span className={`share-user-role-badge role-${user.role.toLowerCase()}`}>
	                          {globalRoleLabels[user.role]}
	                        </span>
	                      </div>
                      <div className="share-inherited-roles">
                        {roles.map((role) => (
                          <span key={role} className={`share-role-badge role-${role.toLowerCase()}`}>
                            {shareRoleLabels[role].label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="share-modal-footer">
          <button className="btn-secondary share-copy-btn" type="button" onClick={() => void handleCopyLink()}>
            <Copy size={14} /> Sao chép liên kết
          </button>
          <button className="btn-primary share-done-btn" type="button" onClick={() => void handleDone()} disabled={saving}>
            {saving ? "Đang lưu..." : "Xong"}
          </button>
        </div>
      </div>
    </div>
  );
}
