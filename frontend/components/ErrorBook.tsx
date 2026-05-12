import React, { useMemo } from 'react';
import { Word, MistakeRecord, TestConfig } from '../types';
import { BookX, Trash2, BrainCircuit, CheckCircle2 } from 'lucide-react';

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

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 pb-4 border-b border-stone-200">
        <h2 className="text-3xl font-serif font-bold text-stone-900 flex items-center">
          <BookX className="w-8 h-8 mr-3 text-red-600" />
          My Error Book
        </h2>
        <p className="text-stone-600 mt-2">
          Here are the words you've struggled with. Review them regularly to master them.
        </p>
      </div>

      {mistakenWords.length === 0 ? (
        <div className="text-center py-20 bg-stone-100 rounded-lg border border-stone-200">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-6" />
          <h3 className="text-2xl font-serif font-bold text-stone-800 mb-2">All Clear!</h3>
          <p className="text-stone-600">Your error book is empty. Keep up the great work!</p>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <button
              onClick={handleStartPractice}
              className="w-full py-3 rounded-lg font-medium text-lg flex items-center justify-center bg-slate-800 text-white hover:bg-slate-900 transition-colors"
            >
              <BrainCircuit className="w-6 h-6 mr-2" />
              Practice These {mistakenWords.length} Words
            </button>
          </div>

          <div className="space-y-3">
            {mistakenWords.map(word => (
              <div key={word.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-stone-200 group">
                <div className="flex-1">
                  <p className="font-bold text-lg text-stone-900">{word.word}</p>
                  <p className="text-sm text-stone-500">
                    {word.phonetic}
                    {word.page && <span className="ml-2 text-stone-400">({word.page})</span>}
                  </p>
                  <p className="text-stone-700 mt-1">{word.meaning}</p>
                </div>
                <button
                  onClick={() => onRemoveMistake(word.id)}
                  className="p-2 rounded-md text-stone-400 hover:bg-red-50 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove from Error Book"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
