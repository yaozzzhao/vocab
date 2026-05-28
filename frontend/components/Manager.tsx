import React, { useState, useRef } from "react";
import {
  Upload,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { Word } from "../types";
import { ManualWordEntry } from "./ManualWordEntry";

interface ManagerProps {
  onAddWords: (
    words: Omit<Word, "id" | "ownerId">[],
  ) => Promise<{ added: number; skipped: number }>;
  onClearAll: () => void;
  totalWords: number;
}

const PUBLISHERS = ["PEP (人教版)", "BJNSP (北师大版)", "Other"];
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SEMESTERS = ["Semester 1 (上册)", "Semester 2 (下册)"];

const COLUMN_ALIASES: Record<string, string[]> = {
  word: ["word", "term", "english", "vocab", "headword", "单词", "词汇"],
  meaning: ["meaning", "definition", "translation", "chinese", "explanation", "释义", "翻译", "中文", "含义"],
  unit: ["unit", "lesson", "category", "chapter", "list", "单元", "课"],
  phonetic: ["phonetic", "ipa", "pronunciation", "sound", "symbol", "音标", "发音"],
  page: ["page", "p.", "location", "页码"],
};

function detectColumn(headers: string[], field: string): string | null {
  const aliases = COLUMN_ALIASES[field];
  if (!aliases) return null;
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = lower.findIndex((h) => h.includes(alias));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row.");

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const parseLine = (line: string) => {
    const result: string[] = [];
    let current = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuote = false;
          }
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuote = true;
      } else if (ch === delimiter) {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result.map((v) => v.trim());
  };

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length === 1 && values[0] === "") continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function parseJSON(text: string): Record<string, string>[] {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("JSON must be an array.");

  let flat: Record<string, string>[] = [];

  if (parsed[0] && typeof parsed[0] === "object" && parsed[0].vocabulary_list) {
    const list = parsed[0].vocabulary_list;
    for (const unitName in list) {
      if (Object.prototype.hasOwnProperty.call(list, unitName) && Array.isArray(list[unitName])) {
        for (const obj of list[unitName]) {
          if (obj && typeof obj === "object") {
            flat.push({ ...obj, unit: unitName });
          }
        }
      }
    }
  } else {
    flat = parsed;
  }

  return flat;
}

function autoMap(headers: string[]): Record<string, string> {
  return {
    word: detectColumn(headers, "word") ?? headers[0],
    meaning: detectColumn(headers, "meaning") ?? headers[1] ?? "",
    unit: detectColumn(headers, "unit") ?? headers[2] ?? "",
    phonetic: detectColumn(headers, "phonetic") ?? "",
    page: detectColumn(headers, "page") ?? "",
  };
}

export const Manager: React.FC<ManagerProps> = ({
  onAddWords,
  onClearAll,
  totalWords,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "metadata">("upload");
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [metadata, setMetadata] = useState({
    publisher: PUBLISHERS[0],
    grade: 7,
    semester: SEMESTERS[0],
  });

  const handleData = (text: string, isCSV: boolean) => {
    try {
      const rows = isCSV ? parseCSV(text) : parseJSON(text);
      if (rows.length === 0) throw new Error("No data found.");
      const headers = Object.keys(rows[0]);
      setParsedRows(rows);
      setDetectedHeaders(headers);
      setMapping(autoMap(headers));
      setStep("metadata");
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to parse file.");
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const isCSV = file.name.endsWith(".csv");
      handleData(content, isCSV);
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);
    setSuccess(null);
    if (!file) return;
    handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePaste = () => {
    const text = prompt("Paste your vocabulary data here (CSV or tab-separated):\n\nTip: Copy from Excel/Sheets and paste directly.");
    if (!text) return;
    handleData(text, true);
  };

  const handleImport = async () => {
    try {
      const wordKey = mapping.word;
      const meaningKey = mapping.meaning;
      const unitKey = mapping.unit;
      const phoneticKey = mapping.phonetic;
      const pageKey = mapping.page;

      const newWords = parsedRows.map((row, i) => {
        const word = row[wordKey];
        const meaning = row[meaningKey];
        const unitVal = row[unitKey] || "General";
        if (!word || !meaning) {
          throw new Error(`Row ${i + 1}: missing word or meaning.`);
        }
        return {
          unit: String(unitVal),
          word: String(word),
          meaning: String(meaning),
          phonetic: phoneticKey ? String(row[phoneticKey] || "") : "",
          page: pageKey ? String(row[pageKey] || "") : undefined,
          publisher: metadata.publisher,
          grade: metadata.grade,
          semester: metadata.semester,
        };
      });

      const result = await onAddWords(newWords);
      let msg = `Successfully imported ${result.added} words.`;
      if (result.skipped > 0) msg += ` ${result.skipped} skipped.`;
      setSuccess(msg);
      setStep("upload");
      setParsedRows([]);
    } catch (err: any) {
      setError(err.message || "Import failed.");
    }
  };

  const handleClear = () => {
    if (confirm("Delete ALL words and mistake records? This cannot be undone.")) {
      onClearAll();
      setSuccess("All data cleared.");
    }
  };

  if (step === "metadata") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-card p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-stone-800">Book Info</h2>
            <p className="text-sm text-stone-400 mt-0.5">{parsedRows.length} words detected</p>
          </div>

          {/* Column mapping */}
          {detectedHeaders.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Column Mapping</p>
              {["word", "meaning", "unit", "phonetic", "page"].map((field) => (
                <div key={field} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-stone-600 w-20 shrink-0 capitalize">{field}</span>
                  <select
                    value={mapping[field] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-stone-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                  >
                    <option value="">-- skip --</option>
                    {detectedHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Publisher / Grade / Semester */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">Metadata</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {PUBLISHERS.map((pub) => (
                <button
                  key={pub}
                  onClick={() => setMetadata((m) => ({ ...m, publisher: pub }))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    metadata.publisher === pub
                      ? "bg-brand-500 text-white shadow-sm"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {pub}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {GRADES.map((g) => (
                <button
                  key={g}
                  onClick={() => setMetadata((m) => ({ ...m, grade: g }))}
                  className={`w-10 h-10 rounded-full text-sm font-medium transition-all ${
                    metadata.grade === g
                      ? "bg-brand-500 text-white shadow-sm"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {SEMESTERS.map((sem) => (
                <button
                  key={sem}
                  onClick={() => setMetadata((m) => ({ ...m, semester: sem }))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    metadata.semester === sem
                      ? "bg-brand-500 text-white shadow-sm"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {sem}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Preview (first 3 rows)</p>
            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 text-xs text-stone-500 uppercase">
                    <th className="px-3 py-2 text-left">Word</th>
                    <th className="px-3 py-2 text-left">Meaning</th>
                    <th className="px-3 py-2 text-left">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-t border-stone-100">
                      <td className="px-3 py-2 font-medium text-stone-800">{row[mapping.word]}</td>
                      <td className="px-3 py-2 text-stone-600">{row[mapping.meaning]}</td>
                      <td className="px-3 py-2 text-stone-600">{row[mapping.unit] || "General"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { setStep("upload"); setParsedRows([]); }}
              className="flex-1 py-3 rounded-xl font-semibold text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!mapping.word || !mapping.meaning}
              className="flex-1 py-3 rounded-xl font-semibold text-white bg-brand-500 hover:bg-brand-600 transition-colors disabled:opacity-50 shadow-bubble cursor-pointer"
            >
              Import {parsedRows.length} Words
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-800">Vocabulary Management</h2>
            <p className="text-sm text-stone-400 mt-0.5">{totalWords} words in library</p>
          </div>
        </div>

        {/* Import options */}
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-stone-300 rounded-2xl hover:border-brand-400 hover:bg-brand-50/30 transition-colors cursor-pointer">
            <Upload className="w-8 h-8 text-stone-400" />
            <div className="text-center">
              <p className="text-sm font-semibold text-stone-700">Upload File</p>
              <p className="text-xs text-stone-400 mt-0.5">JSON or CSV</p>
            </div>
            <input
              type="file"
              accept=".json,.csv"
              onChange={handleFileUpload}
              className="hidden"
              ref={fileInputRef}
            />
          </label>

          <button
            onClick={handlePaste}
            className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-stone-300 rounded-2xl hover:border-brand-400 hover:bg-brand-50/30 transition-colors cursor-pointer"
          >
            <FileText className="w-8 h-8 text-stone-400" />
            <div className="text-center">
              <p className="text-sm font-semibold text-stone-700">Paste Data</p>
              <p className="text-xs text-stone-400 mt-0.5">CSV / tab-separated</p>
            </div>
          </button>
        </div>

        {/* Format hint */}
        <div className="bg-stone-50 rounded-xl p-3 text-xs text-stone-500 leading-relaxed">
          <p className="font-medium text-stone-600 mb-1">Accepted formats:</p>
          <p><strong>CSV:</strong> word,meaning,unit,phonetic,page (header row required)</p>
          <p><strong>TSV:</strong> Paste from Excel/Sheets — columns are auto-detected</p>
          <p><strong>JSON:</strong> Array of objects, or {"{"}"vocabulary_list":{"{"}"Unit 1": [...]{"}"}{"}"}</p>
        </div>

        <div className="border-t border-stone-200 pt-6">
          <ManualWordEntry totalWords={totalWords} />
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-success-50 border border-success-200 rounded-xl flex items-start gap-2 text-success-700 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Danger zone */}
        <div className="border-t border-stone-200 pt-6">
          <h3 className="text-sm font-bold text-rose-600 mb-1">Danger Zone</h3>
          <p className="text-xs text-stone-400 mb-3">Permanently delete all imported words and learning progress.</p>
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-2 px-4 py-2 border border-rose-300 text-rose-600 rounded-xl text-sm font-medium hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  );
};
