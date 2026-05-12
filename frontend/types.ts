// 前端公开用户类型（不含密码哈希）
export interface User {
  id: number;
  username: string;
  role: "admin" | "user";
}

export interface Word {
  id: string;
  unit: string;
  word: string;
  phonetic: string;
  meaning: string;
  page?: string;
  ownerId: number;
}

export interface MistakeRecord {
  id?: number;
  wordId: string;
  userId: number;
  nextReviewDate: number;
  reviewCount: number;
}

export type ViewState =
  | "home"
  | "test"
  | "manage"
  | "user_management"
  | "error_book"
  | "word_library";

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
