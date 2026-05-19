import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Plus, Pencil, Trash2, Download, Upload, X, Check,
  AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';
import { Word } from '../types';
import * as db from '../db';
import { MappingWizard } from './MappingWizard';

interface WordLibraryProps {
  currentUserId: number;
}

const PAGE_SIZE = 20;

export const WordLibrary: React.FC<WordLibraryProps> = ({ currentUserId }) => {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 搜索 & 筛选
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // 编辑
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [editForm, setEditForm] = useState<Omit<Word, 'id' | 'ownerId'>>({ unit: '', word: '', phonetic: '', meaning: '' });
  const [saving, setSaving] = useState(false);

  // 新增
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<Omit<Word, 'id' | 'ownerId'>>({ unit: '', word: '', phonetic: '', meaning: '' });
  const [adding, setAdding] = useState(false);

  // 删除
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // 导入
  const [isMapping, setIsMapping] = useState(false);
  const [detectedKeys, setDetectedKeys] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchWords = useCallback(async () => {
    setLoading(true);
    try {
      const result = await db.getWords();
      setWords(result);
    } catch (e: any) {
      setError(e.message || '加载单词库失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWords(); }, [fetchWords]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  // ── 筛选 & 分页 ──────────────────────────────────────────────────────────────

  const units = Array.from(new Set(words.map(w => w.unit))).sort();

  const filtered = words.filter(w => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q);
    const matchUnit = !filterUnit || w.unit === filterUnit;
    return matchSearch && matchUnit;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterUnit]);

  // ── 编辑 ──────────────────────────────────────────────────────────────────────

  const startEdit = (word: Word) => {
    setEditingWord(word);
    setEditForm({ unit: word.unit, word: word.word, phonetic: word.phonetic, meaning: word.meaning, page: word.page });
  };

  const cancelEdit = () => { setEditingWord(null); };

  const saveEdit = async () => {
    if (!editingWord) return;
    if (!editForm.unit.trim() || !editForm.word.trim() || !editForm.meaning.trim()) {
      setError('Unit、单词和释义不能为空');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await db.updateWord(editingWord.id, editingWord.ownerId, editForm);
      setWords(prev => prev.map(w => w.id === updated.id ? updated : w));
      setEditingWord(null);
      showSuccess('单词已更新');
    } catch (e: any) {
      setError(e.message || '更新失败');
    } finally {
      setSaving(false);
    }
  };

  // ── 新增 ──────────────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!addForm.unit.trim() || !addForm.word.trim() || !addForm.meaning.trim()) {
      setError('Unit、单词和释义不能为空');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await db.addWords([addForm], currentUserId);
      await fetchWords();
      setAddForm({ unit: '', word: '', phonetic: '', meaning: '' });
      setShowAddForm(false);
      showSuccess('单词已添加');
    } catch (e: any) {
      setError(e.message || '添加失败');
    } finally {
      setAdding(false);
    }
  };

  // ── 删除 ──────────────────────────────────────────────────────────────────────

  const deleteSingle = async (wordId: string) => {
    if (!window.confirm('确认删除这个单词？')) return;
    setDeletingIds(prev => new Set(prev).add(wordId));
    try {
      await db.deleteWord(wordId, words.find(w => w.id === wordId)?.ownerId ?? null);
      setWords(prev => prev.filter(w => w.id !== wordId));
      setSelectedIds(prev => { const s = new Set(prev); s.delete(wordId); return s; });
      showSuccess('单词已删除');
    } catch (e: any) {
      setError(e.message || '删除失败');
    } finally {
      setDeletingIds(prev => { const s = new Set(prev); s.delete(wordId); return s; });
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`确认删除选中的 ${selectedIds.size} 个单词？`)) return;
    const ids = Array.from(selectedIds);
    ids.forEach(id => setDeletingIds(prev => new Set(prev).add(id)));
    try {
      await db.deleteWords(ids, words.find(w => w.id === ids[0])?.ownerId ?? null);
      setWords(prev => prev.filter(w => !selectedIds.has(w.id)));
      setSelectedIds(new Set());
      showSuccess(`已删除 ${ids.length} 个单词`);
    } catch (e: any) {
      setError(e.message || '批量删除失败');
    } finally {
      setDeletingIds(new Set());
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length && paginated.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map(w => w.id)));
    }
  };

  // ── 导出 ──────────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    try {
      const allWords = await db.exportWords();
      const json = JSON.stringify(allWords, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vocab-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess('单词库已导出');
    } catch (e: any) {
      setError(e.message || '导出失败');
    }
  };

  // ── 导入 ──────────────────────────────────────────────────────────────────────

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!Array.isArray(parsed)) throw new Error('JSON 文件必须包含一个数组');
        let flat: any[] = [];
        if (parsed.length > 0 && parsed[0]?.vocabulary_list) {
          const vl = parsed[0].vocabulary_list;
          for (const unit in vl) {
            if (Object.prototype.hasOwnProperty.call(vl, unit) && Array.isArray(vl[unit])) {
              vl[unit].forEach((obj: any) => { if (obj && typeof obj === 'object') flat.push({ ...obj, unit }); });
            }
          }
        } else {
          flat = parsed;
        }
        if (flat.length === 0 || typeof flat[0] !== 'object') throw new Error('未在 JSON 中找到有效的单词对象');
        setRawData(flat);
        setDetectedKeys(Object.keys(flat[0]));
        setIsMapping(true);
      } catch (err: any) {
        setError(err.message || '解析 JSON 失败');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async (mapping: { word: string; meaning: string; unit: string; phonetic: string; page: string }) => {
    try {
      const newWords = rawData.map((item, i) => {
        const word = item[mapping.word];
        const meaning = item[mapping.meaning];
        const unit = item[mapping.unit];
        if (!word || !meaning || !unit) throw new Error(`第 ${i + 1} 行数据缺少必填字段`);
        return {
          unit: String(unit),
          word: String(word),
          meaning: String(meaning),
          phonetic: mapping.phonetic ? String(item[mapping.phonetic] || '') : '',
          page: mapping.page ? String(item[mapping.page] || '') : undefined,
        };
      });
      await db.addWords(newWords, currentUserId);
      await fetchWords();
      showSuccess(`成功导入 ${newWords.length} 个单词`);
    } catch (e: any) {
      setError(e.message || '导入失败');
    } finally {
      setIsMapping(false);
      setRawData([]);
      setDetectedKeys([]);
    }
  };

  // ── 渲染 ──────────────────────────────────────────────────────────────────────

  if (isMapping) {
    return (
      <MappingWizard
        detectedKeys={detectedKeys}
        rawData={rawData}
        onConfirm={handleConfirmImport}
        onCancel={() => { setIsMapping(false); setRawData([]); setDetectedKeys([]); }}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-serif font-bold text-stone-900">单词库管理</h2>
          <p className="text-stone-500 mt-1">共 {words.length} 个单词</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 border border-stone-300 text-stone-700 rounded-md hover:bg-stone-50 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            导出
          </button>
          <label className="inline-flex items-center gap-2 px-4 py-2 border border-stone-300 text-stone-700 rounded-md hover:bg-stone-50 text-sm font-medium transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            导入
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>
          <button
            onClick={() => { setShowAddForm(true); setError(null); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-900 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            新增单词
          </button>
        </div>
      </div>

      {/* 消息提示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-800 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-green-800 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* 新增表单 */}
      {showAddForm && (
        <div className="mb-6 p-5 bg-stone-50 border border-stone-200 rounded-lg">
          <h3 className="font-semibold text-stone-800 mb-4">新增单词</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              placeholder="Unit *"
              value={addForm.unit}
              onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))}
              className="border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <input
              placeholder="单词 *"
              value={addForm.word}
              onChange={e => setAddForm(f => ({ ...f, word: e.target.value }))}
              className="border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <input
              placeholder="音标"
              value={addForm.phonetic}
              onChange={e => setAddForm(f => ({ ...f, phonetic: e.target.value }))}
              className="border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <input
              placeholder="页码"
              value={addForm.page || ''}
              onChange={e => setAddForm(f => ({ ...f, page: e.target.value }))}
              className="border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <input
            placeholder="释义 *"
            value={addForm.meaning}
            onChange={e => setAddForm(f => ({ ...f, meaning: e.target.value }))}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={adding}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-900 text-sm font-medium disabled:opacity-50"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              保存
            </button>
            <button
              onClick={() => { setShowAddForm(false); setError(null); }}
              className="px-4 py-2 border border-stone-300 text-stone-700 rounded-md hover:bg-stone-50 text-sm font-medium"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 搜索 & 筛选 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            placeholder="搜索单词或释义…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <select
          value={filterUnit}
          onChange={e => setFilterUnit(e.target.value)}
          className="border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">全部 Unit</option>
          {units.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 p-3 bg-slate-100 rounded-md">
          <span className="text-sm text-slate-700 font-medium">已选 {selectedIds.size} 项</span>
          <button
            onClick={deleteSelected}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            批量删除
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 text-slate-600 hover:text-slate-800 text-sm"
          >
            取消选择
          </button>
        </div>
      )}

      {/* 单词表格 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-stone-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          加载中…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          {searchQuery || filterUnit ? '没有符合条件的单词' : '暂无单词，请导入或新增'}
        </div>
      ) : (
        <>
          <div className="border border-stone-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={paginated.length > 0 && selectedIds.size === paginated.length}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-stone-600 w-24">Unit</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-600 w-36">单词</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-600 w-28">音标</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-600">释义</th>
                  <th className="px-4 py-3 text-right font-medium text-stone-600 w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {paginated.map(word => (
                  editingWord?.id === word.id ? (
                    <tr key={word.id} className="bg-blue-50">
                      <td className="px-3 py-2" />
                      <td className="px-2 py-2">
                        <input
                          value={editForm.unit}
                          onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))}
                          className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={editForm.word}
                          onChange={e => setEditForm(f => ({ ...f, word: e.target.value }))}
                          className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={editForm.phonetic}
                          onChange={e => setEditForm(f => ({ ...f, phonetic: e.target.value }))}
                          className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={editForm.meaning}
                          onChange={e => setEditForm(f => ({ ...f, meaning: e.target.value }))}
                          className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            title="保存"
                          >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={cancelEdit} className="p-1.5 border border-stone-300 rounded hover:bg-stone-100" title="取消">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={word.id} className={`hover:bg-stone-50 ${selectedIds.has(word.id) ? 'bg-slate-50' : ''}`}>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(word.id)}
                          onChange={() => toggleSelect(word.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3 text-stone-500">{word.unit}</td>
                      <td className="px-4 py-3 font-medium text-stone-900">{word.word}</td>
                      <td className="px-4 py-3 text-stone-400 font-mono text-xs">{word.phonetic}</td>
                      <td className="px-4 py-3 text-stone-600">{word.meaning}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEdit(word)}
                            className="p-1.5 text-stone-400 hover:text-slate-700 hover:bg-stone-100 rounded"
                            title="编辑"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteSingle(word.id)}
                            disabled={deletingIds.has(word.id)}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                            title="删除"
                          >
                            {deletingIds.has(word.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-stone-600">
              <span>第 {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} 条，共 {filtered.length} 条</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded hover:bg-stone-100 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3">第 {currentPage} / {totalPages} 页</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded hover:bg-stone-100 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
