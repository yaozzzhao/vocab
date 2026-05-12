export interface User {
  id: number;
  username: string;
  passwordHash: string;
  role: 'admin' | 'user';
}

export interface Word {
  id: string;
  unit: string;
  word: string;
  phonetic: string;
  meaning: string;
  page?: string;
  ownerId: number; // Foreign key to User
}

export interface MistakeRecord {
  id?: number;
  wordId: string;
  userId: number; // Foreign key to User
  nextReviewDate: number; // timestamp
  reviewCount: number;
}

export type ViewState = 'home' | 'test' | 'manage' | 'user_management' | 'error_book';

export interface TestConfig {
  mode: 'unit' | 'review';
  unitName?: string;
  words: Word[];
}
