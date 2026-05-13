import { useState, useEffect, useCallback } from "react";
import { Word, MistakeRecord, User } from "./types";
import { getNextReviewDate, normalizeWord } from "./utils";
import * as db from "./db";

export const useAppStore = (currentUser: User | null) => {
  const [words, setWords] = useState<Word[]>([]);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    if (!currentUser) {
      setWords([]);
      setMistakes([]);
      setIsLoaded(true);
      return;
    }
    setIsLoaded(false);
    try {
      const userWords = await db.getWords();
      const userMistakes = await db.getMistakes(currentUser.id);
      setWords(userWords);
      setMistakes(userMistakes);
    } catch (e) {
      console.error("Failed to load data from API", e);
    } finally {
      setIsLoaded(true);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addWordsToStore = useCallback(
    async (importedWords: Omit<Word, "id" | "ownerId">[]) => {
      if (!currentUser) return { added: 0, skipped: 0 };

      const existingWordSet = new Set(words.map((w) => normalizeWord(w.word)));

      const wordsToAdd = importedWords.filter(
        (newWord) => !existingWordSet.has(normalizeWord(newWord.word)),
      );

      const skippedCount = importedWords.length - wordsToAdd.length;

      if (wordsToAdd.length > 0) {
        await db.addWords(wordsToAdd, currentUser.id);
        await fetchData(); // Refresh data from API
      }

      return { added: wordsToAdd.length, skipped: skippedCount };
    },
    [currentUser, fetchData, words],
  );

  const clearAllUserDataFromStore = useCallback(async () => {
    if (!currentUser) return;
    await db.clearAllUserData(currentUser.id);
    await fetchData();
  }, [currentUser, fetchData]);

  const addMistakesToStore = useCallback(
    async (wordIds: string[]) => {
      if (!currentUser) return;

      const newMistakesToAdd = wordIds.map((id) => ({
        wordId: id,
        userId: currentUser.id,
        reviewCount: 0,
        nextReviewDate: getNextReviewDate(0),
      }));

      // 乐观更新 UI
      setMistakes((prevMistakes) => {
        const updatedMistakes = [...prevMistakes];
        newMistakesToAdd.forEach((newMistake) => {
          const existingIndex = updatedMistakes.findIndex(
            (m) => m.wordId === newMistake.wordId,
          );
          if (existingIndex === -1) {
            updatedMistakes.push(newMistake);
          } else {
            updatedMistakes[existingIndex] = {
              ...updatedMistakes[existingIndex],
              reviewCount: 0,
              nextReviewDate: getNextReviewDate(0),
            };
          }
        });
        return updatedMistakes;
      });

      // 等待 API 写入，失败时静默记录（乐观更新已经更新了 UI，不中断测试流程）
      try {
        await db.addOrUpdateMistakes(newMistakesToAdd);
      } catch (e) {
        console.error("Failed to persist mistakes:", e);
        // 不调 fetchData()，避免触发 loading 状态打断测试
      }
    },
    [currentUser],
  );

  const handleReviewResult = useCallback(
    async (wordId: string, isCorrect: boolean) => {
      if (!currentUser) return;

      const mistakeIndex = mistakes.findIndex((m) => m.wordId === wordId);
      if (mistakeIndex === -1) return;

      const mistake = mistakes[mistakeIndex];
      let updatedMistake: MistakeRecord;

      if (isCorrect) {
        updatedMistake = {
          ...mistake,
          reviewCount: mistake.reviewCount + 1,
          nextReviewDate: getNextReviewDate(mistake.reviewCount + 1),
        };
      } else {
        updatedMistake = {
          ...mistake,
          reviewCount: 0,
          nextReviewDate: getNextReviewDate(0),
        };
      }

      // 乐观更新 UI
      setMistakes((prevMistakes) => {
        const newMistakes = [...prevMistakes];
        newMistakes[mistakeIndex] = updatedMistake;
        return newMistakes;
      });

      // 等待 API 写入，失败时从服务器重新加载
      try {
        await db.addOrUpdateMistakes([updatedMistake]);
      } catch (e) {
        console.error(
          "Failed to persist review result, refreshing from server:",
          e,
        );
        await fetchData();
      }
    },
    [currentUser, mistakes, fetchData],
  );

  const removeMistakeFromStore = useCallback(
    async (wordId: string) => {
      if (!currentUser) return;

      // 乐观更新 UI
      setMistakes((prevMistakes) =>
        prevMistakes.filter((m) => m.wordId !== wordId),
      );

      // 等待 API 写入，失败时从服务器重新加载
      try {
        await db.removeMistake(wordId, currentUser.id);
      } catch (e) {
        console.error("Failed to remove mistake, refreshing from server:", e);
        await fetchData();
      }
    },
    [currentUser, fetchData],
  );

  return {
    words,
    mistakes,
    isLoaded,
    addWords: addWordsToStore,
    clearAllData: clearAllUserDataFromStore,
    addMistakes: addMistakesToStore,
    handleReviewResult,
    removeMistake: removeMistakeFromStore,
  };
};
