import React, { useState } from "react";
import {
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
  MessageSquare
} from "lucide-react";
import { forgotPassword, login, register, resetPassword } from "./authApi";
import type { User } from "./types";

interface AuthPageProps {
  initialMode?: "login" | "register" | "forgot" | "reset";
  onSuccess: (user: User) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = "login", onSuccess }) => {
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(initialMode);
  
  // Login Form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setErrorMsg("Vui lòng nhập đầy đủ Email và Mật khẩu!");
      return;
    }

    setErrorMsg(null);
    setLoading(true);
    try {
      const user = await login(loginEmail, loginPassword);
      onSuccess(user);
    } catch (err: any) {
      setErrorMsg(err.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword) {
      setErrorMsg("Vui lòng điền đầy đủ các thông tin bắt buộc!");
      return;
    }

    if (regPassword.length < 8) {
      setErrorMsg("Mật khẩu phải có ít nhất 8 ký tự!");
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không trùng khớp!");
      return;
    }

    setErrorMsg(null);
    setLoading(true);
    try {
      await register({
        name: regName,
        email: regEmail,
        password: regPassword
      });
      const user = await login(regEmail, regPassword);
      onSuccess(user);
    } catch (err: any) {
      setErrorMsg(err.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const result = await forgotPassword(forgotEmail);
      setDevResetToken(result.resetToken ?? null);
      setMode("reset");
    } catch (err: any) {
      setErrorMsg(err.message || "Không gửi được yêu cầu reset mật khẩu");
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      await resetPassword(resetToken, resetPasswordValue);
      setLoginEmail(forgotEmail);
      setLoginPassword("");
      setResetToken("");
      setResetPasswordValue("");
      setDevResetToken(null);
      setMode("login");
    } catch (err: any) {
      setErrorMsg(err.message || "Không reset được mật khẩu");
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
                <img src="/logo.png" alt="BA DocControl Animated Logo" className="animated-hero-logo" />
                <div className="sparkle-particle p1"><Sparkles size={16} /></div>
                <div className="sparkle-particle p2"><Zap size={14} /></div>
              </div>
            </div>

            <div className="hero-brand-details">
              <h1 className="hero-brand-name">BA DocControl</h1>
              <p className="hero-brand-subtitle">Nền tảng Quản lý Tài liệu Nghiệp vụ BA</p>
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
              <div className="auth-alert error">
                <span>{errorMsg}</span>
              </div>
            )}

            {/* LOGIN FORM */}
            {mode === "login" ? (
              <form onSubmit={handleLoginSubmit} className="auth-form">
                <div className="form-header">
                  <h3>Chào mừng trở lại!</h3>
                  <p>Đăng nhập bằng tài khoản hệ thống của bạn.</p>
                </div>

                <div className="form-group">
                  <label>Địa chỉ Email</label>
                  <div className="input-with-icon">
                    <Mail className="input-icon" size={18} />
                    <input
                      type="email"
                      placeholder="Email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
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
                        setMode("forgot");
                      }}
                      className="forgot-link"
                    >
                      Quên mật khẩu?
                    </a>
                  </div>
                  <div className="input-with-icon">
                    <Lock className="input-icon" size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Nhập mật khẩu"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
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
              <form onSubmit={handleForgotSubmit} className="auth-form">
                <div className="form-header">
                  <h3>Khôi phục mật khẩu</h3>
                  <p>Nhập email tài khoản để tạo yêu cầu đặt lại mật khẩu.</p>
                </div>

                <div className="form-group">
                  <label>Địa chỉ Email</label>
                  <div className="input-with-icon">
                    <Mail className="input-icon" size={18} />
                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="submit-btn primary" disabled={loading}>
                  <span>{loading ? "Đang tạo token..." : "Tiếp tục"}</span>
                  <ArrowRight size={18} />
                </button>
                <button type="button" className="auth-link-button" onClick={() => setMode("login")}>
                  Quay lại đăng nhập
                </button>
              </form>
            ) : mode === "reset" ? (
              <form onSubmit={handleResetSubmit} className="auth-form">
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
                  <div className="input-with-icon">
                    <KeyRound className="input-icon" size={18} />
                    <input
                      type="text"
                      placeholder="Dán token reset"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Mật khẩu mới</label>
                  <div className="input-with-icon">
                    <Lock className="input-icon" size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Tối thiểu 8 ký tự"
                      value={resetPasswordValue}
                      onChange={(e) => setResetPasswordValue(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="submit-btn primary" disabled={loading}>
                  <span>{loading ? "Đang lưu..." : "Đặt lại mật khẩu"}</span>
                  <ArrowRight size={18} />
                </button>
                <button type="button" className="auth-link-button" onClick={() => setMode("login")}>
                  Quay lại đăng nhập
                </button>
              </form>
            ) : (
              /* REGISTER FORM */
              <form onSubmit={handleRegisterSubmit} className="auth-form">
                <div className="form-header">
                  <h3>Tạo tài khoản mới</h3>
                  <p>Trải nghiệm đầy đủ tính năng quản lý tài liệu BA.</p>
                </div>

                <div className="form-group">
                  <label>Họ và Tên <span className="req-star">*</span></label>
                  <div className="input-with-icon">
                    <UserIcon className="input-icon" size={18} />
                    <input
                      type="text"
                      placeholder="Nguyễn Văn A"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Địa chỉ Email <span className="req-star">*</span></label>
                  <div className="input-with-icon">
                    <Mail className="input-icon" size={18} />
                    <input
                      type="email"
                      placeholder="nguyenvana@company.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>
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
                  <div className="input-with-icon">
                    <Lock className="input-icon" size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Nhập mật khẩu (tối thiểu 8 ký tự)"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
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
                  <div className="input-with-icon">
                    <KeyRound className="input-icon" size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Nhập lại mật khẩu"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
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
