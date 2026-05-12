import { IDBPDatabase, openDB } from 'idb';
import { User, Word, MistakeRecord } from './types';
import { hashPassword } from './auth';

const DB_NAME = 'VocabMasterDB';
const DB_VERSION = 1;

let db: IDBPDatabase;

async function initDB() {
  if (db) return;

  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (!db.objectStoreNames.contains('users')) {
        const userStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
        userStore.createIndex('username', 'username', { unique: true });
      }
      if (!db.objectStoreNames.contains('words')) {
        const wordStore = db.createObjectStore('words', { keyPath: 'id' });
        wordStore.createIndex('ownerId', 'ownerId');
      }
      if (!db.objectStoreNames.contains('mistakes')) {
        const mistakeStore = db.createObjectStore('mistakes', { keyPath: 'id', autoIncrement: true });
        mistakeStore.createIndex('userId', 'userId');
        mistakeStore.createIndex('wordId_userId', ['wordId', 'userId'], { unique: true });
      }
    },
  });

  // Seed default admin user if it doesn't exist
  const adminUser = await getUser('admin');
  if (!adminUser) {
    const passwordHash = await hashPassword('passw0rd');
    await db.add('users', { username: 'admin', passwordHash, role: 'admin' });
  }
}

// --- User Functions ---
export const addUser = async (user: Omit<User, 'id'>): Promise<IDBValidKey> => {
  await initDB();
  return db.add('users', user);
};

export const getUser = async (username: string): Promise<User | undefined> => {
  await initDB();
  return db.getFromIndex('users', 'username', username);
};

export const getAllUsers = async (): Promise<User[]> => {
  await initDB();
  return db.getAll('users');
};

export const updateUser = async (user: User): Promise<IDBValidKey> => {
  await initDB();
  return db.put('users', user);
};

// --- Word Functions ---
export const addWords = async (words: Omit<Word, 'id' | 'ownerId'>[], ownerId: number): Promise<void> => {
  await initDB();
  const tx = db.transaction('words', 'readwrite');
  const promises = words.map(word => {
    const newWord: Omit<Word, 'id'> & { id: string } = {
      ...word,
      id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
      ownerId,
    };
    return tx.store.add(newWord);
  });
  await Promise.all([...promises, tx.done]);
};

export const getWords = async (ownerId: number): Promise<Word[]> => {
  await initDB();
  return db.getAllFromIndex('words', 'ownerId', ownerId);
};

export const clearAllUserData = async (userId: number): Promise<void> => {
  await initDB();
  const wordTx = db.transaction('words', 'readwrite');
  const wordStore = wordTx.objectStore('words');
  const wordIndex = wordStore.index('ownerId');
  let cursor = await wordIndex.openCursor(userId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await wordTx.done;

  const mistakeTx = db.transaction('mistakes', 'readwrite');
  const mistakeStore = mistakeTx.objectStore('mistakes');
  const mistakeIndex = mistakeStore.index('userId');
  cursor = await mistakeIndex.openCursor(userId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await mistakeTx.done;
};

// --- Mistake Functions ---
export const getMistakes = async (userId: number): Promise<MistakeRecord[]> => {
  await initDB();
  return db.getAllFromIndex('mistakes', 'userId', userId);
};

export const addOrUpdateMistakes = async (mistakes: Omit<MistakeRecord, 'id'>[]): Promise<void> => {
  await initDB();
  const tx = db.transaction('mistakes', 'readwrite');
  const store = tx.objectStore('mistakes');
  const promises = mistakes.map(async (mistake) => {
    const existing = await store.index('wordId_userId').get([mistake.wordId, mistake.userId]);
    if (existing) {
      return store.put({ ...existing, ...mistake });
    }
    return store.add(mistake);
  });
  await Promise.all([...promises, tx.done]);
};

export const removeMistake = async (wordId: string, userId: number): Promise<void> => {
  await initDB();
  const tx = db.transaction('mistakes', 'readwrite');
  const store = tx.objectStore('mistakes');
  const index = store.index('wordId_userId');
  const key = await index.getKey([wordId, userId]);
  if (key) {
    await store.delete(key);
  }
  await tx.done;
};
