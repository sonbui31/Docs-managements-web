import type { ProjectRole, User, UserRole, UserStatus } from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api/v1";
const ACCESS_TOKEN_KEY = "ba_docs_access_token";
const AUTH_USER_KEY = "ba_docs_current_user";

type AuthResponse = {
  user: User;
  accessToken: string;
};

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(response: AuthResponse) {
  localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(response.user));
  return response.user;
}

export function clearAuthSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

export async function authFetch<T>(path: string, options?: RequestInit, retry = true): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers
    }
  });

  if (response.status === 401 && retry) {
    const refreshed = await refreshSession().catch(() => null);
    if (refreshed) return authFetch<T>(path, options, false);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `API error ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const response = await authFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  }, false);
  return setAuthSession(response);
}

export async function register(payload: { name: string; email: string; password: string }) {
  return authFetch<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  }, false);
}

export async function refreshSession() {
  const response = await authFetch<AuthResponse>("/auth/refresh", { method: "POST" }, false);
  return setAuthSession(response);
}

export async function fetchCurrentUser() {
  const user = await authFetch<User>("/auth/me");
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  return user;
}

export async function logout() {
  try {
    await authFetch<{ ok: boolean }>("/auth/logout", { method: "POST" }, false);
  } finally {
    clearAuthSession();
  }
}

export async function forgotPassword(email: string) {
  return authFetch<{ ok: boolean; resetToken?: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email })
  }, false);
}

export async function resetPassword(token: string, password: string) {
  return authFetch<{ ok: boolean }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password })
  }, false);
}

export type ManagedUser = User & {
  sessions: number;
  projects: Array<{
    projectId: string;
    code: string;
    name: string;
    role: ProjectRole;
    roles?: ProjectRole[];
  }>;
  documents: Array<{
    documentId: string;
    projectId: string;
    projectCode: string;
    title: string;
    type: string;
    role: ProjectRole;
    roles?: ProjectRole[];
  }>;
};

export async function fetchUsers() {
  return authFetch<ManagedUser[]>("/users");
}

export async function createUser(payload: { name: string; email: string; password: string; role: UserRole }) {
  return authFetch<User>("/users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateUser(
  id: string,
  payload: Partial<{ name: string; email: string; role: UserRole; status: UserStatus }>
) {
  return authFetch<User>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteUser(id: string) {
  return authFetch<{ ok: boolean }>(`/users/${id}`, { method: "DELETE" });
}

function rolePayload(role: ProjectRole | ProjectRole[]) {
  return Array.isArray(role) ? { roles: role } : { role };
}

export async function assignUserToProject(userId: string, projectId: string, role: ProjectRole | ProjectRole[]) {
  return authFetch<{ id: string }>(`/users/${userId}/projects`, {
    method: "POST",
    body: JSON.stringify({ projectId, ...rolePayload(role) })
  });
}

export async function assignUsersToProjects(userIds: string[], projectIds: string[], role: ProjectRole | ProjectRole[]) {
  return authFetch<{ ok: boolean; assigned: number }>("/users/batch/projects", {
    method: "POST",
    body: JSON.stringify({ userIds, projectIds, ...rolePayload(role) })
  });
}

export async function removeUserFromProject(userId: string, projectId: string) {
  return authFetch<{ ok: boolean }>(`/users/${userId}/projects/${projectId}`, { method: "DELETE" });
}

export async function assignUserToDocument(userId: string, documentId: string, role: ProjectRole | ProjectRole[]) {
  return authFetch<{ id: string }>(`/users/${userId}/documents`, {
    method: "POST",
    body: JSON.stringify({ documentId, ...rolePayload(role) })
  });
}

export async function assignUsersToDocuments(userIds: string[], documentIds: string[], role: ProjectRole | ProjectRole[]) {
  return authFetch<{ ok: boolean; assigned: number }>("/users/batch/documents", {
    method: "POST",
    body: JSON.stringify({ userIds, documentIds, ...rolePayload(role) })
  });
}

export async function removeUserFromDocument(userId: string, documentId: string) {
  return authFetch<{ ok: boolean }>(`/users/${userId}/documents/${documentId}`, { method: "DELETE" });
}
