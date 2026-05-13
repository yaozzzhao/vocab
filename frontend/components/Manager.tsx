import React, { useState, useRef } from "react";
import {
  Upload,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { Word } from "../types";
import { MappingWizard } from "./MappingWizard";

interface ManagerProps {
  onAddWords: (
    words: Omit<Word, "id" | "ownerId">[],
  ) => Promise<{ added: number; skipped: number }>;
  onClearAll: () => void;
  totalWords: number;
}

interface WordMetadata {
  publisher: string;
  grade: number;
  semester: string;
}

const PUBLISHERS = ["PEP (人教版)", "BJNSP (北师大版)", "Other"];
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SEMESTERS = ["Semester 1 (上册)", "Semester 2 (下册)"];

export const Manager: React.FC<ManagerProps> = ({
  onAddWords,
  onClearAll,
  totalWords,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSelectingMeta, setIsSelectingMeta] = useState(false);
  const [metadata, setMetadata] = useState<WordMetadata>({
    publisher: PUBLISHERS[0],
    grade: 7,
    semester: SEMESTERS[0],
  });
  const [isMapping, setIsMapping] = useState(false);
  const [detectedKeys, setDetectedKeys] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);
    setSuccess(null);

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        if (!Array.isArray(parsed)) {
          throw new Error("Invalid JSON format. File must contain an array.");
        }

        let flattenedData: any[] = [];

        if (
          parsed.length > 0 &&
          parsed[0] &&
          typeof parsed[0] === "object" &&
          parsed[0].vocabulary_list
        ) {
          const vocabListObject = parsed[0].vocabulary_list;
          if (typeof vocabListObject !== "object" || vocabListObject === null) {
            throw new Error(
              "Invalid 'vocabulary_list' format. It should be an object where keys are unit names.",
            );
          }

          for (const unitName in vocabListObject) {
            if (
              Object.prototype.hasOwnProperty.call(vocabListObject, unitName)
            ) {
              const wordsInUnit = vocabListObject[unitName];
              if (Array.isArray(wordsInUnit)) {
                wordsInUnit.forEach((wordObject) => {
                  if (typeof wordObject === "object" && wordObject !== null) {
                    flattenedData.push({ ...wordObject, unit: unitName });
                  }
                });
              }
            }
          }
        } else {
          flattenedData = parsed;
        }

        if (
          flattenedData.length === 0 ||
          typeof flattenedData[0] !== "object" ||
          flattenedData[0] === null
        ) {
          throw new Error(
            "Could not find any valid word objects in the JSON file. Please check the file structure.",
          );
        }

        const keys = Object.keys(flattenedData[0]);
        setRawData(flattenedData);
        setDetectedKeys(keys);
        setIsSelectingMeta(true);
      } catch (err: any) {
        setError(err.message || "Failed to parse JSON file.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async (mapping: {
    word: string;
    meaning: string;
    unit: string;
    phonetic: string;
    page: string;
  }) => {
    try {
      const newWords = rawData.map((item, index) => {
        const word = item[mapping.word];
        const meaning = item[mapping.meaning];
        const unit = item[mapping.unit];

        if (word === undefined || meaning === undefined || unit === undefined) {
          throw new Error(
            `Missing required data at row ${index + 1}. Please check your mapping and data. Required fields were not found.`,
          );
        }

        return {
          unit: String(unit),
          word: String(word),
          meaning: String(meaning),
          phonetic: mapping.phonetic
            ? String(item[mapping.phonetic] || "")
            : "",
          page: mapping.page ? String(item[mapping.page] || "") : undefined,
          publisher: metadata.publisher,
          grade: metadata.grade,
          semester: metadata.semester,
        };
      });

      const { added, skipped } = await onAddWords(newWords);

      let successMsg = `Successfully imported ${added} new words.`;
      if (skipped > 0) {
        successMsg += ` ${skipped} duplicates were skipped.`;
      }
      setSuccess(successMsg);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsMapping(false);
      setRawData([]);
      setDetectedKeys([]);
    }
  };

  const handleClear = () => {
    if (
      window.confirm(
        "Are you sure you want to delete ALL words and mistake records? This cannot be undone.",
      )
    ) {
      onClearAll();
      setSuccess("All data cleared.");
      setError(null);
    }
  };

  // Step 1: Select metadata
  if (isSelectingMeta) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg border border-stone-200">
        <h2 className="text-3xl font-serif font-bold text-stone-900 mb-2">
          Word Book Info
        </h2>
        <p className="text-stone-500 mb-8">
          Please select the publisher, grade, and semester for this vocabulary
          set.
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              Publisher
            </label>
            <div className="flex flex-wrap gap-2">
              {PUBLISHERS.map((pub) => (
                <button
                  key={pub}
                  onClick={() =>
                    setMetadata((m) => ({ ...m, publisher: pub }))
                  }
                  className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                    metadata.publisher === pub
                      ? "bg-slate-800 text-white border-slate-800"
                      : "border-stone-300 text-stone-600 hover:border-slate-400"
                  }`}
                >
                  {pub}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              Grade
            </label>
            <div className="flex flex-wrap gap-2">
              {GRADES.map((g) => (
                <button
                  key={g}
                  onClick={() => setMetadata((m) => ({ ...m, grade: g }))}
                  className={`w-12 h-10 rounded-md border text-sm font-medium transition-colors ${
                    metadata.grade === g
                      ? "bg-slate-800 text-white border-slate-800"
                      : "border-stone-300 text-stone-600 hover:border-slate-400"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              Semester
            </label>
            <div className="flex flex-wrap gap-2">
              {SEMESTERS.map((sem) => (
                <button
                  key={sem}
                  onClick={() =>
                    setMetadata((m) => ({ ...m, semester: sem }))
                  }
                  className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                    metadata.semester === sem
                      ? "bg-slate-800 text-white border-slate-800"
                      : "border-stone-300 text-stone-600 hover:border-slate-400"
                  }`}
                >
                  {sem}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={() => {
              setIsSelectingMeta(false);
              setRawData([]);
              setDetectedKeys([]);
            }}
            className="px-5 py-2.5 border border-stone-300 text-stone-600 rounded-md hover:bg-stone-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setIsSelectingMeta(false);
              setIsMapping(true);
            }}
            className="flex items-center px-5 py-2.5 bg-slate-800 text-white rounded-md hover:bg-slate-900 transition-colors font-medium"
          >
            Next: Map Fields
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Map fields
  if (isMapping) {
    return (
      <MappingWizard
        detectedKeys={detectedKeys}
        rawData={rawData}
        onConfirm={handleConfirmImport}
        onCancel={() => {
          setIsMapping(false);
          setRawData([]);
          setDetectedKeys([]);
        }}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg border border-stone-200">
      <h2 className="text-3xl font-serif font-bold text-stone-900 mb-8 pb-4 border-b border-stone-200">
        Vocabulary Management
      </h2>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-6 p-4 bg-stone-100 rounded-lg">
          <span className="text-stone-600 font-medium">
            Total words in library:
          </span>
          <span className="text-2xl font-serif font-semibold text-slate-800">
            {totalWords}
          </span>
        </div>

        <div className="border-2 border-dashed border-stone-300 rounded-lg p-8 text-center hover:bg-stone-50 transition-colors">
          <Upload className="w-12 h-12 text-stone-400 mx-auto mb-4" />
          <p className="text-stone-700 font-medium mb-2">
            Import from JSON file
          </p>
          <p className="text-sm text-stone-500 mb-4 max-w-sm mx-auto">
            Upload a JSON file with your vocabulary. You'll select the book info
            and map the fields.
          </p>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
            ref={fileInputRef}
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer inline-flex items-center px-5 py-2.5 bg-slate-800 text-white rounded-md hover:bg-slate-900 transition-colors font-medium"
          >
            Select File
          </label>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-start text-red-800">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-red-600" />
          <div>
            <h4 className="font-bold">Import Error</h4>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md flex items-start text-green-800">
          <CheckCircle2 className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-green-600" />
          <div>
            <h4 className="font-bold">Success</h4>
            <p className="text-sm">{success}</p>
          </div>
        </div>
      )}

      <div className="border-t border-stone-200 pt-6 mt-8">
        <h3 className="text-lg font-serif font-semibold text-red-700 mb-2">
          Danger Zone
        </h3>
        <p className="text-stone-600 text-sm mb-4">
          This will permanently delete all your imported words and learning
          progress. This action cannot be undone.
        </p>
        <button
          onClick={handleClear}
          className="inline-flex items-center px-4 py-2 border border-red-600 text-red-600 rounded-md hover:bg-red-50 transition-colors text-sm font-medium"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All Data
        </button>
      </div>
    </div>
  );
};
