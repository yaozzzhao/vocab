import React, { useState, useEffect, useCallback } from "react";
import { Trophy, Flame, Zap, Star, ChevronRight, X, Sparkles } from "lucide-react";
import { UserStats, UserAchievement, AchievementDef } from "../types";
import * as db from "../db";

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: "first_test", name: "First Steps", icon: "🎯", desc: "Complete your first test" },
  { id: "perfect_score", name: "Perfect Score", icon: "💯", desc: "Get 100% on a test (5+ words)" },
  { id: "streak_3", name: "Getting Started", icon: "🔥", desc: "3-day study streak" },
  { id: "streak_7", name: "Week Warrior", icon: "🔥", desc: "7-day study streak" },
  { id: "streak_30", name: "Monthly Master", icon: "🔥", desc: "30-day study streak" },
  { id: "words_10", name: "Vocabulary Novice", icon: "📖", desc: "Learn 10 words" },
  { id: "words_50", name: "Vocabulary Learner", icon: "📖", desc: "Learn 50 words" },
  { id: "words_100", name: "Vocabulary Builder", icon: "📚", desc: "Learn 100 words" },
  { id: "words_500", name: "Vocabulary Master", icon: "📚", desc: "Learn 500 words" },
  { id: "reviews_10", name: "Reviewer", icon: "🔄", desc: "Complete 10 review sessions" },
  { id: "reviews_50", name: "Dedicated Reviewer", icon: "🔄", desc: "Complete 50 review sessions" },
  { id: "reviews_100", name: "Review Legend", icon: "🔄", desc: "Complete 100 review sessions" },
  { id: "speed_demon", name: "Speed Demon", icon: "⚡", desc: "Answer 10+ words all correctly in one test" },
];

const LEVEL_XP_BASE = 100;

function xpForLevel(level: number): number {
  return LEVEL_XP_BASE * (level * level);
}

function levelProgress(xp: number): { currentLevel: number; nextLevelXp: number; currentXp: number } {
  const level = Math.floor(Math.sqrt(xp / LEVEL_XP_BASE)) + 1;
  const currentLevelXp = xpForLevel(level - 1);
  const nextLevelXp = xpForLevel(level);
  const currentXp = xp - currentLevelXp;
  const neededXp = nextLevelXp - currentLevelXp;
  return { currentLevel: level, nextLevelXp: neededXp, currentXp: Math.max(0, currentXp) };
}

interface Toast {
  id: string;
  message: string;
  icon: string;
}

interface GamificationHubProps {
  stats: UserStats | null;
  onClose: () => void;
  newAchievementToasts: Toast[];
  onDismissToast: (id: string) => void;
}

export const GamificationHub: React.FC<GamificationHubProps> = ({
  stats,
  onClose,
  newAchievementToasts,
  onDismissToast,
}) => {
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);

  useEffect(() => {
    db.getUserAchievements().then(setAchievements).catch(() => {});
  }, []);

  if (!stats) return null;

  const { currentLevel, nextLevelXp, currentXp } = levelProgress(stats.xp);
  const unlockedIds = new Set(achievements.map((a) => a.achievementId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-serif font-bold text-stone-900 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            Your Progress
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-stone-100 transition-colors text-stone-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Level & XP Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-slate-300 font-medium">Level</p>
                <p className="text-5xl font-bold font-serif">{currentLevel}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-300 font-medium">Total XP</p>
                <p className="text-3xl font-bold">{stats.xp.toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-sm text-slate-300 mb-1">
                <span>Level Progress</span>
                <span>{currentXp} / {nextLevelXp} XP</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-400 to-amber-300 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (currentXp / nextLevelXp) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-stone-50 rounded-xl p-4 text-center border border-stone-200">
              <Flame className="w-6 h-6 text-orange-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-stone-800">{stats.streakCount}</p>
              <p className="text-xs text-stone-500">Day Streak</p>
            </div>
            <div className="bg-stone-50 rounded-xl p-4 text-center border border-stone-200">
              <Star className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-stone-800">{stats.wordsLearnedCount}</p>
              <p className="text-xs text-stone-500">Words Learned</p>
            </div>
            <div className="bg-stone-50 rounded-xl p-4 text-center border border-stone-200">
              <Zap className="w-6 h-6 text-blue-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-stone-800">{stats.totalTestsCompleted}</p>
              <p className="text-xs text-stone-500">Tests Done</p>
            </div>
          </div>

          {/* Accuracy */}
          {stats.totalCorrect + stats.totalWrong > 0 && (
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
              <p className="text-sm text-stone-500 mb-2">Overall Accuracy</p>
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e7e5e4" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.5" fill="none" stroke="#1e293b"
                      strokeWidth="3" strokeDasharray={`${(stats.totalCorrect / (stats.totalCorrect + stats.totalWrong)) * 100} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-stone-800">
                    {Math.round((stats.totalCorrect / (stats.totalCorrect + stats.totalWrong)) * 100)}%
                  </span>
                </div>
                <div className="text-sm text-stone-600">
                  <span className="text-green-600 font-medium">{stats.totalCorrect} correct</span>
                  {" / "}
                  <span className="text-red-500 font-medium">{stats.totalWrong} wrong</span>
                </div>
              </div>
            </div>
          )}

          {/* Achievements */}
          <div>
            <h3 className="text-lg font-serif font-bold text-stone-900 mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Achievements
              <span className="text-sm font-sans font-normal text-stone-400">
                ({unlockedIds.size} / {ACHIEVEMENT_DEFS.length})
              </span>
            </h3>
            <div className="space-y-2">
              {ACHIEVEMENT_DEFS.map((def) => {
                const unlocked = unlockedIds.has(def.id);
                return (
                  <div
                    key={def.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      unlocked
                        ? "bg-amber-50 border-amber-200"
                        : "bg-stone-50 border-stone-200 opacity-50"
                    }`}
                  >
                    <span className="text-2xl">{unlocked ? def.icon : "🔒"}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${unlocked ? "text-stone-900" : "text-stone-500"}`}>
                        {def.name}
                      </p>
                      <p className="text-xs text-stone-500 truncate">{def.desc}</p>
                    </div>
                    {unlocked && (
                      <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Achievement Toasts */}
      {newAchievementToasts.length > 0 && (
        <div className="fixed bottom-6 right-6 space-y-2 z-50">
          {newAchievementToasts.map((toast) => (
            <div
              key={toast.id}
              className="flex items-center gap-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-3 rounded-xl shadow-lg animate-slide-up"
            >
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">{toast.icon} {toast.message}</span>
              <button
                onClick={() => onDismissToast(toast.id)}
                className="ml-2 text-white/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface XpPopupProps {
  xpEarned: number;
  visible: boolean;
}

export const XpPopup: React.FC<XpPopupProps> = ({ xpEarned, visible }) => {
  if (!visible || xpEarned <= 0) return null;
  return (
    <div className="fixed top-24 right-6 z-40 animate-bounce-in">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
        <Zap className="w-5 h-5 text-amber-400" />
        <span className="font-bold">+{xpEarned} XP</span>
      </div>
    </div>
  );
};