import { Env, PublicUser, hashPassword } from "./_helpers";

export interface UserRecord {
  id: number;
  username: string;
  usernameNormalized: string;
  role: "admin" | "user";
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  createdAt: number;
  updatedAt: number;
}

export interface WordRecord {
  id: string;
  unit: string;
  word: string;
  phonetic: string;
  meaning: string;
  page?: string;
  ownerId: number;
}

export interface MistakeRecord {
  id?: number;
  wordId: string;
  userId: number;
  nextReviewDate: number;
  reviewCount: number;
}

const USERS_INDEX = "meta:users:index";

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, username: user.username, role: user.role };
}

async function getJson<T>(env: Env, key: string, fallback: T): Promise<T> {
  const value = await env.VOCAB_KV.get(key, "json");
  return (value ?? fallback) as T;
}

async function putJson<T>(env: Env, key: string, value: T): Promise<void> {
  await env.VOCAB_KV.put(key, JSON.stringify(value));
}

function usernameKey(normalized: string): string {
  return `user:username:${normalized}`;
}

function userKey(id: number): string {
  return `user:${id}`;
}

function wordsIndexKey(ownerId: number): string {
  return `words:index:${ownerId}`;
}

function wordKey(ownerId: number, wordId: string): string {
  return `word:${ownerId}:${wordId}`;
}

function mistakesIndexKey(userId: number): string {
  return `mistakes:index:${userId}`;
}

function mistakeKey(userId: number, wordId: string): string {
  return `mistake:${userId}:${wordId}`;
}

export async function ensureAdmin(env: Env): Promise<void> {
  const existing = await env.VOCAB_KV.get(usernameKey("admin"));
  if (existing) return;
  if (!env.ADMIN_INITIAL_PASSWORD) {
    throw new Error("ADMIN_INITIAL_PASSWORD is not configured.");
  }
  await createUser(env, "admin", env.ADMIN_INITIAL_PASSWORD, "admin");
}

export async function createUser(
  env: Env,
  username: string,
  password: string,
  role: "admin" | "user" = "user",
): Promise<UserRecord> {
  const normalized = normalizeUsername(username);
  const existing = await env.VOCAB_KV.get(usernameKey(normalized));
  if (existing) throw new Error("Username already exists.");

  const userIds = await getJson<number[]>(env, USERS_INDEX, []);
  const nextId = userIds.length === 0 ? 1 : Math.max(...userIds) + 1;
  const passwordResult = await hashPassword(password);
  const now = Date.now();
  const user: UserRecord = {
    id: nextId,
    username: username.trim(),
    usernameNormalized: normalized,
    role,
    passwordHash: passwordResult.hash,
    passwordSalt: passwordResult.salt,
    passwordIterations: passwordResult.iterations,
    createdAt: now,
    updatedAt: now,
  };
  await Promise.all([
    putJson(env, userKey(nextId), user),
    putJson(env, usernameKey(normalized), nextId),
    putJson(env, USERS_INDEX, Array.from(new Set([...userIds, nextId]))),
  ]);
  return user;
}

export async function getUserByUsername(
  env: Env,
  username: string,
): Promise<UserRecord | null> {
  const id = (await env.VOCAB_KV.get(
    usernameKey(normalizeUsername(username)),
    "json",
  )) as number | null;
  if (!id) return null;
  return getUserById(env, id);
}

export async function getUserById(
  env: Env,
  id: number,
): Promise<UserRecord | null> {
  return env.VOCAB_KV.get(userKey(id), "json") as Promise<UserRecord | null>;
}

export async function getAllUsers(env: Env): Promise<PublicUser[]> {
  const userIds = await getJson<number[]>(env, USERS_INDEX, []);
  const users = await Promise.all(userIds.map((id) => getUserById(env, id)));
  return users.filter((u): u is UserRecord => Boolean(u)).map(toPublicUser);
}

export async function updateUserRole(
  env: Env,
  id: number,
  role: "admin" | "user",
): Promise<PublicUser> {
  const user = await getUserById(env, id);
  if (!user) throw new Error("User not found.");
  if (user.usernameNormalized === "admin" && role !== "admin") {
    throw new Error("The default admin user's role cannot be changed.");
  }
  const updated: UserRecord = { ...user, role, updatedAt: Date.now() };
  await putJson(env, userKey(id), updated);
  return toPublicUser(updated);
}

export async function addWords(
  env: Env,
  ownerId: number,
  words: Omit<WordRecord, "id" | "ownerId">[],
): Promise<WordRecord[]> {
  const currentIds = await getJson<string[]>(env, wordsIndexKey(ownerId), []);
  const created = words.map((word) => ({
    ...word,
    id: crypto.randomUUID(),
    ownerId,
  }));
  const nextIds = Array.from(
    new Set([...currentIds, ...created.map((w) => w.id)]),
  );
  await Promise.all([
    ...created.map((word) => putJson(env, wordKey(ownerId, word.id), word)),
    putJson(env, wordsIndexKey(ownerId), nextIds),
  ]);
  return created;
}

export async function getWords(
  env: Env,
  ownerId: number,
): Promise<WordRecord[]> {
  const ids = await getJson<string[]>(env, wordsIndexKey(ownerId), []);
  const words = await Promise.all(
    ids.map(
      (id) =>
        env.VOCAB_KV.get(
          wordKey(ownerId, id),
          "json",
        ) as Promise<WordRecord | null>,
    ),
  );
  return words.filter((w): w is WordRecord => Boolean(w));
}

export async function updateWord(
  env: Env,
  ownerId: number,
  wordId: string,
  updates: Partial<Omit<WordRecord, "id" | "ownerId">>,
): Promise<WordRecord> {
  const existing = (await env.VOCAB_KV.get(
    wordKey(ownerId, wordId),
    "json",
  )) as WordRecord | null;
  if (!existing) throw new Error("Word not found.");
  const updated: WordRecord = { ...existing, ...updates };
  await putJson(env, wordKey(ownerId, wordId), updated);
  return updated;
}

export async function deleteWord(
  env: Env,
  ownerId: number,
  wordId: string,
): Promise<void> {
  const currentIds = await getJson<string[]>(env, wordsIndexKey(ownerId), []);
  const nextIds = currentIds.filter((id) => id !== wordId);
  await Promise.all([
    env.VOCAB_KV.delete(wordKey(ownerId, wordId)),
    putJson(env, wordsIndexKey(ownerId), nextIds),
  ]);
}

export async function deleteWords(
  env: Env,
  ownerId: number,
  wordIds: string[],
): Promise<void> {
  const currentIds = await getJson<string[]>(env, wordsIndexKey(ownerId), []);
  const deleteSet = new Set(wordIds);
  const nextIds = currentIds.filter((id) => !deleteSet.has(id));
  await Promise.all([
    ...wordIds.map((id) => env.VOCAB_KV.delete(wordKey(ownerId, id))),
    putJson(env, wordsIndexKey(ownerId), nextIds),
  ]);
}

export async function clearAllUserData(
  env: Env,
  userId: number,
): Promise<void> {
  const wordIds = await getJson<string[]>(env, wordsIndexKey(userId), []);
  const mistakeIds = await getJson<string[]>(env, mistakesIndexKey(userId), []);
  await Promise.all([
    ...wordIds.map((id) => env.VOCAB_KV.delete(wordKey(userId, id))),
    ...mistakeIds.map((id) => env.VOCAB_KV.delete(mistakeKey(userId, id))),
    env.VOCAB_KV.delete(wordsIndexKey(userId)),
    env.VOCAB_KV.delete(mistakesIndexKey(userId)),
  ]);
}

export async function getMistakes(
  env: Env,
  userId: number,
): Promise<MistakeRecord[]> {
  const ids = await getJson<string[]>(env, mistakesIndexKey(userId), []);
  const mistakes = await Promise.all(
    ids.map(
      (id) =>
        env.VOCAB_KV.get(
          mistakeKey(userId, id),
          "json",
        ) as Promise<MistakeRecord | null>,
    ),
  );
  return mistakes.filter((m): m is MistakeRecord => Boolean(m));
}

export async function addOrUpdateMistakes(
  env: Env,
  mistakes: Omit<MistakeRecord, "id">[],
): Promise<void> {
  const byUser = new Map<number, Omit<MistakeRecord, "id">[]>();
  mistakes.forEach((mistake) => {
    byUser.set(mistake.userId, [
      ...(byUser.get(mistake.userId) ?? []),
      mistake,
    ]);
  });
  await Promise.all(
    Array.from(byUser.entries()).map(async ([userId, userMistakes]) => {
      const currentIds = await getJson<string[]>(
        env,
        mistakesIndexKey(userId),
        [],
      );
      const nextIds = Array.from(
        new Set([...currentIds, ...userMistakes.map((m) => m.wordId)]),
      );
      await Promise.all([
        ...userMistakes.map((mistake) =>
          putJson(env, mistakeKey(userId, mistake.wordId), mistake),
        ),
        putJson(env, mistakesIndexKey(userId), nextIds),
      ]);
    }),
  );
}

export async function removeMistake(
  env: Env,
  userId: number,
  wordId: string,
): Promise<void> {
  const currentIds = await getJson<string[]>(env, mistakesIndexKey(userId), []);
  const nextIds = currentIds.filter((id) => id !== wordId);
  await Promise.all([
    env.VOCAB_KV.delete(mistakeKey(userId, wordId)),
    putJson(env, mistakesIndexKey(userId), nextIds),
  ]);
}
