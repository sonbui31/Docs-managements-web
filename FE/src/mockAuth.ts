import type { User, UserRole } from "./types";

const AUTH_USER_KEY = "ba_docs_current_user";
const MOCK_USERS_KEY = "ba_docs_mock_users";

export const DEFAULT_MOCK_USER: User = {
  id: "usr-default-001",
  email: "admin@docs.vn",
  name: "Nguyễn Văn Admin",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  role: "ADMIN",
  department: "Khối Phân tích Nghiệp vụ",
  createdAt: "2026-01-15T08:00:00Z"
};

export const MOCK_PRESET_ACCOUNTS = [
  {
    user: DEFAULT_MOCK_USER,
    password: "123"
  },
  {
    user: {
      id: "usr-default-002",
      email: "ba.analyst@docs.vn",
      name: "Trần Thị Thu Hà",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      role: "EMPLOYEE" as UserRole,
      department: "Team CRM & Fintech",
      createdAt: "2026-02-01T09:30:00Z"
    },
    password: "123"
  }
];

// Initialize default mock database in localStorage if empty
function initializeMockUsers() {
  const existing = localStorage.getItem(MOCK_USERS_KEY);
  if (!existing) {
    const initialList = MOCK_PRESET_ACCOUNTS.map((acc) => ({
      ...acc.user,
      password: acc.password
    }));
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(initialList));
  }
}

export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User | null): void {
  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_USER_KEY);
  }
}

export async function mockLoginApi(email: string, password: string): Promise<User> {
  initializeMockUsers();
  // Simulate net delay
  await new Promise((resolve) => setTimeout(resolve, 600));

  const rawUsers = localStorage.getItem(MOCK_USERS_KEY);
  const users = rawUsers ? JSON.parse(rawUsers) : [];

  const found = users.find(
    (u: any) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
  );

  if (!found) {
    throw new Error("Email hoặc mật khẩu không chính xác. Mẹo: Dùng email 'admin@docs.vn' / mật khẩu '123' để thử!");
  }

  const { password: _, ...userObj } = found;
  setCurrentUser(userObj);
  return userObj;
}

export async function mockRegisterApi(data: {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
  department?: string;
}): Promise<User> {
  initializeMockUsers();
  await new Promise((resolve) => setTimeout(resolve, 700));

  const rawUsers = localStorage.getItem(MOCK_USERS_KEY);
  const users = rawUsers ? JSON.parse(rawUsers) : [];

  const emailExists = users.some(
    (u: any) => u.email.toLowerCase() === data.email.trim().toLowerCase()
  );

  if (emailExists) {
    throw new Error("Email này đã được đăng ký tài khoản trong hệ thống!");
  }

  const newUser: User = {
    id: `usr-${Date.now()}`,
    email: data.email.trim(),
    name: data.name.trim(),
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.name)}`,
    role: data.role || "EMPLOYEE",
    department: data.department || "Phòng Nghiệp vụ",
    createdAt: new Date().toISOString()
  };

  users.push({
    ...newUser,
    password: data.password
  });

  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
  setCurrentUser(newUser);
  return newUser;
}

export function mockLogout(): void {
  setCurrentUser(null);
}
