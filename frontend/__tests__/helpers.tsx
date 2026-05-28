import { vi } from "vitest";
import type { User, Word, MistakeRecord, UserStats } from "../types";

export function createMockUser(overrides: Partial<User> = {}): User {
  return { id: 1, username: "testuser", role: "user", ...overrides };
}

export function createMockStats(overrides: Partial<UserStats> = {}): UserStats {
  return {
    userId: 1, xp: 500, level: 3, streakCount: 5,
    lastActiveDate: new Date().toISOString().split("T")[0],
    totalTestsCompleted: 10, totalCorrect: 80, totalWrong: 20,
    totalReviewsCompleted: 15, wordsLearnedCount: 50,
    ...overrides,
  };
}

export function createMockWord(overrides: Partial<Word> = {}): Word {
  return {
    id: "w1", unit: "Unit 1", word: "hello", phonetic: "/həˈloʊ/",
    meaning: "你好", page: "1", ownerId: 0, ...overrides,
  };
}

export function createMockMistake(overrides: Partial<MistakeRecord> = {}): MistakeRecord {
  return {
    wordId: "w1", userId: 1, nextReviewDate: Date.now() + 86400000,
    reviewCount: 1, ...overrides,
  };
}

export function mockDbModule() {
  return {
    getWords: vi.fn<() => Promise<Word[]>>().mockResolvedValue([]),
    getMistakes: vi.fn<() => Promise<MistakeRecord[]>>().mockResolvedValue([]),
    getUserStats: vi.fn<() => Promise<UserStats>>().mockResolvedValue(createMockStats()),
    updateUserStats: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    getSecurityQuestions: vi.fn<() => Promise<string[]>>().mockResolvedValue(["Q1", "Q2"]),
    getSecurityQuestionForUser: vi.fn(),
    resetPassword: vi.fn(),
    changePassword: vi.fn(),
    updateAvatar: vi.fn(),
    clearSession: vi.fn(),
    addWords: vi.fn(),
    clearAllUserData: vi.fn(),
    addOrUpdateMistakes: vi.fn(),
    removeMistake: vi.fn(),
  };
}

export type MockDb = ReturnType<typeof mockDbModule>;
