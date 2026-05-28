import { vi } from "vitest";
import { cleanup } from "@testing-library/react";
import type { User, Word, MistakeRecord, UserStats, StatUpdateResult } from "../types";

vi.mock("lucide-react", () => {
  const icon = (name: string) =>
    function MockIcon({ className, ...props }: { className?: string; [key: string]: unknown }) {
      return <svg data-testid={`icon-${name}`} className={className} {...props} />;
    };

  return {
    LogOut: icon("LogOut"),
    Users: icon("Users"),
    BookX: icon("BookX"),
    Library: icon("Library"),
    Trophy: icon("Trophy"),
    HomeIcon: icon("HomeIcon"),
    Settings: icon("Settings"),
    Sparkles: icon("Sparkles"),
    ChevronDown: icon("ChevronDown"),
    Lock: icon("Lock"),
    KeyRound: icon("KeyRound"),
    X: icon("X"),
    AlertCircle: icon("AlertCircle"),
    CheckCircle2: icon("CheckCircle2"),
    Flame: icon("Flame"),
    Award: icon("Award"),
    Zap: icon("Zap"),
    BookOpen: icon("BookOpen"),
    BrainCircuit: icon("BrainCircuit"),
    RotateCcw: icon("RotateCcw"),
    BarChart3: icon("BarChart3"),
    Target: icon("Target"),
    Play: icon("Play"),
    Pause: icon("Pause"),
    Volume2: icon("Volume2"),
    SkipForward: icon("SkipForward"),
  };
});

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: "testuser",
    role: "user",
    ...overrides,
  };
}

export function createMockStats(overrides: Partial<UserStats> = {}): UserStats {
  return {
    userId: 1,
    xp: 500,
    level: 3,
    streakCount: 5,
    lastActiveDate: new Date().toISOString().split("T")[0],
    totalTestsCompleted: 10,
    totalCorrect: 80,
    totalWrong: 20,
    totalReviewsCompleted: 15,
    wordsLearnedCount: 50,
    ...overrides,
  };
}

export function createMockWord(overrides: Partial<Word> = {}): Word {
  return {
    id: "w1",
    unit: "Unit 1",
    word: "hello",
    phonetic: "/həˈloʊ/",
    meaning: "你好",
    page: "1",
    ownerId: 0,
    ...overrides,
  };
}

export function createMockMistake(overrides: Partial<MistakeRecord> = {}): MistakeRecord {
  return {
    wordId: "w1",
    userId: 1,
    nextReviewDate: Date.now() + 86400000,
    reviewCount: 1,
    ...overrides,
  };
}

beforeEach(() => {
  cleanup();
});
