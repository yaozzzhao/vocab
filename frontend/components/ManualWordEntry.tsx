import React, { useState } from "react";
import { Plus, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { getAuthHeaders } from "../db";

interface ManualWordEntryProps {
  totalWords: number;
}

const PUBLISHERS = ["21st Century", "PEP (人教版)", "BJNSP (北师大版)", "Other"];

export const ManualWordEntry: React.FC<ManualWordEntryProps> = ({ totalWords }) => {
  const [publisher, setPublisher] = useState("21st Century");
  const [customPublisher, setCustomPublisher] = useState("");
  const [unit, setUnit] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const effectivePublisher = publisher === "Other" ? customPublisher.trim() : publisher;

  const handleSave = async () => {
    if (!unit.trim()) { setError("Please enter a unit name"); return; }
    if (!effectivePublisher) { setError("Please enter a publisher name"); return; }

    const words = text
      .split(/\n/)
      .map((w) => w.trim())
      .filter(Boolean)
      .filter((w) => !w.startsWith("//") && !w.startsWith("#"));

    if (words.length === 0) { setError("Please enter at least one word"); return; }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/manual-add", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ words, unit: unit.trim(), publisher: effectivePublisher }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Server error (${res.status}): ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Save failed");

      setSuccess(`Successfully saved ${data.data.words.length} words`);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
      <h3 className="font-bold text-stone-800 text-sm">Add Words Manually</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-stone-500 mb-1 block">Publisher</label>
          <select
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all bg-white"
          >
            {PUBLISHERS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {publisher === "Other" && (
            <input
              type="text"
              placeholder="Enter publisher name"
              value={customPublisher}
              onChange={(e) => setCustomPublisher(e.target.value)}
              className="w-full mt-2 px-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
            />
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-stone-500 mb-1 block">Unit *</label>
          <input
            type="text"
            placeholder="e.g. Unit 5"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-stone-500 mb-1 block">Words (one per line)</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"take\nturn\ndoctor\n等等..."}
          rows={8}
          className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all resize-y font-mono"
        />
        <p className="text-xs text-stone-400 mt-1">
          {text ? text.split(/\n/).filter(Boolean).filter((w) => !w.startsWith("//") && !w.startsWith("#")).length : 0} words
        </p>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !unit.trim() || !text.trim()}
        className="w-full flex items-center justify-center gap-2 py-3 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Enriching & Saving...
          </>
        ) : (
          <>
            <Plus className="w-4 h-4" />
            Save Words (auto-enrich phonetics & meaning)
          </>
        )}
      </button>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-emerald-700 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <p className="text-xs text-stone-400 text-center">
        Total words in database: <strong>{totalWords.toLocaleString()}</strong>
      </p>
    </div>
  );
};
