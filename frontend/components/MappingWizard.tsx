import React, { useState, useEffect, useMemo } from 'react';
import { Map, Check, X } from 'lucide-react';

interface MappingWizardProps {
  detectedKeys: string[];
  rawData: any[];
  onConfirm: (mapping: { word: string; meaning: string; unit: string; phonetic: string; page: string; }) => void;
  onCancel: () => void;
}

type Field = 'word' | 'meaning' | 'unit' | 'phonetic' | 'page';

const getSmartMapping = (keys: string[]): Record<Field, string> => {
  const mapping: Record<Field, string> = { word: '', meaning: '', unit: '', phonetic: '', page: '' };
  const lowerKeys = keys.map(k => k.toLowerCase());

  const synonyms: Record<Field, string[]> = {
    word: ['word', 'term', 'english', 'vocab', 'headword'],
    meaning: ['meaning', 'definition', 'translation', 'chinese', 'explanation'],
    unit: ['unit', 'lesson', 'category', 'chapter', 'list'],
    phonetic: ['phonetic', 'ipa', 'pronunciation', 'sound', 'symbol'],
    page: ['page', 'p.', 'location'],
  };

  for (const field in synonyms) {
    const fieldTyped = field as Field;
    for (const syn of synonyms[fieldTyped]) {
      const index = lowerKeys.findIndex(lk => lk.includes(syn));
      if (index !== -1) {
        mapping[fieldTyped] = keys[index];
        break;
      }
    }
  }
  return mapping;
};

const MappingField: React.FC<{
  label: string;
  isOptional?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
}> = ({ label, isOptional = false, value, onChange, options }) => (
  <div>
    <label className="block text-sm font-medium text-stone-700 mb-1">
      {label} {!isOptional && <span className="text-red-500">*</span>}
    </label>
    <select
      value={value}
      onChange={onChange}
      className="w-full p-2 border border-stone-300 rounded-md bg-white shadow-sm focus:ring-slate-500 focus:border-slate-500"
    >
      <option value="">-- Select Field --</option>
      {options.map(key => (
        <option key={key} value={key}>{key}</option>
      ))}
    </select>
  </div>
);

export const MappingWizard: React.FC<MappingWizardProps> = ({ detectedKeys, rawData, onConfirm, onCancel }) => {
  const [mapping, setMapping] = useState<Record<Field, string>>(() => getSmartMapping(detectedKeys));

  const handleMappingChange = (field: Field) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMapping(prev => ({ ...prev, [field]: e.target.value }));
  };

  const isMappingValid = useMemo(() => {
    return mapping.word && mapping.meaning && mapping.unit;
  }, [mapping]);

  const previewData = useMemo(() => {
    return rawData.slice(0, 5).map(row => ({
      word: mapping.word ? row[mapping.word] : '?',
      meaning: mapping.meaning ? row[mapping.meaning] : '?',
      unit: mapping.unit ? row[mapping.unit] : '?',
      phonetic: mapping.phonetic ? row[mapping.phonetic] : '-',
      page: mapping.page ? row[mapping.page] : '-',
    }));
  }, [mapping, rawData]);

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white rounded-lg border border-stone-200">
      <div className="mb-8 pb-4 border-b border-stone-200">
        <h2 className="text-3xl font-serif font-bold text-stone-900 flex items-center">
          <Map className="w-8 h-8 mr-3 text-slate-600" />
          Map Your Fields
        </h2>
        <p className="text-stone-600 mt-2">Match the columns from your file to the app's required fields.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-x-8 gap-y-6 mb-8">
        <MappingField label="Word" value={mapping.word} onChange={handleMappingChange('word')} options={detectedKeys} />
        <MappingField label="Meaning / Translation" value={mapping.meaning} onChange={handleMappingChange('meaning')} options={detectedKeys} />
        <MappingField label="Unit / Category" value={mapping.unit} onChange={handleMappingChange('unit')} options={detectedKeys} />
        <MappingField label="Phonetic (Optional)" isOptional value={mapping.phonetic} onChange={handleMappingChange('phonetic')} options={detectedKeys} />
        <MappingField label="Page (Optional)" isOptional value={mapping.page} onChange={handleMappingChange('page')} options={detectedKeys} />
      </div>

      <div className="mb-8">
        <h3 className="text-xl font-serif font-semibold text-stone-800 mb-3">Import Preview</h3>
        <div className="overflow-x-auto border border-stone-200 rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-xs text-stone-600 uppercase">
              <tr>
                <th className="px-4 py-2">Word</th>
                <th className="px-4 py-2">Meaning</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Phonetic</th>
                <th className="px-4 py-2">Page</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {previewData.map((row, index) => (
                <tr key={index} className="border-b border-stone-200 last:border-b-0">
                  <td className="px-4 py-2 font-medium text-stone-900">{String(row.word)}</td>
                  <td className="px-4 py-2 text-stone-700">{String(row.meaning)}</td>
                  <td className="px-4 py-2 text-stone-700">{String(row.unit)}</td>
                  <td className="px-4 py-2 text-stone-500">{String(row.phonetic)}</td>
                  <td className="px-4 py-2 text-stone-500">{String(row.page)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4 pt-6 border-t border-stone-200">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-medium text-stone-700 bg-stone-100 rounded-md hover:bg-stone-200 transition-colors"
        >
          <X className="w-4 h-4 inline mr-1" />
          Cancel
        </button>
        <button
          onClick={() => onConfirm(mapping)}
          disabled={!isMappingValid}
          className="px-5 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-md hover:bg-slate-900 transition-colors disabled:bg-stone-300 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4 inline mr-1" />
          Confirm and Import {rawData.length} Words
        </button>
      </div>
    </div>
  );
};
