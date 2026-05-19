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
  pos?: string;
  page?: string;
  ownerId: number | null;
  publisher?: string;
  grade?: number;
  semester?: string;
}

export interface MistakeRecord {
  id?: number;
  wordId: string;
  userId: number;
  nextReviewDate: number;
  reviewCount: number;
}

// ── Supabase REST helpers ────────────────────────────────────────────────────

function supabaseHeaders(env: Env): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Prefer": "return=representation",
  };
}

async function sbFetch(
  env: Env,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = `${env.SUPABASE_URL}/rest/v1${path}`;
  return fetch(url, {
    ...options,
    headers: { ...supabaseHeaders(env), ...(options.headers as Record<string, string> ?? {}) },
  });
}

async function sbGet<T>(env: Env, path: string): Promise<T[]> {
  const res = await sbFetch(env, path);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase GET ${path} failed: ${err}`);
  }
  return res.json() as Promise<T[]>;
}

async function sbPost<T>(env: Env, path: string, body: unknown): Promise<T[]> {
  const res = await sbFetch(env, path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase POST ${path} failed: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function sbPatch(env: Env, path: string, body: unknown): Promise<void> {
  const res = await sbFetch(env, path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase PATCH ${path} failed: ${err}`);
  }
}

async function sbDelete(env: Env, path: string): Promise<void> {
  const res = await sbFetch(env, path, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase DELETE ${path} failed: ${err}`);
  }
}

// ── Row types (snake_case from Postgres) ────────────────────────────────────

interface UserRow {
  id: number;
  username: string;
  username_normalized: string;
  role: "admin" | "user";
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  created_at: number;
  updated_at: number;
}

interface WordRow {
  id: string;
  unit: string;
  word: string;
  phonetic: string;
  meaning: string;
  pos: string | null;
  page: string | null;
  owner_id: number | null;
  publisher: string | null;
  grade: number | null;
  semester: string | null;
}

interface MistakeRow {
  id: number;
  word_id: string;
  user_id: number;
  next_review_date: number;
  review_count: number;
}

// ── Converters ───────────────────────────────────────────────────────────────

function rowToUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    usernameNormalized: row.username_normalized,
    role: row.role,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    passwordIterations: row.password_iterations,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToWord(row: WordRow): WordRecord {
  return {
    id: row.id,
    unit: row.unit,
    word: row.word,
    phonetic: row.phonetic,
    meaning: row.meaning,
    pos: row.pos ?? undefined,
    page: row.page ?? undefined,
    ownerId: row.owner_id,
    publisher: row.publisher ?? undefined,
    grade: row.grade ?? undefined,
    semester: row.semester ?? undefined,
  };
}

function rowToMistake(row: MistakeRow): MistakeRecord {
  return {
    id: row.id,
    wordId: row.word_id,
    userId: row.user_id,
    nextReviewDate: row.next_review_date,
    reviewCount: row.review_count,
  };
}

// ── Utilities ────────────────────────────────────────────────────────────────

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, username: user.username, role: user.role };
}

// ── User Repository ──────────────────────────────────────────────────────────

export async function ensureAdmin(env: Env): Promise<void> {
  const rows = await sbGet<UserRow>(
    env,
    `/users?username_normalized=eq.admin&select=id`,
  );
  if (rows.length > 0) return;
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
  const existing = await sbGet<UserRow>(
    env,
    `/users?username_normalized=eq.${encodeURIComponent(normalized)}&select=id`,
  );
  if (existing.length > 0) throw new Error("Username already exists.");

  const passwordResult = await hashPassword(password);
  const now = Date.now();
  const rows = await sbPost<UserRow>(env, "/users", {
    username: username.trim(),
    username_normalized: normalized,
    role,
    password_hash: passwordResult.hash,
    password_salt: passwordResult.salt,
    password_iterations: passwordResult.iterations,
    created_at: now,
    updated_at: now,
  });
  if (!rows[0]) throw new Error("Failed to create user.");
  return rowToUser(rows[0]);
}

export async function getUserByUsername(
  env: Env,
  username: string,
): Promise<UserRecord | null> {
  const normalized = normalizeUsername(username);
  const rows = await sbGet<UserRow>(
    env,
    `/users?username_normalized=eq.${encodeURIComponent(normalized)}`,
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function getUserById(
  env: Env,
  id: number,
): Promise<UserRecord | null> {
  const rows = await sbGet<UserRow>(env, `/users?id=eq.${id}`);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function getAllUsers(env: Env): Promise<PublicUser[]> {
  const rows = await sbGet<UserRow>(
    env,
    `/users?select=id,username,role&order=id.asc`,
  );
  return rows.map((r) => ({ id: r.id, username: r.username, role: r.role }));
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
  await sbPatch(env, `/users?id=eq.${id}`, {
    role,
    updated_at: Date.now(),
  });
  return { id: user.id, username: user.username, role };
}

// ── Word Repository ──────────────────────────────────────────────────────────

export async function addWords(
  env: Env,
  ownerId: number,
  words: Omit<WordRecord, "id" | "ownerId">[],
): Promise<WordRecord[]> {
  const rows = words.map((w) => ({
    unit: w.unit,
    word: w.word,
    phonetic: w.phonetic ?? "",
    meaning: w.meaning ?? "",
    pos: w.pos ?? null,
    page: w.page ?? null,
    owner_id: ownerId,
    publisher: w.publisher ?? null,
    grade: w.grade ?? null,
    semester: w.semester ?? null,
  }));
  const created = await sbPost<WordRow>(env, "/words", rows);
  return created.map(rowToWord);
}

export async function getWords(
  env: Env,
  ownerId: number | null,
): Promise<WordRecord[]> {
  const filter =
    ownerId === null ? "owner_id=is.null" : `owner_id=eq.${ownerId}`;
  const rows = await sbGet<WordRow>(env, `/words?${filter}&order=unit.asc,word.asc`);
  return rows.map(rowToWord);
}

export async function updateWord(
  env: Env,
  ownerId: number,
  wordId: string,
  updates: Partial<Omit<WordRecord, "id" | "ownerId">>,
): Promise<WordRecord> {
  const existing = await sbGet<WordRow>(
    env,
    `/words?id=eq.${wordId}&owner_id=eq.${ownerId}`,
  );
  if (!existing[0]) throw new Error("Word not found.");
  const patch: Record<string, unknown> = {};
  if (updates.unit !== undefined) patch.unit = updates.unit;
  if (updates.word !== undefined) patch.word = updates.word;
  if (updates.phonetic !== undefined) patch.phonetic = updates.phonetic;
  if (updates.meaning !== undefined) patch.meaning = updates.meaning;
  if (updates.pos !== undefined) patch.pos = updates.pos;
  if (updates.page !== undefined) patch.page = updates.page;
  if (updates.publisher !== undefined) patch.publisher = updates.publisher;
  if (updates.grade !== undefined) patch.grade = updates.grade;
  if (updates.semester !== undefined) patch.semester = updates.semester;
  const res = await sbFetch(
    env,
    `/words?id=eq.${wordId}&owner_id=eq.${ownerId}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  if (!res.ok) throw new Error("Failed to update word.");
  const updated = await sbGet<WordRow>(
    env,
    `/words?id=eq.${wordId}&owner_id=eq.${ownerId}`,
  );
  return rowToWord(updated[0]);
}

export async function deleteWord(
  env: Env,
  ownerId: number,
  wordId: string,
): Promise<void> {
  await sbDelete(env, `/words?id=eq.${wordId}&owner_id=eq.${ownerId}`);
}

export async function deleteWords(
  env: Env,
  ownerId: number,
  wordIds: string[],
): Promise<void> {
  if (wordIds.length === 0) return;
  const ids = wordIds.map((id) => `"${id}"`).join(",");
  await sbDelete(env, `/words?id=in.(${ids})&owner_id=eq.${ownerId}`);
}

export async function clearAllUserData(
  env: Env,
  userId: number,
): Promise<void> {
  // Delete user's words and mistakes (mistakes cascade from words, but also delete directly)
  await Promise.all([
    sbDelete(env, `/words?owner_id=eq.${userId}`),
    sbDelete(env, `/mistakes?user_id=eq.${userId}`),
  ]);
}

// ── Mistake Repository ───────────────────────────────────────────────────────

export async function getMistakes(
  env: Env,
  userId: number,
): Promise<MistakeRecord[]> {
  const rows = await sbGet<MistakeRow>(
    env,
    `/mistakes?user_id=eq.${userId}&order=id.asc`,
  );
  return rows.map(rowToMistake);
}

export async function addOrUpdateMistakes(
  env: Env,
  mistakes: Omit<MistakeRecord, "id">[],
): Promise<void> {
  if (mistakes.length === 0) return;
  const rows = mistakes.map((m) => ({
    word_id: m.wordId,
    user_id: m.userId,
    next_review_date: m.nextReviewDate,
    review_count: m.reviewCount,
  }));
  const res = await sbFetch(env, "/mistakes", {
    method: "POST",
    body: JSON.stringify(rows),
    headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase upsert mistakes failed: ${err}`);
  }
}

export async function removeMistake(
  env: Env,
  userId: number,
  wordId: string,
): Promise<void> {
  await sbDelete(env, `/mistakes?user_id=eq.${userId}&word_id=eq.${wordId}`);
}
