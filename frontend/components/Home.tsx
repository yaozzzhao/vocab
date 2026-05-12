import React, { useMemo } from 'react';
import { BookOpen, BrainCircuit, Settings, ArrowRight } from 'lucide-react';
import { Word, MistakeRecord, TestConfig } from '../types';

interface HomeProps {
  words: Word[];
  mistakes: MistakeRecord[];
  onStartTest: (config: TestConfig) => void;
  onNavigateManage: () => void;
}

export const Home: React.FC<HomeProps> = ({ words, mistakes, onStartTest, onNavigateManage }) => {
  const units = useMemo(() => {
    const unitMap = new Map<string, number>();
    words.forEach(w => {
      unitMap.set(w.unit, (unitMap.get(w.unit) || 0) + 1);
    });
    return Array.from(unitMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [words]);

  const dueReviews = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const today = now.getTime();
    
    return mistakes.filter(m => m.nextReviewDate <= today);
  }, [mistakes]);

  const handleStartReview = () => {
    const reviewWords = dueReviews
      .map(m => words.find(w => w.id === m.wordId))
      .filter((w): w is Word => w !== undefined);
    
    if (reviewWords.length > 0) {
      onStartTest({ mode: 'review', words: reviewWords });
    }
  };

  const handleStartUnit = (unitName: string) => {
    const unitWords = words.filter(w => w.unit === unitName);
    onStartTest({ mode: 'unit', unitName, words: unitWords });
  };

  if (words.length === 0) {
    return (
      <div className="text-center py-24 bg-stone-100 rounded-lg border border-stone-200">
        <BookOpen className="w-16 h-16 text-stone-400 mx-auto mb-6" />
        <h2 className="text-3xl font-serif font-bold text-stone-800 mb-2">Welcome to VocabMaster</h2>
        <p className="text-stone-600 mb-8 max-w-md mx-auto">Import a vocabulary list to begin your learning journey.</p>
        <button
          onClick={onNavigateManage}
          className="inline-flex items-center px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium"
        >
          <Settings className="w-5 h-5 mr-2" />
          Go to Management
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-16">
      {/* Review Section */}
      <div className="grid md:grid-cols-3 gap-8 items-center">
        <div className="md:col-span-1 text-center md:text-left">
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-2">Smart Review</p>
          <p className="text-8xl font-serif font-bold text-slate-800">{dueReviews.length}</p>
          <p className="text-stone-600 mt-2">Words are ready for you to practice.</p>
        </div>
        <div className="md:col-span-2">
          <div className="bg-white p-8 rounded-lg border border-stone-200 shadow-sm">
            <h2 className="text-2xl font-serif font-bold text-stone-900 flex items-center">
              <BrainCircuit className="w-7 h-7 text-slate-600 mr-3" />
              Ebbinghaus Forgetting Curve
            </h2>
            <p className="text-stone-600 mt-3 mb-6">
              Review words at scientifically proven intervals to move them from short-term to long-term memory.
            </p>
            <button
              onClick={handleStartReview}
              disabled={dueReviews.length === 0}
              className={`w-full py-3 rounded-lg font-medium transition-colors text-lg flex items-center justify-center ${
                dueReviews.length > 0 
                  ? 'bg-slate-800 text-white hover:bg-slate-900' 
                  : 'bg-stone-100 text-stone-400 cursor-not-allowed'
              }`}
            >
              {dueReviews.length > 0 ? 'Start Review Session' : 'All Caught Up!'}
              {dueReviews.length > 0 && <ArrowRight className="w-5 h-5 ml-2" />}
            </button>
          </div>
        </div>
      </div>

      {/* Units Section */}
      <div>
        <h2 className="text-3xl font-serif font-bold text-stone-900 mb-6 pb-3 border-b border-stone-200">
          Study Units
        </h2>
        <div className="space-y-2">
          {units.map(([unitName, count]) => (
            <button
              key={unitName}
              onClick={() => handleStartUnit(unitName)}
              className="w-full flex items-center justify-between p-5 bg-white rounded-lg border border-stone-200 hover:border-slate-400 hover:bg-stone-50 transition-all group text-left"
            >
              <div>
                <h3 className="font-serif text-xl font-semibold text-stone-800 group-hover:text-slate-800 transition-colors">{unitName}</h3>
                <p className="text-sm text-stone-500">{count} words</p>
              </div>
              <ArrowRight className="w-6 h-6 text-stone-300 group-hover:text-slate-600 transition-transform group-hover:translate-x-1" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};