import React, { useState } from "react";
import { Trash2, AlertCircle, CheckCircle2, BookOpen, Library } from "lucide-react";
import { WordLibrary } from "./WordLibrary";
import { ManualWordEntry } from "./ManualWordEntry";

interface VocabularyManagerProps {
  currentUserId: number;
  totalWords: number;
  onClearAll: () => void;
}

type Tab = "library" | "add";

export const VocabularyManager: React.FC<VocabularyManagerProps> = ({
  currentUserId,
  totalWords,
  onClearAll,
}) => {
  const [tab, setTab] = useState<Tab>("library");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleClear = () => {
    if (window.confirm("Are you sure? This will permanently delete ALL imported words and learning progress.")) {
      onClearAll();
      setSuccess("All data cleared");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
        <button
          type="button"
          onClick={() => setTab("library")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            tab === "library"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          <Library className="w-4 h-4" />
          Word Library
        </button>
        <button
          type="button"
          onClick={() => setTab("add")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            tab === "add"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Add Words
        </button>
      </div>

      {/* Error/Success */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-auto cursor-pointer">
            <span className="text-lg leading-none">&times;</span>
          </button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess(null)} className="ml-auto cursor-pointer">
            <span className="text-lg leading-none">&times;</span>
          </button>
        </div>
      )}

      {/* Tab content */}
      {tab === "library" ? (
        <WordLibrary currentUserId={currentUserId} />
      ) : (
        <ManualWordEntry totalWords={totalWords} />
      )}

      {/* Danger zone */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <h3 className="text-sm font-bold text-rose-600 mb-1">Danger Zone</h3>
        <p className="text-xs text-stone-400 mb-3">Permanently delete all imported words and learning progress.</p>
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-2 px-4 py-2 border border-rose-300 text-rose-600 rounded-xl text-sm font-medium hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          Clear All Data
        </button>
      </div>
    </div>
  );
};
