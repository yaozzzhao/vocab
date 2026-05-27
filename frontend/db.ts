/**
 * frontend/db.ts — API 客户端，替换原来的 IndexedDB 实现
 * 保留原有函数签名，改为调用后端 /api/* 接口
 */

import type { User, Word, MistakeRecord, UserStats, UserAchievement, StatUpdateResult } from "./types";

// ── Session 管理 ─────────────────────────────────────────────────────────────

export function setSession(user: User, token: string): void {
  sessionStorage.setItem("currentUser", JSON.stringify(user));
  sessionStorage.setItem("authToken", token);
}

export function clearSession(): void {
  sessionStorage.removeItem("currentUser");
  sessionStorage.removeItem("authToken");
}

export function getAuthToken(): string | null {
  return sessionStorage.getItem("authToken");
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

// ── 通用请求工具 ──────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options?.headers ?? {}) },
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error ?? `Request failed with status ${res.status}`);
  }
  return data.data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(
  username: string,
  password: string,
): Promise<{ user: User; token: string }> {
  const result = await apiFetch<{ user: User; token: string }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
  );
  setSession(result.user, result.token);
  return result;
}

export async function register(
  username: string,
  password: string,
  securityQuestion?: string,
  securityAnswer?: string,
): Promise<{ user: User; token: string }> {
  const result = await apiFetch<{ user: User; token: string }>(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ username, password, securityQuestion, securityAnswer }),
    },
  );
  setSession(result.user, result.token);
  return result;
}

export async function getSecurityQuestions(): Promise<string[]> {
  const result = await apiFetch<{ questions: string[] }>("/api/auth/security-questions");
  return result.questions;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiFetch("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function getSecurityQuestionForUser(
  username: string,
): Promise<{ question: string; userId: number }> {
  return apiFetch<{ question: string; userId: number }>("/api/auth/security-question", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export async function resetPassword(
  userId: number,
  securityAnswer: string,
  newPassword: string,
): Promise<void> {
  await apiFetch("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ userId, securityAnswer, newPassword }),
  });
}

// ── User Functions (保留原有签名，管理功能用) ─────────────────────────────────

export const addUser = async (_user: Omit<User, "id">): Promise<void> => {
  // 注册已通过 register() 处理，此函数保留以兼容旧调用
  throw new Error("Use register() instead of addUser() directly.");
};

export const getUser = async (_username: string): Promise<User | undefined> => {
  // 登录已通过 login() 处理，此函数保留以兼容旧调用
  throw new Error("Use login() instead of getUser() directly.");
};

export const getAllUsers = async (): Promise<User[]> => {
  const result = await apiFetch<{ users: User[] }>("/api/users");
  return result.users;
};

export const updateUser = async (user: User): Promise<void> => {
  await apiFetch<{ user: User }>(`/api/users/${user.id}`, {
    method: "PATCH",
    body: JSON.stringify({ role: user.role }),
  });
};

// ── Word Functions ────────────────────────────────────────────────────────────

export const addWords = async (
  words: Omit<Word, "id" | "ownerId">[],
  ownerId: number,
): Promise<void> => {
  await apiFetch("/api/words/bulk", {
    method: "POST",
    body: JSON.stringify({ ownerId, words }),
  });
};

export const getWords = async (ownerId?: number): Promise<Word[]> => {
  const url = ownerId != null ? `/api/words?ownerId=${ownerId}` : "/api/words";
  const result = await apiFetch<{ words: Word[] }>(url);
  return result.words;
};

export const clearAllUserData = async (userId: number): Promise<void> => {
  await apiFetch(`/api/users/${userId}/data`, { method: "DELETE" });
};

// ── Word Library Management (管理员功能) ──────────────────────────────────────

export const updateWord = async (
  wordId: string,
  ownerId: number | null,
  updates: Partial<Omit<Word, "id" | "ownerId">>,
): Promise<Word> => {
  const ownerParam = ownerId != null ? `?ownerId=${ownerId}` : "?ownerId=null";
  const result = await apiFetch<{ word: Word }>(
    `/api/words/${encodeURIComponent(wordId)}${ownerParam}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    },
  );
  return result.word;
};

export const deleteWord = async (
  wordId: string,
  ownerId: number | null,
): Promise<void> => {
  const ownerParam = ownerId != null ? `?ownerId=${ownerId}` : "?ownerId=null";
  await apiFetch(
    `/api/words/${encodeURIComponent(wordId)}${ownerParam}`,
    {
      method: "DELETE",
    },
  );
};

export const deleteWords = async (
  wordIds: string[],
  ownerId: number | null,
): Promise<void> => {
  await apiFetch("/api/words/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ ownerId, wordIds }),
  });
};

export const exportWords = async (): Promise<Word[]> => {
  const result = await apiFetch<{ words: Word[] }>("/api/words/export");
  return result.words;
};

// ── Mistake Functions ─────────────────────────────────────────────────────────

export const getMistakes = async (userId: number): Promise<MistakeRecord[]> => {
  const result = await apiFetch<{ mistakes: MistakeRecord[] }>(
    `/api/mistakes?userId=${userId}`,
  );
  return result.mistakes;
};

export const addOrUpdateMistakes = async (
  mistakes: Omit<MistakeRecord, "id">[],
): Promise<void> => {
  await apiFetch("/api/mistakes/bulk", {
    method: "POST",
    body: JSON.stringify({ mistakes }),
  });
};

export const removeMistake = async (
  wordId: string,
  userId: number,
): Promise<void> => {
  await apiFetch(
    `/api/mistakes/${encodeURIComponent(wordId)}?userId=${userId}`,
    {
      method: "DELETE",
    },
  );
};

// ── Gamification API ──────────────────────────────────────────────────────────

export const getUserStats = async (): Promise<UserStats> => {
  const result = await apiFetch<{ stats: UserStats }>("/api/user/stats");
  return result.stats;
};

export const updateUserStats = async (payload: {
  correctCount: number;
  wrongCount: number;
  mode: "unit" | "review";
  wordIds?: string[];
}): Promise<StatUpdateResult> => {
  const result = await apiFetch<StatUpdateResult>("/api/user/stats", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result;
};

export const getUserAchievements = async (): Promise<UserAchievement[]> => {
  const result = await apiFetch<{ achievements: UserAchievement[] }>(
    "/api/user/achievements",
  );
  return result.achievements;
};
