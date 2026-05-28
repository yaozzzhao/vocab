import React, { useState, useRef } from "react";
import { Upload, Sparkles, X, AlertCircle, CheckCircle2, FileText, BookOpen } from "lucide-react";
import { getAuthHeaders } from "../db";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

interface NewspaperImporterProps {
  onImport: (words: Omit<import("../types").Word, "id" | "ownerId">[]) => Promise<{ added: number; skipped: number }>;
}

export const NewspaperImporter: React.FC<NewspaperImporterProps> = ({ onImport }) => {
  const [unit, setUnit] = useState("");
  const [publisher, setPublisher] = useState("21st Century");
  const [image, setImage] = useState<{ data: string; name: string; mime: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [extracted, setExtracted] = useState<string[]>([]);
  const [editable, setEditable] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError(null);
    setExtracted([]);
    setEditable([]);
    setSuccess(null);

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPEG, PNG, etc.)");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("Image is too large. Maximum 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = e.target?.result as string;
      const data = raw.split(",")[1];
      setImage({ data, name: file.name, mime: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    if (!image) return;
    if (!unit.trim()) { setError("Please enter a unit name"); return; }

    setScanning(true);
    setError(null);
    setExtracted([]);
    setEditable([]);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/ocr-import", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ image: image.data, mimeType: image.mime }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error (${res.status}): ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "OCR failed");

      const words = data.data.words as string[];
      if (words.length === 0) {
        setError("No bold words detected. Try a different image.");
      } else {
        setExtracted(words);
        setEditable(words);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCR failed");
    } finally {
      setScanning(false);
    }
  };

  const removeWord = (idx: number) => {
    setEditable((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateWord = (idx: number, val: string) => {
    setEditable((prev) => prev.map((w, i) => (i === idx ? val : w)));
  };

  const handleImport = async () => {
    const words = editable.map((w) => ({
      word: w.trim(),
      meaning: "",
      phonetic: "",
      unit: unit.trim(),
      publisher,
    })).filter((w) => w.word);

    if (words.length === 0) { setError("No words to import"); return; }

    setImporting(true);
    setError(null);
    try {
      const result = await onImport(words);
      setSuccess(`Imported ${result.added} words (${result.skipped} skipped as duplicates)`);
      setExtracted([]);
      setEditable([]);
      setImage(null);
      setUnit("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const resetAll = () => {
    setImage(null);
    setExtracted([]);
    setEditable([]);
    setError(null);
    setSuccess(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-stone-800 text-sm">Import from Newspaper</h3>
          <p className="text-xs text-stone-400">Extract bold words from newspaper image via OCR</p>
        </div>
      </div>

      {/* Unit & Publisher */}
      <div className="grid grid-cols-2 gap-3">
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
        <div>
          <label className="text-xs font-medium text-stone-500 mb-1 block">Publisher</label>
          <input
            type="text"
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Image Upload */}
      {!image && (
        <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-stone-300 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors cursor-pointer">
          <Upload className="w-8 h-8 text-stone-400" />
          <div className="text-center">
            <p className="text-sm font-semibold text-stone-700">Upload Newspaper Image</p>
            <p className="text-xs text-stone-400 mt-0.5">JPEG, PNG or WebP</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </label>
      )}

      {/* Image Preview */}
      {image && (
        <div className="relative rounded-xl overflow-hidden border border-stone-200">
          <img
            src={`data:image/jpeg;base64,${image.data}`}
            alt="Newspaper"
            className="w-full max-h-48 object-contain bg-stone-50"
          />
          <button
            type="button"
            onClick={resetAll}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {/* Scan Button */}
      {image && extracted.length === 0 && (
        <button
          type="button"
          onClick={handleScan}
          disabled={scanning || !unit.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
        >
          {scanning ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {scanning ? "Scanning..." : "Scan for Bold Words"}
        </button>
      )}

      {/* Extracted Words */}
      {editable.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-stone-700">
              {editable.length} word{editable.length !== 1 ? "s" : ""} detected
            </p>
            <p className="text-xs text-stone-400">Click to edit, ✕ to remove</p>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {editable.map((word, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs text-stone-400 w-5 shrink-0 font-mono">{idx + 1}.</span>
                <input
                  type="text"
                  value={word}
                  onChange={(e) => updateWord(idx, e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all bg-white"
                />
                <button
                  type="button"
                  onClick={() => removeWord(idx)}
                  className="w-7 h-7 rounded-lg hover:bg-rose-50 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 text-rose-400" />
                </button>
              </div>
            ))}
          </div>

          {/* Import Button */}
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || editable.filter((w) => w.trim()).length === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          >
            {importing ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {importing ? "Importing..." : `Import ${editable.filter((w) => w.trim()).length} Words`}
          </button>
        </div>
      )}

      {/* Messages */}
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
    </div>
  );
};
