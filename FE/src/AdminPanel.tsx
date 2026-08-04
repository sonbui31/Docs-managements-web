import { useEffect, useMemo, useState } from "react";
import { Check, Lock, Plus, RefreshCw, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import {
  assignUserToDocument,
  assignUserToProject,
  createUser,
  deleteUser,
  fetchUsers,
  type ManagedUser,
  removeUserFromDocument,
  removeUserFromProject,
  updateUser
} from "./authApi";
import type { Project, ProjectDocument, ProjectRole, UserRole, UserStatus } from "./types";

type Props = {
  projects: Project[];
  documents: ProjectDocument[];
  onToast: (type: "success" | "info" | "warning" | "error", title: string, message: string) => void;
};

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  EMPLOYEE: "Nhân viên"
};

const statusLabels: Record<UserStatus, string> = {
  ACTIVE: "Hoạt động",
  DISABLED: "Vô hiệu",
  LOCKED: "Khóa tạm"
};

const projectRoleLabels: Record<ProjectRole, string> = {
  VIEWER: "Viewer",
  REVIEWER: "Reviewer",
  EDITOR: "Editor",
  MANAGER: "Manager"
};

export function AdminPanel({ projects, documents, onToast }: Props) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("EMPLOYEE");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignProjectId, setAssignProjectId] = useState(projects[0]?.id ?? "");
  const [assignRole, setAssignRole] = useState<ProjectRole>("VIEWER");
  const [assignDocumentUserId, setAssignDocumentUserId] = useState("");
  const [assignDocumentId, setAssignDocumentId] = useState(documents[0]?.id ?? "");
  const [assignDocumentRole, setAssignDocumentRole] = useState<ProjectRole>("VIEWER");

  const activeUsers = useMemo(() => users.filter((user) => user.status === "ACTIVE").length, [users]);

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    setAssignProjectId((current) => current || projects[0]?.id || "");
  }, [projects]);

  useEffect(() => {
    setAssignDocumentId((current) => current || documents[0]?.id || "");
  }, [documents]);

  async function loadUsers(showToastOnError = false) {
    setLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data);
      setAssignUserId((current) => current || data.find((user) => user.role !== "ADMIN")?.id || "");
      setAssignDocumentUserId((current) => current || data.find((user) => user.role !== "ADMIN")?.id || "");
    } catch (error: any) {
      console.error("Load users failed:", error);
      if (showToastOnError) {
        onToast("error", "Không tải được user", error?.message || "Kiểm tra quyền admin hoặc kết nối BE.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser() {
    if (!newName || !newEmail || !newPassword) {
      onToast("warning", "Thiếu thông tin", "Nhập đủ tên, email và mật khẩu.");
      return;
    }

    try {
      await createUser({ name: newName, email: newEmail, password: newPassword, role: newRole });
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("EMPLOYEE");
      await loadUsers();
      onToast("success", "Đã tạo user", "Tài khoản mới đã sẵn sàng đăng nhập.");
    } catch (error) {
      console.error("Create user failed:", error);
      onToast("error", "Không tạo được user", "Email có thể đã tồn tại hoặc mật khẩu chưa đủ mạnh.");
    }
  }

  async function handleUpdateUser(id: string, payload: Partial<{ role: UserRole; status: UserStatus }>) {
    try {
      await updateUser(id, payload);
      await loadUsers();
      onToast("success", "Đã cập nhật user", "Thay đổi quyền/trạng thái đã được lưu.");
    } catch (error) {
      console.error("Update user failed:", error);
      onToast("error", "Không cập nhật được user", "Bạn không thể hạ quyền/xóa admin hệ thống.");
    }
  }

  async function handleDeleteUser(id: string) {
    try {
      await deleteUser(id);
      await loadUsers();
      onToast("info", "Đã xóa mềm user", "Tài khoản đã bị vô hiệu hóa và ẩn khỏi danh sách.");
    } catch (error) {
      console.error("Delete user failed:", error);
      onToast("error", "Không xóa được user", "Admin hệ thống không thể bị xóa.");
    }
  }

  async function handleAssignProject() {
    if (!assignUserId || !assignProjectId) {
      onToast("warning", "Chưa chọn đủ", "Chọn user và dự án trước khi gán quyền.");
      return;
    }

    try {
      await assignUserToProject(assignUserId, assignProjectId, assignRole);
      await loadUsers();
      onToast("success", "Đã gán dự án", "Quyền dự án của user đã được cập nhật.");
    } catch (error) {
      console.error("Assign project failed:", error);
      onToast("error", "Không gán được dự án", "Kiểm tra quyền quản lý hoặc dữ liệu dự án.");
    }
  }

  async function handleRemoveProject(userId: string, projectId: string) {
    try {
      await removeUserFromProject(userId, projectId);
      await loadUsers();
      onToast("info", "Đã bỏ gán dự án", "User không còn quyền trực tiếp trên dự án này.");
    } catch (error) {
      console.error("Remove project failed:", error);
      onToast("error", "Không bỏ gán được", "Vui lòng thử lại sau.");
    }
  }

  async function handleAssignDocument() {
    if (!assignDocumentUserId || !assignDocumentId) {
      onToast("warning", "Chưa chọn đủ", "Chọn user và tài liệu trước khi gán quyền.");
      return;
    }

    try {
      await assignUserToDocument(assignDocumentUserId, assignDocumentId, assignDocumentRole);
      await loadUsers();
      onToast("success", "Đã gán quyền tài liệu", "Quyền riêng trên tài liệu đã được cập nhật.");
    } catch (error) {
      console.error("Assign document failed:", error);
      onToast("error", "Không gán được tài liệu", "Kiểm tra quyền manager/admin hoặc tài liệu được chọn.");
    }
  }

  async function handleRemoveDocument(userId: string, documentId: string) {
    try {
      await removeUserFromDocument(userId, documentId);
      await loadUsers();
      onToast("info", "Đã bỏ quyền tài liệu", "User sẽ quay về quyền theo project nếu có.");
    } catch (error) {
      console.error("Remove document failed:", error);
      onToast("error", "Không bỏ quyền tài liệu", "Vui lòng thử lại sau.");
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-summary">
        <div>
          <span className="admin-kicker">Users</span>
          <strong>{users.length}</strong>
          <small>{activeUsers} tài khoản đang hoạt động</small>
        </div>
        <div>
          <span className="admin-kicker">Projects</span>
          <strong>{projects.length}</strong>
          <small>Dùng để gán quyền theo dự án</small>
        </div>
        <div>
          <span className="admin-kicker">Documents</span>
          <strong>{documents.length}</strong>
          <small>Quyền riêng ưu tiên hơn quyền dự án</small>
        </div>
        <button className="btn-secondary" type="button" onClick={() => void loadUsers(true)} disabled={loading}>
          <RefreshCw size={16} /> Làm mới
        </button>
      </div>

      <div className="admin-grid">
        <section className="admin-block">
          <div className="admin-block-header">
            <UserPlus size={18} />
            <h3>Tạo tài khoản</h3>
          </div>
          <div className="admin-form-grid">
            <input placeholder="Họ tên" value={newName} onChange={(event) => setNewName(event.target.value)} />
            <input placeholder="Email" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} />
            <input placeholder="Mật khẩu tạm" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            <select value={newRole} onChange={(event) => setNewRole(event.target.value as UserRole)}>
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" type="button" onClick={() => void handleCreateUser()}>
            <Plus size={16} /> Tạo user
          </button>
        </section>

        <section className="admin-block">
          <div className="admin-block-header">
            <ShieldCheck size={18} />
            <h3>Gán quyền dự án</h3>
          </div>
          <div className="admin-form-grid">
            <select value={assignUserId} onChange={(event) => setAssignUserId(event.target.value)}>
              {users.filter((user) => user.role !== "ADMIN").map((user) => (
                <option key={user.id} value={user.id}>{user.name} - {user.email}</option>
              ))}
            </select>
            <select value={assignProjectId} onChange={(event) => setAssignProjectId(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.code} - {project.name}</option>
              ))}
            </select>
            <select value={assignRole} onChange={(event) => setAssignRole(event.target.value as ProjectRole)}>
              {Object.entries(projectRoleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" type="button" onClick={() => void handleAssignProject()}>
            <Check size={16} /> Lưu phân quyền
          </button>
        </section>

        <section className="admin-block">
          <div className="admin-block-header">
            <ShieldCheck size={18} />
            <h3>Gán quyền tài liệu</h3>
          </div>
          <div className="admin-form-grid">
            <select value={assignDocumentUserId} onChange={(event) => setAssignDocumentUserId(event.target.value)}>
              {users.filter((user) => user.role !== "ADMIN").map((user) => (
                <option key={user.id} value={user.id}>{user.name} - {user.email}</option>
              ))}
            </select>
            <select value={assignDocumentId} onChange={(event) => setAssignDocumentId(event.target.value)}>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {projects.find((project) => project.id === document.projectId)?.code ?? "DOC"} - {document.title}
                </option>
              ))}
            </select>
            <select value={assignDocumentRole} onChange={(event) => setAssignDocumentRole(event.target.value as ProjectRole)}>
              {Object.entries(projectRoleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" type="button" onClick={() => void handleAssignDocument()}>
            <Check size={16} /> Lưu quyền tài liệu
          </button>
        </section>
      </div>

      <section className="admin-users">
        <div className="admin-block-header">
          <Users size={18} />
          <h3>Danh sách user</h3>
        </div>
        <div className="admin-user-list">
          {users.map((user) => (
            <article className="admin-user-row" key={user.id}>
              <div className="admin-user-main">
                <div className="admin-avatar">{user.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                  <small>
                    {user.projects.length ? user.projects.map((project) => `${project.code}:${project.role}`).join(" | ") : "Chưa được gán dự án"}
                    {user.documents.length ? ` • Doc: ${user.documents.map((document) => `${document.projectCode}/${document.type}:${document.role}`).join(" | ")}` : ""}
                  </small>
                </div>
              </div>
              <select
                value={user.role}
                disabled={user.role === "ADMIN"}
                onChange={(event) => void handleUpdateUser(user.id, { role: event.target.value as UserRole })}
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                value={user.status ?? "ACTIVE"}
                disabled={user.role === "ADMIN"}
                onChange={(event) => void handleUpdateUser(user.id, { status: event.target.value as UserStatus })}
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <div className="admin-user-actions">
                {user.projects.map((project) => (
                  <button
                    key={project.projectId}
                    type="button"
                    className="project-chip"
                    title="Bỏ gán dự án"
                    onClick={() => void handleRemoveProject(user.id, project.projectId)}
                  >
                    {project.code} x
                  </button>
                ))}
                {user.documents.map((document) => (
                  <button
                    key={document.documentId}
                    type="button"
                    className="project-chip document-chip"
                    title={`Bỏ quyền riêng: ${document.title}`}
                    onClick={() => void handleRemoveDocument(user.id, document.documentId)}
                  >
                    {document.projectCode}/{document.type} x
                  </button>
                ))}
                <button
                  className="icon-btn danger"
                  type="button"
                  title="Xóa mềm user"
                  disabled={user.role === "ADMIN"}
                  onClick={() => void handleDeleteUser(user.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
          {!users.length && (
            <div className="admin-empty">
              <Lock size={18} />
              <span>{loading ? "Đang tải user..." : "Chưa có user nào"}</span>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
