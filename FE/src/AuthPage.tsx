import React, { useState } from "react";
import {
  AlertCircle,
  FileText,
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Eye,
  EyeOff,
  Briefcase,
  Layers,
  KeyRound,
  Zap,
  BookOpen,
  Check,
  Building2,
  FileCheck,
  MessageSquare,
  X
} from "lucide-react";
import { forgotPassword, login, register, resetPassword } from "./authApi";
import { getErrorMessage } from "./apiError";
import type { User } from "./types";

interface AuthPageProps {
  initialMode?: "login" | "register" | "forgot" | "reset";
  onSuccess: (user: User) => void;
}

const RECENT_ACCOUNTS_KEY = "docspace_recent_accounts";

export type RecentAccount = {
  email: string;
  name?: string;
  role?: string;
};

const DEFAULT_RECENT_ACCOUNTS: RecentAccount[] = [
  { email: "admin@docs.vn", name: "System Admin", role: "Admin" },
  { email: "son@yopmail.com", name: "Son Bui", role: "Manager" }
];

export function getRecentAccounts(): RecentAccount[] {
  try {
    const raw = localStorage.getItem(RECENT_ACCOUNTS_KEY);
    if (!raw) return DEFAULT_RECENT_ACCOUNTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.slice(0, 2) : DEFAULT_RECENT_ACCOUNTS;
  } catch {
    return DEFAULT_RECENT_ACCOUNTS;
  }
}

export function saveRecentAccount(account: RecentAccount) {
  try {
    const current = getRecentAccounts();
    const filtered = current.filter((item) => item.email.toLowerCase() !== account.email.toLowerCase());
    const updated = [account, ...filtered].slice(0, 2);
    localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error(err);
  }
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = "login", onSuccess }) => {
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(initialMode);

  // Login Form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [recentAccounts, setRecentAccounts] = useState<RecentAccount[]>(() => getRecentAccounts());

  // Register Form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regDepartment, setRegDepartment] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [devResetToken, setDevResetToken] = useState<string | null>(null);

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Helper to format backend / network error messages nicely
  const formatAuthErrorMessage = (error: any): string => {
    const rawMessage = typeof error === "string" ? error : error?.message || error?.toString() || "";

    if (rawMessage.includes("Failed to fetch") || rawMessage.includes("NetworkError") || rawMessage.includes("ECONNREFUSED")) {
      return "Không thể kết nối đến Backend Server (NestJS Port 3000). Vui lòng kiểm tra lại dịch vụ!";
    }
    const apiMessage = getErrorMessage(error, "");
    if (apiMessage) return apiMessage;

    if (rawMessage.includes("401") || rawMessage.includes("Invalid credentials") || rawMessage.includes("Unauthorized")) {
      return "Tài khoản hoặc Mật khẩu không chính xác. Vui lòng kiểm tra lại!";
    }
    if (rawMessage.includes("404") || rawMessage.includes("User not found")) {
      return "Tài khoản email này chưa được đăng ký trên hệ thống!";
    }
    if (rawMessage.includes("400") || rawMessage.includes("Bad Request")) {
      return "Thông tin nhập vào không hợp lệ. Vui lòng kiểm tra định dạng email và mật khẩu!";
    }
    if (rawMessage.includes("403") || rawMessage.includes("Forbidden") || rawMessage.includes("locked")) {
      return "Tài khoản của bạn tạm thời bị khóa hoặc không có quyền truy cập!";
    }
    return rawMessage || "Đăng nhập thất bại. Vui lòng thử lại!";
  };

  // Clear single field error when user types
  const clearFieldError = (fieldName: string) => {
    if (fieldErrors[fieldName]) {
      setFieldErrors((prev) => ({ ...prev, [fieldName]: "" }));
    }
    if (errorMsg) {
      setErrorMsg(null);
    }
  };

  // Compute password strength score (0 to 100)
  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 3) score += 30;
    if (pass.length >= 6) score += 30;
    if (/[A-Z]/.test(pass) || /[0-9]/.test(pass)) score += 20;
    if (/[^A-Za-z0-9]/.test(pass)) score += 20;
    return Math.min(score, 100);
  };

  const passStrength = getPasswordStrength(regPassword);

  const handleRemoveRecentAccount = (emailToRemove: string) => {
    const updated = recentAccounts.filter((acc) => acc.email.toLowerCase() !== emailToRemove.toLowerCase());
    setRecentAccounts(updated);
    try {
      localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setErrorMsg(null);

    const cleanEmail = loginEmail.trim();
    const cleanPass = loginPassword.trim();
    const errors: Record<string, string> = {};

    if (!cleanEmail) {
      errors.loginEmail = "Vui lòng nhập địa chỉ Email của bạn";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        errors.loginEmail = "Định dạng Email không hợp lệ (ví dụ: admin@docs.vn)";
      }
    }

    if (!cleanPass) {
      errors.loginPassword = "Vui lòng nhập Mật khẩu đăng nhập";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const user = await login(cleanEmail, cleanPass);
      saveRecentAccount({ email: user.email, name: user.name, role: user.role });
      setRecentAccounts(getRecentAccounts());
      onSuccess(user);
    } catch (err: any) {
      setErrorMsg(formatAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setErrorMsg(null);

    const cleanName = regName.trim();
    const cleanEmail = regEmail.trim();
    const cleanPass = regPassword.trim();
    const cleanConfirm = regConfirmPassword.trim();
    const errors: Record<string, string> = {};

    if (!cleanName) {
      errors.regName = "Vui lòng nhập Họ và Tên";
    }
    if (!cleanEmail) {
      errors.regEmail = "Vui lòng nhập địa chỉ Email đăng ký";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        errors.regEmail = "Định dạng Email không hợp lệ (ví dụ: name@company.com)";
      }
    }

    if (!cleanPass) {
      errors.regPassword = "Vui lòng nhập Mật khẩu";
    } else if (cleanPass.length < 8) {
      errors.regPassword = "Mật khẩu phải có độ dài tối thiểu 8 ký tự";
    }

    if (!cleanConfirm) {
      errors.regConfirmPassword = "Vui lòng xác nhận lại Mật khẩu";
    } else if (cleanPass && cleanPass !== cleanConfirm) {
      errors.regConfirmPassword = "Mật khẩu xác nhận không trùng khớp với mật khẩu đã nhập";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await register({
        name: cleanName,
        email: cleanEmail,
        password: cleanPass
      });
      const user = await login(cleanEmail, cleanPass);
      onSuccess(user);
    } catch (err: any) {
      setErrorMsg(formatAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setErrorMsg(null);

    const cleanEmail = forgotEmail.trim();
    if (!cleanEmail) {
      setFieldErrors({ forgotEmail: "Vui lòng nhập địa chỉ Email của bạn" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setFieldErrors({ forgotEmail: "Định dạng Email không hợp lệ (ví dụ: name@company.com)" });
      return;
    }

    setLoading(true);
    try {
      const result = await forgotPassword(cleanEmail);
      setDevResetToken(result.resetToken ?? null);
      setMode("reset");
    } catch (err: any) {
      setErrorMsg(formatAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setErrorMsg(null);

    const errors: Record<string, string> = {};
    if (!resetToken.trim()) {
      errors.resetToken = "Vui lòng nhập mã Reset Token";
    }
    if (!resetPasswordValue.trim()) {
      errors.resetPasswordValue = "Vui lòng nhập mật khẩu mới";
    } else if (resetPasswordValue.trim().length < 8) {
      errors.resetPasswordValue = "Mật khẩu mới phải có ít nhất 8 ký tự";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await resetPassword(resetToken.trim(), resetPasswordValue.trim());
      setLoginEmail(forgotEmail);
      setLoginPassword("");
      setResetToken("");
      setResetPasswordValue("");
      setDevResetToken(null);
      setMode("login");
    } catch (err: any) {
      setErrorMsg(formatAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (

    <div className="auth-wrapper">
      {/* Ambient Animated Blobs */}
      <div className="auth-ambient-bg">
        <div className="ambient-blob blob-1"></div>
        <div className="ambient-blob blob-2"></div>
        <div className="ambient-blob blob-3"></div>
      </div>

      <div className="auth-container">
        {/* Left Side: Brand Showcase Banner */}
        <div className="auth-banner">
          <div className="animated-logo-hero">
            <div className="logo-motion-container">
              <div className="logo-aura-ring ring-1"></div>
              <div className="logo-aura-ring ring-2"></div>
              <div className="logo-floating-box">
                <img src="/logo.png" alt="ProjectSpace Animated Logo" className="animated-hero-logo" />
                <div className="sparkle-particle p1"><Sparkles size={16} /></div>
                <div className="sparkle-particle p2"><Zap size={14} /></div>
              </div>
            </div>

            <div className="hero-brand-details">
              <h1 className="hero-brand-name">ProjectSpace</h1>
              <p className="hero-brand-subtitle">Nền tảng quản lý dự án</p>
              <div className="hero-status-badge">
                <span className="pulse-dot"></span> System Operational
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Form Card */}
        <div className="auth-card-wrapper">
          <div className="auth-card">
            {/* Tab Switcher Header */}
            <div className="auth-header-tabs">
              <button
                type="button"
                className={`auth-tab ${mode === "login" ? "active" : ""}`}
                onClick={() => {
                  setMode("login");
                  setErrorMsg(null);
                }}
              >
                Đăng Nhập
              </button>
              <button
                type="button"
                className={`auth-tab ${mode === "register" ? "active" : ""}`}
                onClick={() => {
                  setMode("register");
                  setErrorMsg(null);
                }}
              >
                Tạo Tài Khoản
              </button>
            </div>

            {errorMsg && (
              <div className="auth-alert error animate-shake" role="alert">
                <AlertCircle size={20} className="alert-icon" />
                <div className="alert-body">
                  <strong>Đã xảy ra lỗi:</strong>
                  <span>{errorMsg}</span>
                </div>
                <button
                  type="button"
                  className="alert-close-btn"
                  onClick={() => setErrorMsg(null)}
                  title="Đóng thông báo"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* LOGIN FORM */}
            {mode === "login" ? (
              <form onSubmit={handleLoginSubmit} className="auth-form" noValidate>
                <div className="form-header">
                  <h3>Chào mừng trở lại!</h3>
                  <p>Đăng nhập bằng tài khoản hệ thống của bạn.</p>
                </div>

                {recentAccounts.length > 0 && (
                  <div className="recent-accounts-box">
                    <div className="recent-accounts-header">
                      <Sparkles size={13} className="recent-sparkle-icon" />
                      <span>Gợi ý tài khoản đăng nhập gần đây:</span>
                    </div>
                    <div className="recent-accounts-list">
                      {recentAccounts.map((acc) => (
                        <div
                          key={acc.email}
                          className={`recent-account-chip ${loginEmail.toLowerCase() === acc.email.toLowerCase() ? "active" : ""}`}
                        >
                          <button
                            type="button"
                            className="chip-select-btn"
                            onClick={() => {
                              setLoginEmail(acc.email);
                              clearFieldError("loginEmail");
                            }}
                            title={`Click để điền ${acc.email}`}
                          >
                            <UserIcon size={12} className="chip-icon" />
                            <span className="chip-email-text">{acc.email}</span>
                          </button>
                          <button
                            type="button"
                            className="chip-remove-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveRecentAccount(acc.email);
                            }}
                            title="Xóa tài khoản này khỏi gợi ý"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>Địa chỉ Email</label>
                  <div className={`input-with-icon ${fieldErrors.loginEmail ? "has-error" : ""}`}>
                    <Mail className="input-icon" size={18} />
                    <input
                      type="email"
                      placeholder="Email"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        clearFieldError("loginEmail");
                      }}
                    />
                  </div>
                  {fieldErrors.loginEmail && (
                    <small className="field-error-msg">
                      <AlertCircle size={13} /> {fieldErrors.loginEmail}
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <div className="label-with-link">
                    <label>Mật khẩu</label>
                    <a
                      href="#forgot"
                      onClick={(e) => {
                        e.preventDefault();
                        setForgotEmail(loginEmail);
                        setErrorMsg(null);
                        setFieldErrors({});
                        setMode("forgot");
                      }}
                      className="forgot-link"
                    >
                      Quên mật khẩu?
                    </a>
                  </div>
                  <div className={`input-with-icon ${fieldErrors.loginPassword ? "has-error" : ""}`}>
                    <Lock className="input-icon" size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Nhập mật khẩu"
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        clearFieldError("loginPassword");
                      }}
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {fieldErrors.loginPassword && (
                    <small className="field-error-msg">
                      <AlertCircle size={13} /> {fieldErrors.loginPassword}
                    </small>
                  )}
                </div>

                <button type="submit" className="submit-btn primary" disabled={loading}>
                  {loading ? (
                    <span className="spinner">Đang xác thực...</span>
                  ) : (
                    <>
                      <span>Đăng Nhập Hệ Thống</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
            ) : mode === "forgot" ? (
              <form onSubmit={handleForgotSubmit} className="auth-form" noValidate>
                <div className="form-header">
                  <h3>Khôi phục mật khẩu</h3>
                  <p>Nhập email tài khoản để tạo yêu cầu đặt lại mật khẩu.</p>
                </div>

                <div className="form-group">
                  <label>Địa chỉ Email</label>
                  <div className={`input-with-icon ${fieldErrors.forgotEmail ? "has-error" : ""}`}>
                    <Mail className="input-icon" size={18} />
                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        clearFieldError("forgotEmail");
                      }}
                    />
                  </div>
                  {fieldErrors.forgotEmail && (
                    <small className="field-error-msg">
                      <AlertCircle size={13} /> {fieldErrors.forgotEmail}
                    </small>
                  )}
                </div>

                <button type="submit" className="submit-btn primary" disabled={loading}>
                  <span>{loading ? "Đang tạo token..." : "Tiếp tục"}</span>
                  <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  className="auth-link-button"
                  onClick={() => {
                    setMode("login");
                    setErrorMsg(null);
                    setFieldErrors({});
                  }}
                >
                  Quay lại đăng nhập
                </button>
              </form>
            ) : mode === "reset" ? (
              <form onSubmit={handleResetSubmit} className="auth-form" noValidate>
                <div className="form-header">
                  <h3>Đặt lại mật khẩu</h3>
                  <p>Nhập token reset và mật khẩu mới cho tài khoản.</p>
                </div>

                {devResetToken && (
                  <div className="auth-alert info">
                    <span>Dev reset token: {devResetToken}</span>
                  </div>
                )}

                <div className="form-group">
                  <label>Reset token</label>
                  <div className={`input-with-icon ${fieldErrors.resetToken ? "has-error" : ""}`}>
                    <KeyRound className="input-icon" size={18} />
                    <input
                      type="text"
                      placeholder="Dán token reset"
                      value={resetToken}
                      onChange={(e) => {
                        setResetToken(e.target.value);
                        clearFieldError("resetToken");
                      }}
                    />
                  </div>
                  {fieldErrors.resetToken && (
                    <small className="field-error-msg">
                      <AlertCircle size={13} /> {fieldErrors.resetToken}
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>Mật khẩu mới</label>
                  <div className={`input-with-icon ${fieldErrors.resetPasswordValue ? "has-error" : ""}`}>
                    <Lock className="input-icon" size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Tối thiểu 8 ký tự"
                      value={resetPasswordValue}
                      onChange={(e) => {
                        setResetPasswordValue(e.target.value);
                        clearFieldError("resetPasswordValue");
                      }}
                    />
                  </div>
                  {fieldErrors.resetPasswordValue && (
                    <small className="field-error-msg">
                      <AlertCircle size={13} /> {fieldErrors.resetPasswordValue}
                    </small>
                  )}
                </div>

                <button type="submit" className="submit-btn primary" disabled={loading}>
                  <span>{loading ? "Đang lưu..." : "Đặt lại mật khẩu"}</span>
                  <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  className="auth-link-button"
                  onClick={() => {
                    setMode("login");
                    setErrorMsg(null);
                    setFieldErrors({});
                  }}
                >
                  Quay lại đăng nhập
                </button>
              </form>
            ) : (
              /* REGISTER FORM */
              <form onSubmit={handleRegisterSubmit} className="auth-form" noValidate>
                <div className="form-header">
                  <h3>Tạo tài khoản mới</h3>
                  <p>Trải nghiệm đầy đủ tính năng quản lý tài liệu BA.</p>
                </div>

                <div className="form-group">
                  <label>Họ và Tên <span className="req-star">*</span></label>
                  <div className={`input-with-icon ${fieldErrors.regName ? "has-error" : ""}`}>
                    <UserIcon className="input-icon" size={18} />
                    <input
                      type="text"
                      placeholder="Nguyễn Văn A"
                      value={regName}
                      onChange={(e) => {
                        setRegName(e.target.value);
                        clearFieldError("regName");
                      }}
                    />
                  </div>
                  {fieldErrors.regName && (
                    <small className="field-error-msg">
                      <AlertCircle size={13} /> {fieldErrors.regName}
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>Địa chỉ Email <span className="req-star">*</span></label>
                  <div className={`input-with-icon ${fieldErrors.regEmail ? "has-error" : ""}`}>
                    <Mail className="input-icon" size={18} />
                    <input
                      type="email"
                      placeholder="nguyenvana@company.com"
                      value={regEmail}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        clearFieldError("regEmail");
                      }}
                    />
                  </div>
                  {fieldErrors.regEmail && (
                    <small className="field-error-msg">
                      <AlertCircle size={13} /> {fieldErrors.regEmail}
                    </small>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group half">
                    <label>Vai trò</label>
                    <div className="input-with-icon">
                      <Briefcase className="input-icon" size={18} />
                      <input type="text" value="Nhân viên" disabled />
                    </div>
                  </div>

                  <div className="form-group half">
                    <label>Phòng / Ban</label>
                    <div className="input-with-icon">
                      <Building2 className="input-icon" size={18} />
                      <input
                        type="text"
                        placeholder="Khối Phân tích"
                        value={regDepartment}
                        onChange={(e) => setRegDepartment(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>Mật khẩu <span className="req-star">*</span></label>
                  <div className={`input-with-icon ${fieldErrors.regPassword ? "has-error" : ""}`}>
                    <Lock className="input-icon" size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Nhập mật khẩu (tối thiểu 8 ký tự)"
                      value={regPassword}
                      onChange={(e) => {
                        setRegPassword(e.target.value);
                        clearFieldError("regPassword");
                      }}
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {fieldErrors.regPassword && (
                    <small className="field-error-msg">
                      <AlertCircle size={13} /> {fieldErrors.regPassword}
                    </small>
                  )}
                  {/* Realtime Password Strength Bar */}
                  {regPassword && (
                    <div className="password-strength-container">
                      <div className="strength-bar-track">
                        <div
                          className="strength-bar-fill"
                          style={{
                            width: `${passStrength}%`,
                            backgroundColor:
                              passStrength < 40 ? "#f43f5e" : passStrength < 80 ? "#f59e0b" : "#10b981"
                          }}
                        ></div>
                      </div>
                      <span className="strength-label">
                        Độ mạnh: {passStrength < 40 ? "Yếu" : passStrength < 80 ? "Vừa" : "Mạnh"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Xác nhận Mật khẩu <span className="req-star">*</span></label>
                  <div className={`input-with-icon ${fieldErrors.regConfirmPassword ? "has-error" : ""}`}>
                    <KeyRound className="input-icon" size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Nhập lại mật khẩu"
                      value={regConfirmPassword}
                      onChange={(e) => {
                        setRegConfirmPassword(e.target.value);
                        clearFieldError("regConfirmPassword");
                      }}
                    />
                  </div>
                  {fieldErrors.regConfirmPassword && (
                    <small className="field-error-msg">
                      <AlertCircle size={13} /> {fieldErrors.regConfirmPassword}
                    </small>
                  )}
                </div>

                <button type="submit" className="submit-btn primary" disabled={loading}>
                  {loading ? (
                    <span className="spinner">Đang khởi tạo tài khoản...</span>
                  ) : (
                    <>
                      <span>Hoàn Tất Đăng Ký</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
