import React, { useMemo, useState } from "react";
import { BookOpen, BrainCircuit, Sparkles, ChevronRight, Filter, Trophy, Flame, Play, RotateCcw } from "lucide-react";
import { Word, MistakeRecord, TestConfig } from "../types";

interface HomeProps {
  words: Word[];
  mistakes: MistakeRecord[];
  onStartTest: (config: TestConfig) => void;
  onNavigateManage: () => void;
  isAdmin?: boolean;
}

interface FilterState {
  publisher: string;
  grade: number | null;
  semester: string;
}

export const Home: React.FC<HomeProps> = ({
  words,
  mistakes,
  onStartTest,
  onNavigateManage,
  isAdmin = false,
}) => {
  const [showFilter, setShowFilter] = useState(false);
  const [filter, setFilter] = useState<FilterState>({
    publisher: "",
    grade: null,
    semester: "",
  });

  const availablePublishers = useMemo(() => {
    const set = new Set<string>();
    words.forEach((w) => { if (w.publisher) set.add(w.publisher); });
    return Array.from(set).sort();
  }, [words]);

  const availableGrades = useMemo(() => {
    const set = new Set<number>();
    words.forEach((w) => { if (w.grade != null) set.add(w.grade); });
    return Array.from(set).sort((a, b) => a - b);
  }, [words]);

  const availableSemesters = useMemo(() => {
    const set = new Set<string>();
    words.forEach((w) => { if (w.semester) set.add(w.semester); });
    return Array.from(set).sort();
  }, [words]);

  const filteredWords = useMemo(() => {
    return words.filter((w) => {
      if (filter.publisher && w.publisher !== filter.publisher) return false;
      if (filter.grade != null && w.grade !== filter.grade) return false;
      if (filter.semester && w.semester !== filter.semester) return false;
      return true;
    });
  }, [words, filter]);

  const hasMetadata = availablePublishers.length > 0 || availableGrades.length > 0;
  const isFiltered = filter.publisher !== "" || filter.grade !== null || filter.semester !== "";

  const units = useMemo(() => {
    const unitMap = new Map<string, number>();
    filteredWords.forEach((w) => {
      unitMap.set(w.unit, (unitMap.get(w.unit) || 0) + 1);
    });
    return Array.from(unitMap.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
  }, [filteredWords]);

  const dueReviews = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const today = now.getTime();
    return mistakes.filter((m) => m.nextReviewDate <= today);
  }, [mistakes]);

  const totalMistakes = mistakes.length;

  const handleStartReview = () => {
    const reviewWords = dueReviews
      .map((m) => words.find((w) => w.id === m.wordId))
      .filter((w): w is Word => w !== undefined);
    if (reviewWords.length > 0) {
      onStartTest({ mode: "review", words: reviewWords });
    }
  };

  const handleStartUnit = (unitName: string) => {
    const unitWords = filteredWords.filter((w) => w.unit === unitName);
    onStartTest({ mode: "unit", unitName, words: unitWords });
  };

  if (words.length === 0) {
    return (
      <div className="text-center py-24">
        <div className="w-24 h-24 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <BookOpen className="w-12 h-12 text-brand-500" />
        </div>
        <h2 className="text-3xl font-bold text-stone-800 mb-3">
          Welcome to VocabMaster
        </h2>
        <p className="text-stone-500 mb-8 max-w-md mx-auto">
          {isAdmin
            ? "Import a vocabulary list to begin your learning journey."
            : "No vocabulary available yet. Please contact your administrator."}
        </p>
        {isAdmin && (
          <button
            onClick={onNavigateManage}
            className="inline-flex items-center px-8 py-3.5 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 transition-all shadow-bubble hover:shadow-lg hover:-translate-y-0.5"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Go to Management
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="pb-24 w-full max-w-2xl mx-auto">
      {/* Streak & Stats Bar */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
            <Flame className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold text-amber-700">{dueReviews.length}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-brand-50 px-3 py-1.5 rounded-full border border-brand-200">
            <BrainCircuit className="w-4 h-4 text-brand-500" />
            <span className="text-sm font-bold text-brand-700">{totalMistakes}</span>
          </div>
        </div>
        {hasMetadata && (
          <button
            onClick={() => setShowFilter((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              isFiltered || showFilter
                ? "bg-brand-500 text-white shadow-bubble"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilter && hasMetadata && (
        <div className="mb-6 p-5 bg-white rounded-2xl border border-stone-200 shadow-card space-y-4 animate-slide-down">
          {availablePublishers.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Publisher</p>
              <div className="flex flex-wrap gap-2">
                {["", ...availablePublishers].map((pub) => (
                  <button
                    key={pub || "all"}
                    onClick={() => setFilter((f) => ({ ...f, publisher: pub }))}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      filter.publisher === pub
                        ? "bg-brand-500 text-white shadow-sm"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {pub || "All"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {availableGrades.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Grade</p>
              <div className="flex flex-wrap gap-2">
                {[null, ...availableGrades].map((g) => (
                  <button
                    key={g ?? "all"}
                    onClick={() => setFilter((f) => ({ ...f, grade: g }))}
                    className={`w-10 h-10 rounded-full text-sm font-medium transition-all ${
                      filter.grade === g
                        ? "bg-brand-500 text-white shadow-sm"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {g ?? "A"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {availableSemesters.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Semester</p>
              <div className="flex flex-wrap gap-2">
                {["", ...availableSemesters].map((sem) => (
                  <button
                    key={sem || "all"}
                    onClick={() => setFilter((f) => ({ ...f, semester: sem }))}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      filter.semester === sem
                        ? "bg-brand-500 text-white shadow-sm"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {sem || "All"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isFiltered && (
            <button
              onClick={() => setFilter({ publisher: "", grade: null, semester: "" })}
              className="text-sm text-brand-600 font-medium hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Review Card */}
      <div className="mb-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl p-6 text-white shadow-bubble">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-brand-100 text-sm font-medium uppercase tracking-wider">Smart Review</p>
            <p className="text-5xl font-bold mt-1">{dueReviews.length}</p>
            <p className="text-brand-100 text-sm mt-1">words ready to review</p>
          </div>
          <div className="w-16 h-16 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-sm">
            <RotateCcw className="w-7 h-7" />
          </div>
        </div>
        <button
          onClick={handleStartReview}
          disabled={dueReviews.length === 0}
          className={`w-full py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all ${
            dueReviews.length > 0
              ? "bg-white text-brand-700 hover:bg-brand-50 active:scale-[0.98] shadow-lg"
              : "bg-white/20 text-white/60 cursor-not-allowed"
          }`}
        >
          {dueReviews.length > 0 ? (
            <>
              <Play className="w-5 h-5" />
              Start Review
            </>
          ) : "All Caught Up!"}
        </button>
      </div>

      {/* Path / Unit Tree */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-stone-800">Study Units</h2>
          {isFiltered && (
            <span className="text-sm text-stone-400">{filteredWords.length} words</span>
          )}
        </div>

        {units.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-7 h-7 text-stone-400" />
            </div>
            <p className="text-stone-400 font-medium">No units found</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical connecting line */}
            <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-stone-200" />

            <div className="space-y-3">
              {units.map(([unitName, count], idx) => {
                const isFirst = idx === 0;
                const isLast = idx === units.length - 1;
                return (
                  <button
                    key={unitName}
                    onClick={() => handleStartUnit(unitName)}
                    className="relative w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-stone-200 shadow-card hover:shadow-card-hover hover:border-brand-200 hover:-translate-y-0.5 transition-all group text-left active:scale-[0.99]"
                  >
                    {/* Node circle */}
                    <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center text-base font-bold shrink-0 transition-all ${
                      isFirst
                        ? "bg-brand-500 text-white shadow-bubble"
                        : "bg-stone-100 text-stone-500 group-hover:bg-brand-100 group-hover:text-brand-600"
                    }`}>
                      {isFirst ? <Play className="w-5 h-5 ml-0.5" /> : idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-stone-800 group-hover:text-brand-700 transition-colors truncate">
                        {unitName}
                      </h3>
                      <p className="text-sm text-stone-400">{count} words</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-stone-400 group-hover:text-brand-500 transition-colors">
                        Start
                      </span>
                      <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-brand-400 transition-all group-hover:translate-x-0.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};