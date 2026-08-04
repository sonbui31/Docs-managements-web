import { useEffect, useState } from "react";
import { MonitorSmartphone, Power, X } from "lucide-react";
import { fetchSessions, logoutAllDevices } from "./authApi";

type Session = {
  id: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  lastUsedAt?: string | null;
  expiresAt: string;
};

type Props = {
  onClose: () => void;
  onLogoutAll: () => void;
};

export function SessionsModal({ onClose, onLogoutAll }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchSessions()
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  async function handleLogoutAll() {
    await logoutAllDevices();
    onLogoutAll();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h3>Phiên đăng nhập</h3>
          <button className="icon-btn" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="session-list">
            {loading && <p>Đang tải phiên đăng nhập...</p>}
            {!loading && sessions.map((session) => (
              <article className="session-row" key={session.id}>
                <MonitorSmartphone size={18} />
                <div>
                  <strong>{session.ipAddress || "Local session"}</strong>
                  <span>{session.userAgent || "Unknown browser"}</span>
                  <small>Hết hạn: {new Date(session.expiresAt).toLocaleString("vi-VN")}</small>
                </div>
              </article>
            ))}
            {!loading && !sessions.length && <p>Không có phiên đăng nhập đang hoạt động.</p>}
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" type="button" onClick={onClose}>Đóng</button>
            <button className="btn-danger" type="button" onClick={() => void handleLogoutAll()}>
              <Power size={16} /> Đăng xuất mọi thiết bị
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
