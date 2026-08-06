import { useEffect, useMemo, useState } from "react";
import { Check, Copy, FileText, FolderKanban, Search, Send, ShieldCheck, Trash2, X } from "lucide-react";
import {
  assignUserToDocument,
  assignUserToProject,
  fetchUsers,
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
  onToast: (type: "success" | "info" | "warning" | "error", title: string, message: string) => void;
};

const shareRoleLabels: Record<ProjectRole, { label: string; desc: string }> = {
  VIEWER: { label: "Viewer", desc: "Chỉ xem" },
  REVIEWER: { label: "Reviewer", desc: "Xem và bình luận" },
  EDITOR: { label: "Editor", desc: "Chỉnh sửa nội dung" },
  MANAGER: { label: "Manager", desc: "Quản lý và chia sẻ" }
};

export function ShareAccessModal({
  isOpen,
  initialScope,
  documentId,
  documentTitle,
  projectId,
  projectTitle,
  onClose,
  onToast
}: ShareAccessModalProps) {
  const [scope, setScope] = useState<ShareScope>(initialScope);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<ProjectRole>("VIEWER");

  useEffect(() => {
    if (!isOpen) return;
    setScope(initialScope);
    setSelectedUserIds([]);
    setQuery("");
    void loadUsers();
  }, [isOpen, initialScope]);

  async function loadUsers() {
    setLoading(true);
    try {
      setUsers(await fetchUsers());
    } catch (error: any) {
      onToast("error", "Không tải được danh sách người dùng", error?.message || "Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  const targetId = scope === "document" ? documentId : projectId;
  const targetTitle = scope === "document" ? documentTitle : projectTitle;
  const targetLabel = scope === "document" ? "tài liệu" : "dự án";

  const accessUsers = useMemo(() => {
    if (!targetId) return [];
    return users
      .map((user) => {
        const permission = scope === "document"
          ? user.documents.find((item) => item.documentId === targetId)
          : user.projects.find((item) => item.projectId === targetId);
        return permission ? { user, role: permission.role } : null;
      })
      .filter(Boolean) as Array<{ user: ManagedUser; role: ProjectRole }>;
  }, [scope, targetId, users]);

  const accessibleUserIds = useMemo(
    () => new Set(accessUsers.map(({ user }) => user.id)),
    [accessUsers]
  );

  const candidateUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users
      .filter((user) => !accessibleUserIds.has(user.id))
      .filter((user) => {
        if (!normalizedQuery) return true;
        return `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 8);
  }, [accessibleUserIds, query, users]);

  function toggleSelectedUser(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleShare() {
    if (!targetId || selectedUserIds.length === 0) {
      onToast("warning", "Chưa chọn người nhận", "Hãy chọn ít nhất một người dùng để chia sẻ.");
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        selectedUserIds.map((userId) =>
          scope === "document"
            ? assignUserToDocument(userId, targetId, selectedRole)
            : assignUserToProject(userId, targetId, selectedRole)
        )
      );
      setSelectedUserIds([]);
      await loadUsers();
      onToast("success", "Đã chia sẻ quyền", `Đã cấp ${selectedRole} cho ${selectedUserIds.length} người trên ${targetLabel}.`);
    } catch (error: any) {
      onToast("error", "Chia sẻ thất bại", error?.message || "Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeRole(userId: string, role: ProjectRole) {
    if (!targetId) return;
    setSaving(true);
    try {
      if (scope === "document") {
        await assignUserToDocument(userId, targetId, role);
      } else {
        await assignUserToProject(userId, targetId, role);
      }
      await loadUsers();
      onToast("success", "Đã cập nhật quyền", `Quyền ${targetLabel} đã đổi thành ${role}.`);
    } catch (error: any) {
      onToast("error", "Không đổi được quyền", error?.message || "Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(userId: string) {
    if (!targetId) return;
    setSaving(true);
    try {
      if (scope === "document") {
        await removeUserFromDocument(userId, targetId);
      } else {
        await removeUserFromProject(userId, targetId);
      }
      await loadUsers();
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

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop share-modal-backdrop" onClick={onClose}>
      <div className="modal-content share-modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="share-modal-header">
          <div>
            <p className="share-modal-eyebrow">Chia sẻ quyền truy cập</p>
            <h3>Chia sẻ "{targetTitle}"</h3>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} title="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="share-scope-tabs">
          <button
            type="button"
            className={scope === "document" ? "active" : ""}
            onClick={() => {
              setScope("document");
              setSelectedUserIds([]);
            }}
            disabled={!documentId || documentId === "empty-document"}
          >
            <FileText size={14} /> Tài liệu này
          </button>
          <button
            type="button"
            className={scope === "project" ? "active" : ""}
            onClick={() => {
              setScope("project");
              setSelectedUserIds([]);
            }}
            disabled={!projectId}
          >
            <FolderKanban size={14} /> Toàn dự án
          </button>
        </div>

        <div className="share-modal-body">
          <div className="share-search-row">
            <div className="share-search-box">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nhập tên hoặc email"
              />
            </div>
            <select
              className="share-role-select"
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as ProjectRole)}
            >
              {(Object.keys(shareRoleLabels) as ProjectRole[]).map((role) => (
                <option key={role} value={role}>{shareRoleLabels[role].label}</option>
              ))}
            </select>
          </div>

          <div className="share-candidate-list">
            {loading ? (
              <div className="share-empty-state">Đang tải người dùng...</div>
            ) : candidateUsers.length === 0 ? (
              <div className="share-empty-state">Không còn người dùng phù hợp để thêm.</div>
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
                    {selected && <Check size={16} />}
                  </button>
                );
              })
            )}
          </div>

          <button
            type="button"
            className="btn-primary share-send-btn"
            onClick={() => void handleShare()}
            disabled={saving || selectedUserIds.length === 0}
          >
            <Send size={15} /> Chia sẻ cho {selectedUserIds.length || 0} người
          </button>

          <div className="share-access-section">
            <div className="share-section-title">
              <ShieldCheck size={15} />
              <span>Người có quyền truy cập</span>
            </div>

            <div className="share-access-list">
              {accessUsers.length === 0 ? (
                <div className="share-empty-state">Chưa có quyền trực tiếp trên {targetLabel} này.</div>
              ) : (
                accessUsers.map(({ user, role }) => (
                  <div key={user.id} className="share-access-item">
                    <span className="share-avatar">{user.name.charAt(0).toUpperCase()}</span>
                    <span className="share-user-copy">
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                    </span>
                    <select
                      className="share-access-role"
                      value={role}
                      onChange={(event) => void handleChangeRole(user.id, event.target.value as ProjectRole)}
                      disabled={saving}
                    >
                      {(Object.keys(shareRoleLabels) as ProjectRole[]).map((nextRole) => (
                        <option key={nextRole} value={nextRole}>{shareRoleLabels[nextRole].label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="share-remove-btn"
                      title="Gỡ quyền"
                      onClick={() => void handleRemove(user.id)}
                      disabled={saving}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="share-modal-footer">
          <button className="btn-secondary" type="button" onClick={() => void handleCopyLink()}>
            <Copy size={14} /> Sao chép liên kết
          </button>
          <button className="btn-primary" type="button" onClick={onClose}>
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}
