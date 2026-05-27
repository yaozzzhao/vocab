import React, { useMemo, useState } from 'react';
import { Word, MistakeRecord, TestConfig } from '../types';
import { BookX, Trash2, BrainCircuit, CheckCircle2, Play, RotateCcw, Volume2, ChevronLeft, HelpCircle, ThumbsDown, XCircle, Filter } from 'lucide-react';

interface ErrorBookProps {
  words: Word[];
  mistakes: MistakeRecord[];
  onStartTest: (config: TestConfig) => void;
  onRemoveMistake: (wordId: string) => void;
  onNavigateHome: () => void;
}

export const ErrorBook: React.FC<ErrorBookProps> = ({ words, mistakes, onStartTest, onRemoveMistake, onNavigateHome }) => {
  const [showFilter, setShowFilter] = useState(true);
  const [filterUnit, setFilterUnit] = useState("");

  const mistakenWords = useMemo(() => {
    const mistakeWordIds = new Set(mistakes.map(m => m.wordId));
    return words.filter(w => mistakeWordIds.has(w.id));
  }, [words, mistakes]);

  const availableUnits = useMemo(() => {
    const set = new Set<string>();
    mistakenWords.forEach((w) => { if (w.unit) set.add(w.unit); });
    return Array.from(set).sort();
  }, [mistakenWords]);

  const hasFilter = availableUnits.length > 0;

  const filteredWords = useMemo(() => {
    if (!filterUnit) return mistakenWords;
    return mistakenWords.filter((w) => w.unit === filterUnit);
  }, [mistakenWords, filterUnit]);

  const mistakeTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    mistakes.forEach((m) => {
      map.set(m.wordId, m.mistakeType ?? 'wrong');
    });
    return map;
  }, [mistakes]);

  const handleStartPractice = () => {
    if (filteredWords.length > 0) {
      onStartTest({ mode: 'review', words: filteredWords });
    }
  };

  const handlePlayAudio = (word: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  const typeConfig: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    wrong: {
      label: 'Wrong',
      icon: <XCircle className="w-3.5 h-3.5" />,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
    },
    dont_know: {
      label: "Don't Know",
      icon: <HelpCircle className="w-3.5 h-3.5" />,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    not_sure: {
      label: 'Not Sure',
      icon: <ThumbsDown className="w-3.5 h-3.5" />,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  };

  return (
    <div className="pb-24 w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onNavigateHome}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700 transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
          <BookX className="w-5 h-5 text-rose-500" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-stone-800">My Error Book</h2>
          <p className="text-sm text-stone-400">{mistakenWords.length} words to review</p>
        </div>
      </div>

      {mistakenWords.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-success-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-success-500" />
          </div>
          <h3 className="text-xl font-bold text-stone-800 mb-1">All Clear!</h3>
          <p className="text-stone-400">Your error book is empty. Keep up the great work!</p>
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          {hasFilter && (
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => { setFilterUnit(""); setShowFilter(true); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    !filterUnit
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  }`}
                >
                  All
                </button>
                {availableUnits.map((unit) => (
                  <button
                    key={unit}
                    onClick={() => setFilterUnit(unit)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      filterUnit === unit
                        ? 'bg-brand-500 text-white shadow-sm'
                        : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Practice Button */}
          <button
            onClick={handleStartPractice}
            className="w-full py-3.5 bg-brand-500 text-white rounded-2xl font-semibold text-base flex items-center justify-center gap-2 hover:bg-brand-600 active:scale-[0.98] transition-all shadow-bubble mb-6"
          >
            <Play className="w-5 h-5" />
            Practice {filteredWords.length} Words
          </button>

          {/* Word List */}
          <div className="space-y-2">
            {filteredWords.map((word) => {
              const mistake = mistakes.find((m) => m.wordId === word.id);
              const nextReview = mistake ? new Date(mistake.nextReviewDate) : null;
              const isDue = nextReview && nextReview.getTime() <= Date.now();
              const mtype = mistakeTypeMap.get(word.id) ?? 'wrong';
              const tc = typeConfig[mtype] ?? typeConfig.wrong;

              return (
                <div
                  key={word.id}
                  className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-stone-200 shadow-card group"
                >
                  {/* Status indicator */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isDue ? 'bg-amber-400' : 'bg-success-400'}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-stone-800">{word.word}</p>
                      <button
                        onClick={() => handlePlayAudio(word.word)}
                        className="text-stone-300 hover:text-brand-500 transition-colors"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      {/* Mistake type badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${tc.bg} ${tc.color}`}>
                        {tc.icon}
                        {tc.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm mt-0.5">
                      <span className="text-stone-400">{word.phonetic}</span>
                      <span className="text-stone-300">·</span>
                      <span className="text-stone-600">{word.meaning}</span>
                      {word.unit && (
                        <>
                          <span className="text-stone-300">·</span>
                          <span className="text-stone-400 text-xs">{word.unit}</span>
                        </>
                      )}
                    </div>
                    {nextReview && (
                      <p className={`text-xs mt-1 ${isDue ? 'text-amber-500 font-medium' : 'text-stone-400'}`}>
                        {isDue ? 'Due for review' : `Next review: ${nextReview.toLocaleDateString()}`}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => onRemoveMistake(word.id)}
                    className="p-2 rounded-xl text-stone-300 hover:bg-rose-50 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                    title="Remove from Error Book"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};