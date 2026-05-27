import React, { useMemo } from 'react';
import { Word, MistakeRecord, TestConfig } from '../types';
import { BookX, Trash2, BrainCircuit, CheckCircle2, Play, RotateCcw, Volume2 } from 'lucide-react';

interface ErrorBookProps {
  words: Word[];
  mistakes: MistakeRecord[];
  onStartTest: (config: TestConfig) => void;
  onRemoveMistake: (wordId: string) => void;
}

export const ErrorBook: React.FC<ErrorBookProps> = ({ words, mistakes, onStartTest, onRemoveMistake }) => {
  const mistakenWords = useMemo(() => {
    const mistakeWordIds = new Set(mistakes.map(m => m.wordId));
    return words.filter(w => mistakeWordIds.has(w.id));
  }, [words, mistakes]);

  const handleStartPractice = () => {
    if (mistakenWords.length > 0) {
      onStartTest({ mode: 'review', words: mistakenWords });
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

  return (
    <div className="max-w-lg mx-auto pb-24 sm:pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
          <BookX className="w-5 h-5 text-rose-500" />
        </div>
        <div>
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
          {/* Practice Button */}
          <button
            onClick={handleStartPractice}
            className="w-full py-3.5 bg-brand-500 text-white rounded-2xl font-semibold text-base flex items-center justify-center gap-2 hover:bg-brand-600 active:scale-[0.98] transition-all shadow-bubble mb-6"
          >
            <Play className="w-5 h-5" />
            Practice All {mistakenWords.length} Words
          </button>

          {/* Word List */}
          <div className="space-y-2">
            {mistakenWords.map((word) => {
              const mistake = mistakes.find((m) => m.wordId === word.id);
              const nextReview = mistake ? new Date(mistake.nextReviewDate) : null;
              const isDue = nextReview && nextReview.getTime() <= Date.now();

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
                    </div>
                    <div className="flex items-center gap-2 text-sm mt-0.5">
                      <span className="text-stone-400">{word.phonetic}</span>
                      <span className="text-stone-300">·</span>
                      <span className="text-stone-600">{word.meaning}</span>
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