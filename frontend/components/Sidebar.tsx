import React from "react";
import { User, UserStats, ViewState } from "../types";
import {
  Sparkles,
  Flame,
  Trophy,
  BookOpen,
  BrainCircuit,
  RotateCcw,
  CheckCircle2,
  XCircle,
  BarChart3,
  Target,
} from "lucide-react";

interface LeftSidebarProps {
  user: User;
  stats: UserStats | null;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ user, stats }) => {
  const xp = stats?.xp ?? 0;
  const level = stats?.level ?? 1;
  const nextLevelXp = level * level * 100;
  const currentLevelXp = (level - 1) * (level - 1) * 100;
  const xpProgress = Math.min(
    ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100,
    100,
  );
  const streak = stats?.streakCount ?? 0;

  return (
    <div className="h-full flex flex-col gap-4">
      {/* User Profile */}
      <div className="flex items-center gap-3 px-1">
        <div className="w-10 h-10 bg-brand-200 rounded-full flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-brand-700">
            {user.username[0].toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-stone-800 text-sm truncate">
            {user.username}
          </p>
          <p className="text-xs text-stone-400 capitalize">{user.role}</p>
        </div>
      </div>

      {/* Level & XP */}
      <div className="bg-white rounded-xl border border-stone-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-sm text-stone-800">Level {level}</span>
          </div>
          <span className="text-xs text-stone-400">{xp} XP</span>
        </div>
        <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden mb-1">
          <div
            className="bg-gradient-to-r from-brand-400 to-brand-600 h-full rounded-full transition-all"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
        <p className="text-[11px] text-stone-400">
          {xp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
        </p>
      </div>

      {/* Streak */}
      <div className="bg-white rounded-xl border border-stone-200 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-stone-700">Streak</span>
          </div>
          <span className="font-bold text-lg text-amber-600">{streak}</span>
        </div>
        <p className="text-[11px] text-stone-400 mt-0.5">consecutive days</p>
      </div>

      {/* Today's Stats */}
      <div className="bg-white rounded-xl border border-stone-200 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3 flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" />
          Today's Stats
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-success-500" />
              Correct
            </span>
            <span className="font-semibold text-stone-700">{stats?.totalCorrect ?? 0}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500 flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              Wrong
            </span>
            <span className="font-semibold text-stone-700">{stats?.totalWrong ?? 0}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-brand-500" />
              Reviews
            </span>
            <span className="font-semibold text-stone-700">{stats?.totalReviewsCompleted ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface RightSidebarProps {
  view: ViewState;
  totalWords: number;
  totalMistakes: number;
  dueReviews: number;
  unitsCount: number;
  onStartReview: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  view,
  totalWords,
  totalMistakes,
  dueReviews,
  unitsCount,
  onStartReview,
}) => {
  if (view === "test") return null;

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Overview Card */}
      <div className="bg-white rounded-xl border border-stone-200 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3 flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5" />
          Overview
        </p>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-brand-500" />
              Units
            </span>
            <span className="font-semibold text-stone-700">{unitsCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
              Words
            </span>
            <span className="font-semibold text-stone-700">{totalWords}</span>
          </div>
        </div>
      </div>

      {/* Error Book Summary */}
      <div className="bg-white rounded-xl border border-stone-200 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3 flex items-center gap-1.5">
          <BrainCircuit className="w-3.5 h-3.5" />
          Error Book
        </p>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">Total mistakes</span>
            <span className="font-semibold text-stone-700">{totalMistakes}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">Due for review</span>
            <span className={`font-semibold ${dueReviews > 0 ? 'text-rose-500' : 'text-stone-700'}`}>
              {dueReviews}
            </span>
          </div>
        </div>
        {dueReviews > 0 && (
          <button
            onClick={onStartReview}
            className="mt-3 w-full py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Review Now
          </button>
        )}
      </div>

      {/* Tip Card */}
      <div className="bg-gradient-to-br from-brand-50 to-indigo-50 rounded-xl border border-brand-100 p-3">
        <p className="text-xs font-semibold text-brand-700 mb-1">💡 Tip</p>
        <p className="text-xs text-stone-600 leading-relaxed">
          Try to review mistake words daily. Spaced repetition helps you remember longer!
        </p>
      </div>
    </div>
  );
};
