import React, { useMemo, useState, useCallback } from "react";
import { BookOpen, BrainCircuit, Sparkles, ChevronRight, Filter, Trophy, Flame, Play, RotateCcw, ArrowLeft, X, Minus, Plus, ChevronDown, BookText } from "lucide-react";
import { Word, MistakeRecord, TestConfig, PausedTest } from "../types";

interface HomeProps {
  words: Word[];
  mistakes: MistakeRecord[];
  onStartTest: (config: TestConfig) => void;
  onNavigateManage: () => void;
  onNavigateErrorBook: () => void;
  pausedTest: PausedTest | null;
  onResumeTest: () => void;
  isAdmin?: boolean;
}

interface FilterState {
  publisher: string;
  grade: number | null;
  semester: string;
}

const NODE_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-sky-400 to-cyan-500",
  "from-rose-400 to-pink-500",
  "from-emerald-400 to-teal-500",
  "from-orange-400 to-amber-500",
  "from-indigo-400 to-blue-500",
  "from-fuchsia-400 to-pink-500",
  "from-lime-400 to-green-500",
];

const CARD_GRADIENTS = [
  "from-violet-50 to-purple-50 border-violet-200",
  "from-sky-50 to-cyan-50 border-sky-200",
  "from-rose-50 to-pink-50 border-rose-200",
  "from-emerald-50 to-teal-50 border-emerald-200",
  "from-orange-50 to-amber-50 border-orange-200",
  "from-indigo-50 to-blue-50 border-indigo-200",
  "from-fuchsia-50 to-pink-50 border-fuchsia-200",
  "from-lime-50 to-green-50 border-lime-200",
];

export const Home: React.FC<HomeProps> = ({
  words,
  mistakes,
  onStartTest,
  onNavigateManage,
  onNavigateErrorBook,
  pausedTest,
  onResumeTest,
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

  const [wordCountModal, setWordCountModal] = useState<{
    unitName: string;
    total: number;
    value: number;
  } | null>(null);

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
    if (unitWords.length > 100) {
      setWordCountModal({
        unitName,
        total: unitWords.length,
        value: 20,
      });
      return;
    }
    onStartTest({ mode: "unit", unitName, words: unitWords });
  };

  const confirmWordCount = useCallback(() => {
    if (!wordCountModal) return;
    const count = Math.min(wordCountModal.value, wordCountModal.total);
    const unitWords = filteredWords
      .filter((w) => w.unit === wordCountModal.unitName);
    const shuffled = [...unitWords];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setWordCountModal(null);
    onStartTest({ mode: "unit", unitName: wordCountModal.unitName, words: shuffled.slice(0, count) });
  }, [wordCountModal, filteredWords, onStartTest]);

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

  const activeFilterCount = [filter.publisher, filter.semester].filter(Boolean).length + (filter.grade != null ? 1 : 0);

  return (
    <div className="pb-24 w-full max-w-2xl mx-auto">
      {/* Hero Stats Row */}
      <div className="flex items-center gap-3 mb-7">
        <div className="flex items-center gap-2.5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl px-4 py-3 border border-amber-200/60 shadow-sm flex-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Ready to Review</p>
            <p className="text-xl font-bold text-amber-800">{dueReviews.length}</p>
          </div>
        </div>

        <button
          onClick={onNavigateErrorBook}
          className="flex items-center gap-2.5 bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl px-4 py-3 border border-rose-200/60 shadow-sm flex-1 hover:from-rose-100 hover:to-pink-100 transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-sm">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600">Mistakes</p>
            <p className="text-xl font-bold text-rose-800">{totalMistakes}</p>
          </div>
        </button>

        {hasMetadata && (
          <button
            onClick={() => setShowFilter((v) => !v)}
            className={`rounded-2xl px-4 py-3 border transition-all cursor-pointer ${
              showFilter || isFiltered
                ? "bg-brand-500 border-brand-500 text-white shadow-bubble"
                : "bg-stone-50 border-stone-200 text-stone-500 hover:bg-stone-100"
            }`}
          >
            <div className="flex flex-col items-center gap-0.5">
              <Filter className="w-5 h-5" />
              {isFiltered && (
                <span className="text-[10px] font-bold leading-none">{activeFilterCount}</span>
              )}
            </div>
          </button>
        )}
      </div>

      {/* Resume Test Card */}
      {pausedTest && (
        <div className="mb-6 p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 shadow-card animate-slide-down">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <ArrowLeft className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-stone-800 text-sm">Test Paused</p>
              <p className="text-xs text-stone-500">
                {pausedTest.config.mode === "review" ? "Review" : pausedTest.config.unitName} &middot; {pausedTest.currentIndex + 1} of {pausedTest.questions.length}
              </p>
            </div>
            <button
              onClick={onResumeTest}
              className="px-5 py-2.5 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600 active:scale-[0.98] transition-all shadow-bubble shrink-0 cursor-pointer"
            >
              Resume
            </button>
          </div>
        </div>
      )}

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
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
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
                    className={`w-10 h-10 rounded-full text-sm font-medium transition-all cursor-pointer ${
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
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
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
              className="text-sm text-brand-600 font-medium hover:underline cursor-pointer"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Smart Review Card */}
      {dueReviews.length > 0 && (
        <div className="mb-8 bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 rounded-2xl p-5 text-white shadow-bubble">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-brand-100 text-xs font-semibold uppercase tracking-wider">Smart Review</p>
              <p className="text-4xl font-bold mt-1">{dueReviews.length}</p>
              <p className="text-brand-100 text-xs mt-0.5">words waiting for you</p>
            </div>
            <div className="w-14 h-14 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-sm">
              <RotateCcw className="w-6 h-6" />
            </div>
          </div>
          <button
            onClick={handleStartReview}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-white text-brand-700 hover:bg-brand-50 active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            Start Review
          </button>
        </div>
      )}

      {/* Units Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-stone-800">Study Units</h2>
          {!isFiltered && (
            <p className="text-xs text-stone-400 mt-0.5">{filteredWords.length} words &middot; {units.length} units</p>
          )}
        </div>
        {isFiltered && (
          <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full">
            {filteredWords.length} words
          </span>
        )}
      </div>

      {/* Unit Grid */}
      {units.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-7 h-7 text-stone-400" />
          </div>
          <p className="text-stone-400 font-medium">No units found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {units.map(([unitName, count], idx) => {
            const gradientIdx = idx % NODE_GRADIENTS.length;
            return (
              <button
                key={unitName}
                onClick={() => handleStartUnit(unitName)}
                className={`group text-left rounded-2xl border bg-gradient-to-br ${CARD_GRADIENTS[gradientIdx]} p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer`}
              >
                <h3 className="font-bold text-stone-800 group-hover:text-brand-700 transition-colors text-sm leading-tight mb-1 line-clamp-2">
                  {unitName}
                </h3>
                <p className="text-xs text-stone-400">{count} words</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Word Count Modal */}
      {wordCountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 animate-slide-down">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-stone-800">How many words?</h3>
              <button
                onClick={() => setWordCountModal(null)}
                className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center hover:bg-stone-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-stone-500" />
              </button>
            </div>

            <p className="text-sm text-stone-500 mb-5">
              This unit has <span className="font-semibold text-stone-700">{wordCountModal.total} words</span>.
              How many would you like to test?
            </p>

            <div className="flex items-center justify-center gap-5 mb-6">
              <button
                onClick={() =>
                  setWordCountModal((m) =>
                    m ? { ...m, value: Math.max(1, m.value - 5) } : m
                  )
                }
                className="w-11 h-11 rounded-full bg-stone-100 flex items-center justify-center hover:bg-stone-200 transition-colors cursor-pointer active:scale-90"
              >
                <Minus className="w-5 h-5 text-stone-600" />
              </button>

              <div className="text-center">
                <span className="text-4xl font-bold text-brand-600 tabular-nums">
                  {wordCountModal.value}
                </span>
                <span className="text-sm text-stone-400 block mt-0.5">
                  of {wordCountModal.total}
                </span>
              </div>

              <button
                onClick={() =>
                  setWordCountModal((m) =>
                    m ? { ...m, value: Math.min(m.total, m.value + 5) } : m
                  )
                }
                className="w-11 h-11 rounded-full bg-stone-100 flex items-center justify-center hover:bg-stone-200 transition-colors cursor-pointer active:scale-90"
              >
                <Plus className="w-5 h-5 text-stone-600" />
              </button>
            </div>

            <input
              type="range"
              min={1}
              max={wordCountModal.total}
              value={wordCountModal.value}
              onChange={(e) =>
                setWordCountModal((m) =>
                  m ? { ...m, value: parseInt(e.target.value, 10) } : m
                )
              }
              className="w-full mb-6 accent-brand-500 h-2 rounded-full appearance-none cursor-pointer bg-stone-200 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:shadow-md"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setWordCountModal(null)}
                className="flex-1 py-3 rounded-xl font-semibold text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={confirmWordCount}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-brand-500 hover:bg-brand-600 transition-colors cursor-pointer active:scale-[0.98] shadow-bubble"
              >
                Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
