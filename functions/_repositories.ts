import { Env, PublicUser, hashPassword } from "./_helpers";

export interface UserRecord {
  id: number;
  username: string;
  usernameNormalized: string;
  role: "admin" | "user";
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  securityQuestion: string;
  securityAnswerHash: string;
  securityAnswerSalt: string;
  avatar: string | null;
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

export type MistakeType = "wrong" | "dont_know" | "not_sure";

export interface MistakeRecord {
  id?: number;
  wordId: string;
  userId: number;
  nextReviewDate: number;
  reviewCount: number;
  mistakeType?: MistakeType;
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

export async function sbGet<T>(env: Env, path: string): Promise<T[]> {
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
  security_question: string;
  security_answer_hash: string;
  security_answer_salt: string;
  avatar: string | null;
  created_at: number;
  updated_at: number;
}

export interface WordRow {
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
  mistake_type?: string;
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
    securityQuestion: row.security_question,
    securityAnswerHash: row.security_answer_hash,
    securityAnswerSalt: row.security_answer_salt,
    avatar: row.avatar,
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
    mistakeType: row.mistake_type as MistakeType ?? 'wrong',
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
  securityQuestion?: string,
  securityAnswer?: string,
): Promise<UserRecord> {
  const normalized = normalizeUsername(username);
  const existing = await sbGet<UserRow>(
    env,
    `/users?username_normalized=eq.${encodeURIComponent(normalized)}&select=id`,
  );
  if (existing.length > 0) throw new Error("Username already exists.");

  const passwordResult = await hashPassword(password);
  let answerHash = "";
  let answerSalt = "";
  if (securityQuestion && securityAnswer) {
    const result = await hashPassword(securityAnswer);
    answerHash = result.hash;
    answerSalt = result.salt;
  }
  const now = Date.now();
  const rows = await sbPost<UserRow>(env, "/users", {
    username: username.trim(),
    username_normalized: normalized,
    role,
    password_hash: passwordResult.hash,
    password_salt: passwordResult.salt,
    password_iterations: passwordResult.iterations,
    security_question: securityQuestion ?? "",
    security_answer_hash: answerHash,
    security_answer_salt: answerSalt,
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

export async function updateUserAvatar(
  env: Env,
  userId: number,
  avatar: string,
): Promise<void> {
  await sbPatch(env, `/users?id=eq.${userId}`, { avatar });
}

export async function updateUserPassword(
  env: Env,
  userId: number,
  newPassword: string,
): Promise<void> {
  const result = await hashPassword(newPassword);
  await sbPatch(env, `/users?id=eq.${userId}`, {
    password_hash: result.hash,
    password_salt: result.salt,
    password_iterations: result.iterations,
    updated_at: Date.now(),
  });
}

export async function getUserSecurityQuestion(
  env: Env,
  username: string,
): Promise<{ question: string; userId: number } | null> {
  const normalized = normalizeUsername(username);
  const rows = await sbGet<UserRow>(
    env,
    `/users?username_normalized=eq.${encodeURIComponent(normalized)}&select=id,security_question`,
  );
  if (!rows[0] || !rows[0].security_question) return null;
  return { question: rows[0].security_question, userId: rows[0].id };
}

export async function getAllUsers(env: Env): Promise<PublicUser[]> {
  const rows = await sbGet<UserRow>(
    env,
    `/users?select=id,username,role,avatar&order=id.asc`,
  );
  return rows.map((r) => ({ id: r.id, username: r.username, role: r.role, avatar: r.avatar ?? undefined }));
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
  const basePath = `/words?${filter}&order=unit.asc,word.asc`;
  // Supabase/PostgREST limits to 1000 rows per request; paginate to get all
  const PAGE = 1000;
  let all: WordRow[] = [];
  let offset = 0;
  while (true) {
    const path = `${basePath}&limit=${PAGE}&offset=${offset}`;
    const rows = await sbGet<WordRow>(env, path);
    all = all.concat(rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all.map(rowToWord);
}

export async function updateWord(
  env: Env,
  ownerId: number | null,
  wordId: string,
  updates: Partial<Omit<WordRecord, "id" | "ownerId">>,
): Promise<WordRecord> {
  const ownerFilter = ownerId === null ? "owner_id=is.null" : `owner_id=eq.${ownerId}`;
  const existing = await sbGet<WordRow>(
    env,
    `/words?id=eq.${wordId}&${ownerFilter}`,
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
    `/words?id=eq.${wordId}&${ownerFilter}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  if (!res.ok) throw new Error("Failed to update word.");
  const updated = await sbGet<WordRow>(
    env,
    `/words?id=eq.${wordId}&${ownerFilter}`,
  );
  return rowToWord(updated[0]);
}

export async function deleteWord(
  env: Env,
  ownerId: number | null,
  wordId: string,
): Promise<void> {
  const ownerFilter = ownerId === null ? "owner_id=is.null" : `owner_id=eq.${ownerId}`;
  await sbDelete(env, `/words?id=eq.${wordId}&${ownerFilter}`);
}

export async function deleteWords(
  env: Env,
  ownerId: number | null,
  wordIds: string[],
): Promise<void> {
  if (wordIds.length === 0) return;
  const ownerFilter = ownerId === null ? "owner_id=is.null" : `owner_id=eq.${ownerId}`;
  const ids = wordIds.map((id) => `"${id}"`).join(",");
  await sbDelete(env, `/words?id=in.(${ids})&${ownerFilter}`);
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
    mistake_type: m.mistakeType ?? 'wrong',
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

// ── Gamification Stats Repository ────────────────────────────────────────────

export interface UserStatsRecord {
  userId: number;
  xp: number;
  level: number;
  streakCount: number;
  lastActiveDate: string | null;
  totalTestsCompleted: number;
  totalCorrect: number;
  totalWrong: number;
  totalReviewsCompleted: number;
  wordsLearnedCount: number;
}

interface UserStatsRow {
  user_id: number;
  xp: number;
  level: number;
  streak_count: number;
  last_active_date: string | null;
  total_tests_completed: number;
  total_correct: number;
  total_wrong: number;
  total_reviews_completed: number;
  words_learned_count: number;
}

function rowToUserStats(row: UserStatsRow): UserStatsRecord {
  return {
    userId: row.user_id,
    xp: row.xp,
    level: row.level,
    streakCount: row.streak_count,
    lastActiveDate: row.last_active_date,
    totalTestsCompleted: row.total_tests_completed,
    totalCorrect: row.total_correct,
    totalWrong: row.total_wrong,
    totalReviewsCompleted: row.total_reviews_completed,
    wordsLearnedCount: row.words_learned_count,
  };
}

export async function getUserStats(
  env: Env,
  userId: number,
): Promise<UserStatsRecord | null> {
  const rows = await sbGet<UserStatsRow>(
    env,
    `/user_stats?user_id=eq.${userId}`,
  );
  return rows[0] ? rowToUserStats(rows[0]) : null;
}

export async function upsertUserStats(
  env: Env,
  userId: number,
  updates: Partial<Omit<UserStatsRecord, "userId">>,
): Promise<UserStatsRecord> {
  const patch: Record<string, unknown> = {};
  if (updates.xp !== undefined) patch.xp = updates.xp;
  if (updates.level !== undefined) patch.level = updates.level;
  if (updates.streakCount !== undefined) patch.streak_count = updates.streakCount;
  if (updates.lastActiveDate !== undefined) patch.last_active_date = updates.lastActiveDate;
  if (updates.totalTestsCompleted !== undefined) patch.total_tests_completed = updates.totalTestsCompleted;
  if (updates.totalCorrect !== undefined) patch.total_correct = updates.totalCorrect;
  if (updates.totalWrong !== undefined) patch.total_wrong = updates.totalWrong;
  if (updates.totalReviewsCompleted !== undefined) patch.total_reviews_completed = updates.totalReviewsCompleted;
  if (updates.wordsLearnedCount !== undefined) patch.words_learned_count = updates.wordsLearnedCount;

  const res = await sbFetch(env, `/user_stats?user_id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    headers: {
      "Prefer": "resolution=merge-duplicates,return=representation",
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase upsert user_stats failed: ${err}`);
  }
  const text = await res.text();
  const rows: UserStatsRow[] = text ? JSON.parse(text) : [];
  if (!rows[0]) throw new Error("Failed to upsert user stats");
  return rowToUserStats(rows[0]);
}

export async function createUserStats(
  env: Env,
  userId: number,
): Promise<UserStatsRecord> {
  const rows = await sbPost<UserStatsRow>(env, "/user_stats", {
    user_id: userId,
    xp: 0,
    level: 1,
    streak_count: 0,
    last_active_date: null,
    total_tests_completed: 0,
    total_correct: 0,
    total_wrong: 0,
    total_reviews_completed: 0,
    words_learned_count: 0,
  });
  return rowToUserStats(rows[0]);
}

// ── Achievement Repository ───────────────────────────────────────────────────

export interface UserAchievementRecord {
  id: number;
  userId: number;
  achievementId: string;
  unlockedAt: number;
}

interface UserAchievementRow {
  id: number;
  user_id: number;
  achievement_id: string;
  unlocked_at: number;
}

function rowToAchievement(row: UserAchievementRow): UserAchievementRecord {
  return {
    id: row.id,
    userId: row.user_id,
    achievementId: row.achievement_id,
    unlockedAt: row.unlocked_at,
  };
}

export async function getUserAchievements(
  env: Env,
  userId: number,
): Promise<UserAchievementRecord[]> {
  const rows = await sbGet<UserAchievementRow>(
    env,
    `/user_achievements?user_id=eq.${userId}&order=unlocked_at.asc`,
  );
  return rows.map(rowToAchievement);
}

export async function unlockAchievement(
  env: Env,
  userId: number,
  achievementId: string,
): Promise<UserAchievementRecord> {
  const now = Date.now();
  const rows = await sbPost<UserAchievementRow>(env, "/user_achievements", {
    user_id: userId,
    achievement_id: achievementId,
    unlocked_at: now,
  });
  return rowToAchievement(rows[0]);
}

