// Ebbinghaus intervals in days: 1, 2, 4, 7, 15, 30
export const EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15, 30];

export const getNextReviewDate = (reviewCount: number): number => {
  const intervalDays = EBBINGHAUS_INTERVALS[Math.min(reviewCount, EBBINGHAUS_INTERVALS.length - 1)];
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + intervalDays);
  // Reset to start of day for consistent review triggers
  nextDate.setHours(0, 0, 0, 0);
  return nextDate.getTime();
};

export const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

export const normalizeWord = (word: string): string => {
  // Remove all spaces and convert to lower case for validation.
  return word.replace(/\s/g, '').toLowerCase();
};
