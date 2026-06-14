// 前端公开用户类型（不含密码哈希）
export interface User {
  id: number;
  username: string;
  role: "admin" | "user";
  avatar?: string;
}

export interface Word {
  id: string;
  unit: string;
  word: string;
  phonetic: string;
  meaning: string;
  page?: string;
  ownerId: number;
  publisher?: string;
  grade?: number;
  semester?: string;
}

export type MistakeType = "wrong" | "dont_know" | "not_sure";

export interface MistakeRecord {
  id?: number;
  wordId: string;
  userId: number;
  nextReviewDate: number;
  reviewCount: number;
  mistakeType?: MistakeType;
}

export type ViewState =
  | "home"
  | "test"
  | "manage"
  | "user_management"
  | "error_book"
  | "word_library"
  | "irregular_verbs";

export interface TestConfig {
  mode: "unit" | "review";
  unitName?: string;
  words: Word[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface UserStats {
  userId: number;
  xp: number;
  level: number;
  streakCount: number;
  lastActiveDate: string | null;
  totalTestsCompleted: number;
  totalCorrect: number;
  totalWrong: number;
  totalReviewsCompleted: number;
  wordsLearnedCount: number;
}

export interface UserAchievement {
  id: number;
  userId: number;
  achievementId: string;
  unlockedAt: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export interface StatUpdateResult {
  stats: UserStats;
  xpEarned: number;
  newAchievements: { id: string; name: string; icon: string }[];
}

export interface PausedTest {
  config: TestConfig;
  questions: Word[];
  currentIndex: number;
  answers: Record<string, { input: string; isCorrect: boolean }>;
}
