import React, { useMemo, useState } from "react";
import { BookOpen, BrainCircuit, Settings, ArrowRight, Filter } from "lucide-react";
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

  // 提取所有可用的出版社/年级/学期选项
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

  // 根据筛选条件过滤单词
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
      <div className="text-center py-24 bg-stone-100 rounded-lg border border-stone-200">
        <BookOpen className="w-16 h-16 text-stone-400 mx-auto mb-6" />
        <h2 className="text-3xl font-serif font-bold text-stone-800 mb-2">
          Welcome to VocabMaster
        </h2>
        <p className="text-stone-600 mb-8 max-w-md mx-auto">
          {isAdmin
            ? "Import a vocabulary list to begin your learning journey."
            : "No vocabulary available yet. Please contact your administrator."}
        </p>
        {isAdmin && (
          <button
            onClick={onNavigateManage}
            className="inline-flex items-center px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium"
          >
            <Settings className="w-5 h-5 mr-2" />
            Go to Management
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-16">
      {/* Review Section */}
      <div className="grid md:grid-cols-3 gap-8 items-center">
        <div className="md:col-span-1 text-center md:text-left">
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Smart Review
          </p>
          <p className="text-8xl font-serif font-bold text-slate-800">
            {dueReviews.length}
          </p>
          <p className="text-stone-600 mt-2">
            Words are ready for you to practice.
          </p>
        </div>
        <div className="md:col-span-2">
          <div className="bg-white p-8 rounded-lg border border-stone-200 shadow-sm">
            <h2 className="text-2xl font-serif font-bold text-stone-900 flex items-center">
              <BrainCircuit className="w-7 h-7 text-slate-600 mr-3" />
              Ebbinghaus Forgetting Curve
            </h2>
            <p className="text-stone-600 mt-3 mb-6">
              Review words at scientifically proven intervals to move them from
              short-term to long-term memory.
            </p>
            <button
              onClick={handleStartReview}
              disabled={dueReviews.length === 0}
              className={`w-full py-3 rounded-lg font-medium transition-colors text-lg flex items-center justify-center ${
                dueReviews.length > 0
                  ? "bg-slate-800 text-white hover:bg-slate-900"
                  : "bg-stone-100 text-stone-400 cursor-not-allowed"
              }`}
            >
              {dueReviews.length > 0
                ? "Start Review Session"
                : "All Caught Up!"}
              {dueReviews.length > 0 && <ArrowRight className="w-5 h-5 ml-2" />}
            </button>
          </div>
        </div>
      </div>

      {/* Units Section */}
      <div>
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-stone-200">
          <h2 className="text-3xl font-serif font-bold text-stone-900">
            Study Units
            {isFiltered && (
              <span className="ml-3 text-base font-sans font-normal text-slate-500">
                ({filteredWords.length} words)
              </span>
            )}
          </h2>
          {hasMetadata && (
            <button
              onClick={() => setShowFilter((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isFiltered || showFilter
                  ? "bg-slate-800 text-white"
                  : "border border-stone-300 text-stone-600 hover:bg-stone-50"
              }`}
            >
              <Filter className="w-4 h-4" />
              Filter
              {isFiltered && (
                <span className="ml-1 bg-white text-slate-800 rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">
                  {[filter.publisher, filter.grade, filter.semester].filter(Boolean).length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilter && hasMetadata && (
          <div className="mb-6 p-5 bg-stone-50 rounded-lg border border-stone-200 space-y-4">
            {availablePublishers.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Publisher</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilter((f) => ({ ...f, publisher: "" }))}
                    className={`px-3 py-1.5 rounded text-sm transition-colors ${
                      filter.publisher === ""
                        ? "bg-slate-800 text-white"
                        : "bg-white border border-stone-300 text-stone-600 hover:border-slate-400"
                    }`}
                  >
                    All
                  </button>
                  {availablePublishers.map((pub) => (
                    <button
                      key={pub}
                      onClick={() => setFilter((f) => ({ ...f, publisher: pub }))}
                      className={`px-3 py-1.5 rounded text-sm transition-colors ${
                        filter.publisher === pub
                          ? "bg-slate-800 text-white"
                          : "bg-white border border-stone-300 text-stone-600 hover:border-slate-400"
                      }`}
                    >
                      {pub}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {availableGrades.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Grade</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilter((f) => ({ ...f, grade: null }))}
                    className={`px-3 py-1.5 rounded text-sm transition-colors ${
                      filter.grade === null
                        ? "bg-slate-800 text-white"
                        : "bg-white border border-stone-300 text-stone-600 hover:border-slate-400"
                    }`}
                  >
                    All
                  </button>
                  {availableGrades.map((g) => (
                    <button
                      key={g}
                      onClick={() => setFilter((f) => ({ ...f, grade: g }))}
                      className={`w-10 py-1.5 rounded text-sm transition-colors ${
                        filter.grade === g
                          ? "bg-slate-800 text-white"
                          : "bg-white border border-stone-300 text-stone-600 hover:border-slate-400"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {availableSemesters.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Semester</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilter((f) => ({ ...f, semester: "" }))}
                    className={`px-3 py-1.5 rounded text-sm transition-colors ${
                      filter.semester === ""
                        ? "bg-slate-800 text-white"
                        : "bg-white border border-stone-300 text-stone-600 hover:border-slate-400"
                    }`}
                  >
                    All
                  </button>
                  {availableSemesters.map((sem) => (
                    <button
                      key={sem}
                      onClick={() => setFilter((f) => ({ ...f, semester: sem }))}
                      className={`px-3 py-1.5 rounded text-sm transition-colors ${
                        filter.semester === sem
                          ? "bg-slate-800 text-white"
                          : "bg-white border border-stone-300 text-stone-600 hover:border-slate-400"
                      }`}
                    >
                      {sem}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isFiltered && (
              <button
                onClick={() => setFilter({ publisher: "", grade: null, semester: "" })}
                className="text-sm text-slate-600 underline hover:text-slate-800"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {units.length === 0 ? (
          <div className="text-center py-12 text-stone-400">
            No units match the selected filters.
          </div>
        ) : (
          <div className="space-y-2">
            {units.map(([unitName, count]) => (
              <button
                key={unitName}
                onClick={() => handleStartUnit(unitName)}
                className="w-full flex items-center justify-between p-5 bg-white rounded-lg border border-stone-200 hover:border-slate-400 hover:bg-stone-50 transition-all group text-left"
              >
                <div>
                  <h3 className="font-serif text-xl font-semibold text-stone-800 group-hover:text-slate-800 transition-colors">
                    {unitName}
                  </h3>
                  <p className="text-sm text-stone-500">{count} words</p>
                </div>
                <ArrowRight className="w-6 h-6 text-stone-300 group-hover:text-slate-600 transition-transform group-hover:translate-x-1" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
