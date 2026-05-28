import {
  Env,
  jsonOk,
  jsonError,
  parseBody,
  authenticate,
  signToken,
  hashPassword,
  verifyPassword,
  SessionPayload,
} from "../_helpers";
import {
  createUser,
  getUserByUsername,
  getUserById,
  getAllUsers,
  updateUserRole,
  updateUserPassword,
  updateUserAvatar,
  getUserSecurityQuestion,
  addWords as repoAddWords,
  getWords as repoGetWords,
  clearAllUserData,
  getMistakes as repoGetMistakes,
  addOrUpdateMistakes as repoAddOrUpdateMistakes,
  removeMistake as repoRemoveMistake,
  ensureAdmin,
  normalizeUsername,
  sbGet,
  WordRow,
} from "../_repositories";
import { callGeminiGenerateContent, callGeminiVision } from "../_gemini";
import {
  updateWord as repoUpdateWord,
  deleteWord as repoDeleteWord,
  deleteWords as repoDeleteWords,
} from "../_repositories";
import {
  getUserStats as repoGetUserStats,
  upsertUserStats as repoUpsertUserStats,
  createUserStats as repoCreateUserStats,
  getUserAchievements as repoGetUserAchievements,
  unlockAchievement as repoUnlockAchievement,
} from "../_repositories";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // Ensure admin exists on first request
  try {
    await ensureAdmin(env);
  } catch (e) {
    console.warn("ensureAdmin skipped:", (e as Error).message);
  }

  try {
    // ===================== AUTH ROUTES =====================
    if (path === "/api/auth/login" && method === "POST") {
      return await handleLogin(request, env);
    }
    if (path === "/api/auth/register" && method === "POST") {
      return await handleRegister(request, env);
    }
    if (path === "/api/auth/me" && method === "GET") {
      return await handleMe(request, env);
    }
    if (path === "/api/auth/security-questions" && method === "GET") {
      return jsonOk({ questions: SECURITY_QUESTIONS });
    }
    if (path === "/api/auth/change-password" && method === "POST") {
      return await handleChangePassword(request, env);
    }
    if (path === "/api/auth/security-question" && method === "POST") {
      return await handleGetSecurityQuestion(request, env);
    }
    if (path === "/api/auth/reset-password" && method === "POST") {
      return await handleResetPassword(request, env);
    }
    if (path === "/api/auth/avatar" && method === "POST") {
      return await handleUpdateAvatar(request, env);
    }

    // ===================== USER ROUTES =====================
    if (path === "/api/users" && method === "GET") {
      return await handleGetUsers(request, env);
    }
    const userPatchMatch = path.match(/^\/api\/users\/(\d+)$/);
    if (userPatchMatch && method === "PATCH") {
      return await handleUpdateUser(request, env, parseInt(userPatchMatch[1]));
    }
    const userDataDeleteMatch = path.match(/^\/api\/users\/(\d+)\/data$/);
    if (userDataDeleteMatch && method === "DELETE") {
      return await handleDeleteUserData(
        request,
        env,
        parseInt(userDataDeleteMatch[1]),
      );
    }

    // ===================== WORD ROUTES =====================
    if (path === "/api/words" && method === "GET") {
      return await handleGetWords(request, env);
    }
    if (path === "/api/words/bulk" && method === "POST") {
      return await handleBulkAddWords(request, env);
    }
    if (path === "/api/words/bulk-delete" && method === "POST") {
      return await handleBulkDeleteWords(request, env);
    }
    if (path === "/api/words/export" && method === "GET") {
      return await handleExportWords(request, env);
    }
    const wordMatch = path.match(/^\/api\/words\/([^/]+)$/);
    if (wordMatch && method === "PATCH") {
      return await handleUpdateWord(request, env, wordMatch[1]);
    }
    if (wordMatch && method === "DELETE") {
      return await handleDeleteWord(request, env, wordMatch[1]);
    }

    // ===================== MISTAKE ROUTES =====================
    if (path === "/api/mistakes" && method === "GET") {
      return await handleGetMistakes(request, env);
    }
    if (path === "/api/mistakes/bulk" && method === "POST") {
      return await handleBulkUpsertMistakes(request, env);
    }
    const mistakeDeleteMatch = path.match(/^\/api\/mistakes\/([^/]+)$/);
    if (mistakeDeleteMatch && method === "DELETE") {
      return await handleDeleteMistake(request, env, mistakeDeleteMatch[1]);
    }

    // ===================== AI ROUTES =====================
    if (path === "/api/ai/generate-article" && method === "POST") {
      return await handleGenerateArticle(request, env);
    }

    // ===================== ENRICHMENT (admin, API-key) =====================
    if (path === "/api/admin/enrich" && method === "POST") {
      return await handleEnrichBatch(request, env);
    }
    if (path === "/api/admin/enrich-free" && method === "POST") {
      return await handleEnrichFree(request, env);
    }
    if (path === "/api/admin/ocr-import" && method === "POST") {
      return await handleOcrImport(request, env);
    }
    if (path === "/api/admin/manual-add" && method === "POST") {
      return await handleManualAdd(request, env);
    }
    if (path === "/api/admin/enrich-words" && method === "POST") {
      return await handleEnrichWords(request, env);
    }

    // ===================== VERTEX PROXY =====================
    if (path === "/api-proxy" && method === "POST") {
      return await handleVertexProxy(request, env);
    }

    // ===================== GAMIFICATION ROUTES =====================
    if (path === "/api/user/stats" && method === "GET") {
      return await handleGetUserStats(request, env);
    }
    if (path === "/api/user/stats" && method === "POST") {
      return await handleUpdateUserStats(request, env);
    }
    if (path === "/api/user/achievements" && method === "GET") {
      return await handleGetUserAchievements(request, env);
    }

    return jsonError("Not Found", 404);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    console.error("API error:", err);
    return jsonError(message, 500);
  }
};

// ─── Auth helpers ───────────────────────────────────────────────────────────

async function getSession(
  request: Request,
  env: Env,
): Promise<SessionPayload | null> {
  return authenticate(request, env.SESSION_SECRET);
}

function isAdmin(session: SessionPayload): boolean {
  return session.role === "admin";
}

async function makeToken(
  env: Env,
  userId: number,
  role: "admin" | "user",
): Promise<string> {
  return signToken(
    { userId, role, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS },
    env.SESSION_SECRET,
  );
}

// ===================== AUTH HANDLERS =====================

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<{ username?: string; password?: string }>(
    request,
  );
  if (!body || !body.username || !body.password) {
    return jsonError("用户名和密码不能为空", 400);
  }

  const userRecord = await getUserByUsername(env, body.username);
  if (!userRecord) {
    return jsonError("用户名或密码错误", 401);
  }

  const ok = await verifyPassword(
    body.password,
    userRecord.passwordHash,
    userRecord.passwordSalt,
  );
  if (!ok) {
    return jsonError("用户名或密码错误", 401);
  }

  const token = await makeToken(env, userRecord.id, userRecord.role);
  const user = {
    id: userRecord.id,
    username: userRecord.username,
    role: userRecord.role,
    avatar: userRecord.avatar ?? undefined,
  };
  return jsonOk({ user, token });
}

async function handleRegister(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<{
    username?: string;
    password?: string;
    securityQuestion?: string;
    securityAnswer?: string;
    captchaAnswer?: number;
  }>(request);
  if (!body || !body.username || !body.password) {
    return jsonError("用户名和密码不能为空", 400);
  }
  if (body.username.length < 3 || body.username.length > 50) {
    return jsonError("用户名长度须在 3-50 个字符之间", 400);
  }
  if (body.password.length < 6) {
    return jsonError("密码至少需要 6 个字符", 400);
  }
  if (normalizeUsername(body.username) === "admin") {
    return jsonError("该用户名不可用", 400);
  }
  if (!body.securityQuestion || !body.securityAnswer) {
    return jsonError("请选择安全问题并填写答案", 400);
  }
  if (body.securityAnswer.length < 2) {
    return jsonError("安全答案至少需要 2 个字符", 400);
  }

  let userRecord;
  try {
    userRecord = await createUser(
      env, body.username, body.password, "user",
      body.securityQuestion, body.securityAnswer,
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "注册失败";
    return jsonError(message, 409);
  }

  const token = await makeToken(env, userRecord.id, userRecord.role);
  const user = {
    id: userRecord.id,
    username: userRecord.username,
    role: userRecord.role,
    avatar: userRecord.avatar ?? undefined,
  };
  return jsonOk({ user, token }, 201);
}

const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What was the name of your elementary school?",
  "What is your favorite book?",
  "What is your favorite food?",
  "What was the model of your first car?",
  "What is your favorite color?",
];

async function handleChangePassword(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);

  const body = await parseBody<{ currentPassword?: string; newPassword?: string }>(request);
  if (!body || !body.currentPassword || !body.newPassword) {
    return jsonError("请填写当前密码和新密码", 400);
  }
  if (body.newPassword.length < 6) {
    return jsonError("新密码至少需要 6 个字符", 400);
  }

  const userRecord = await getUserById(env, session.userId);
  if (!userRecord) return jsonError("User not found", 404);

  const ok = await verifyPassword(body.currentPassword, userRecord.passwordHash, userRecord.passwordSalt);
  if (!ok) return jsonError("当前密码错误", 401);

  await updateUserPassword(env, session.userId, body.newPassword);
  return jsonOk({ message: "密码修改成功" });
}

async function handleUpdateAvatar(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);

  const body = await parseBody<{ avatar: string }>(request);
  if (!body || typeof body.avatar !== "string") {
    return jsonError("avatar string required", 400);
  }

  const avatar = body.avatar;
  if (avatar.length > 50000) {
    return jsonError("Avatar too large", 400);
  }

  await updateUserAvatar(env, session.userId, avatar);
  return jsonOk({ avatar });
}

async function handleGetSecurityQuestion(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<{ username?: string }>(request);
  if (!body || !body.username) {
    return jsonError("请填写用户名", 400);
  }

  const result = await getUserSecurityQuestion(env, body.username);
  if (!result) {
    return jsonError("用户不存在或未设置安全问题", 404);
  }

  return jsonOk({ question: result.question, userId: result.userId });
}

async function handleResetPassword(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<{ userId?: number; securityAnswer?: string; newPassword?: string }>(request);
  if (!body || !body.userId || !body.securityAnswer || !body.newPassword) {
    return jsonError("请填写安全答案和新密码", 400);
  }
  if (body.newPassword.length < 6) {
    return jsonError("新密码至少需要 6 个字符", 400);
  }

  const userRecord = await getUserById(env, body.userId);
  if (!userRecord) return jsonError("用户不存在", 404);
  if (!userRecord.securityAnswerHash || !userRecord.securityAnswerSalt) {
    return jsonError("该用户未设置安全问题", 400);
  }

  const ok = await verifyPassword(
    body.securityAnswer,
    userRecord.securityAnswerHash,
    userRecord.securityAnswerSalt,
  );
  if (!ok) return jsonError("安全答案错误", 401);

  await updateUserPassword(env, body.userId, body.newPassword);
  return jsonOk({ message: "密码重置成功" });
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);

  const userRecord = await getUserById(env, session.userId);
  if (!userRecord) return jsonError("User not found", 404);

  const user = {
    id: userRecord.id,
    username: userRecord.username,
    role: userRecord.role,
    avatar: userRecord.avatar ?? undefined,
  };
  return jsonOk({ user });
}

// ===================== USER HANDLERS =====================

async function handleGetUsers(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);
  if (!isAdmin(session)) return jsonError("Forbidden", 403);

  const users = await getAllUsers(env);
  return jsonOk({ users });
}

async function handleUpdateUser(
  request: Request,
  env: Env,
  userId: number,
): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);
  if (!isAdmin(session)) return jsonError("Forbidden", 403);

  const body = await parseBody<{ role?: string }>(request);
  if (!body || !body.role || !["admin", "user"].includes(body.role)) {
    return jsonError("Invalid role", 400);
  }

  try {
    const updated = await updateUserRole(
      env,
      userId,
      body.role as "admin" | "user",
    );
    return jsonOk({ user: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "更新失败";
    return jsonError(message, 400);
  }
}

async function handleDeleteUserData(
  request: Request,
  env: Env,
  userId: number,
): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);
  if (!isAdmin(session) && session.userId !== userId)
    return jsonError("Forbidden", 403);

  await clearAllUserData(env, userId);
  return jsonOk({ message: "用户数据已清除" });
}

// ===================== WORD HANDLERS =====================

async function handleGetWords(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);

  const url = new URL(request.url);
  const ownerIdStr = url.searchParams.get("ownerId");

  if (ownerIdStr) {
    const ownerId = parseInt(ownerIdStr);
    if (!isAdmin(session) && ownerId !== session.userId) {
      return jsonError("Forbidden", 403);
    }
    const words = await repoGetWords(env, ownerId);
    return jsonOk({ words });
  }

  if (isAdmin(session)) {
    // Admin sees shared words (owner_id = NULL) + their own words
    const [sharedWords, adminWords] = await Promise.all([
      repoGetWords(env, null),
      repoGetWords(env, session.userId),
    ]);
    const seen = new Set<string>();
    const words = [...sharedWords, ...adminWords].filter((w) => {
      if (seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    });
    return jsonOk({ words });
  }

  // Regular user: shared words (owner_id = NULL) + their own words
  const [sharedWords, userWords] = await Promise.all([
    repoGetWords(env, null),
    repoGetWords(env, session.userId),
  ]);
  const seen = new Set<string>();
  const words = [...sharedWords, ...userWords].filter((w) => {
    if (seen.has(w.id)) return false;
    seen.add(w.id);
    return true;
  });
  return jsonOk({ words });
}

async function handleBulkAddWords(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);

  const body = await parseBody<{ ownerId?: number; words?: unknown[] }>(
    request,
  );
  if (!body || !Array.isArray(body.words)) {
    return jsonError("words 数组不能为空", 400);
  }

  const ownerId = body.ownerId ?? session.userId;
  if (!isAdmin(session) && ownerId !== session.userId) {
    return jsonError("Forbidden", 403);
  }

  const created = await repoAddWords(env, ownerId, body.words as any[]);
  return jsonOk({ words: created });
}

async function handleUpdateWord(
  request: Request,
  env: Env,
  wordId: string,
): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);
  if (!isAdmin(session)) return jsonError("Forbidden", 403);

  const url = new URL(request.url);
  const ownerIdStr = url.searchParams.get("ownerId");
  const ownerId = ownerIdStr === "null" || ownerIdStr === null ? null : parseInt(ownerIdStr);

  const body = await parseBody<Partial<Record<string, unknown>>>(request);
  if (!body) return jsonError("Invalid body", 400);

  const updated = await repoUpdateWord(env, ownerId, wordId, body as any);
  return jsonOk({ word: updated });
}

async function handleDeleteWord(
  request: Request,
  env: Env,
  wordId: string,
): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);
  if (!isAdmin(session)) return jsonError("Forbidden", 403);

  const url = new URL(request.url);
  const ownerIdStr = url.searchParams.get("ownerId");
  const ownerId = ownerIdStr === "null" || ownerIdStr === null ? null : parseInt(ownerIdStr);

  await repoDeleteWord(env, ownerId, wordId);
  return jsonOk({ message: "单词已删除" });
}

async function handleBulkDeleteWords(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);
  if (!isAdmin(session)) return jsonError("Forbidden", 403);

  const body = await parseBody<{ ownerId?: number | null; wordIds?: string[] }>(request);
  if (!body || !Array.isArray(body.wordIds) || body.wordIds.length === 0) {
    return jsonError("wordIds 数组不能为空", 400);
  }

  const ownerId = body.ownerId === undefined ? null : body.ownerId;
  await repoDeleteWords(env, ownerId, body.wordIds);
  return jsonOk({ message: `已删除 ${body.wordIds.length} 个单词` });
}

async function handleExportWords(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);
  if (!isAdmin(session)) return jsonError("Forbidden", 403);

  const [sharedWords, adminWords] = await Promise.all([
    repoGetWords(env, null),
    repoGetWords(env, session.userId),
  ]);
  const seen = new Set<string>();
  const words = [...sharedWords, ...adminWords].filter((w) => {
    if (seen.has(w.id)) return false;
    seen.add(w.id);
    return true;
  });
  return jsonOk({ words });
}

// ===================== MISTAKE HANDLERS =====================

async function handleGetMistakes(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);

  const url = new URL(request.url);
  const userIdStr = url.searchParams.get("userId");
  const userId = userIdStr ? parseInt(userIdStr) : session.userId;

  if (!isAdmin(session) && userId !== session.userId) {
    return jsonError("Forbidden", 403);
  }

  const mistakes = await repoGetMistakes(env, userId);
  return jsonOk({ mistakes });
}

async function handleBulkUpsertMistakes(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);

  const body = await parseBody<{ mistakes?: unknown[] }>(request);
  if (!body || !Array.isArray(body.mistakes)) {
    return jsonError("mistakes 数组不能为空", 400);
  }

  // 强制把 userId 绑定到当前用户（admin 除外）
  const sanitized = (body.mistakes as any[]).map((m: any) => ({
    ...m,
    userId: isAdmin(session) ? (m.userId ?? session.userId) : session.userId,
  }));

  await repoAddOrUpdateMistakes(env, sanitized);
  return jsonOk({ message: "Mistakes upserted" });
}

async function handleDeleteMistake(
  request: Request,
  env: Env,
  wordId: string,
): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);

  const url = new URL(request.url);
  const userIdStr = url.searchParams.get("userId");
  const userId = userIdStr ? parseInt(userIdStr) : session.userId;

  if (!isAdmin(session) && userId !== session.userId) {
    return jsonError("Forbidden", 403);
  }

  await repoRemoveMistake(env, userId, wordId);
  return jsonOk({ message: "错题已删除" });
}

// ===================== GAMIFICATION HANDLERS =====================

async function handleGetUserStats(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);

  let stats = await repoGetUserStats(env, session.userId);
  if (!stats) {
    stats = await repoCreateUserStats(env, session.userId);
  }
  return jsonOk({ stats });
}

async function handleUpdateUserStats(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);

  const body = await parseBody<{
    correctCount?: number;
    wrongCount?: number;
    mode?: "unit" | "review";
    wordIds?: string[];
  }>(request);
  if (!body) return jsonError("Invalid body", 400);

  let stats = await repoGetUserStats(env, session.userId);
  if (!stats) {
    stats = await repoCreateUserStats(env, session.userId);
  }

  const correctCount = body.correctCount ?? 0;
  const wrongCount = body.wrongCount ?? 0;
  const mode = body.mode ?? "unit";
  const totalWords = correctCount + wrongCount;

  // XP calculation
  let xpEarned = 0;
  if (mode === "unit") {
    xpEarned += totalWords * 10;
    xpEarned += correctCount * 5; // bonus for correct first attempts
  } else {
    xpEarned += totalWords * 5;
  }

  const newXp = stats.xp + xpEarned;
  const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;

  // Streak calculation
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  let newStreakCount = stats.streakCount;
  if (stats.lastActiveDate !== todayStr) {
    if (stats.lastActiveDate !== null) {
      const lastDate = new Date(stats.lastActiveDate);
      const diffDays = Math.floor(
        (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays === 1) {
        newStreakCount = stats.streakCount + 1;
      } else {
        newStreakCount = 1;
      }
    } else {
      newStreakCount = 1;
    }
  }

  // Update stats (camelCase keys, mapped to snake_case in repository)
  const updates: Record<string, unknown> = {
    xp: newXp,
    level: newLevel,
    streakCount: newStreakCount,
    lastActiveDate: todayStr,
  };
  if (mode === "unit") {
    updates.totalTestsCompleted = stats.totalTestsCompleted + 1;
  } else {
    updates.totalReviewsCompleted = stats.totalReviewsCompleted + 1;
  }
  updates.totalCorrect = stats.totalCorrect + correctCount;
  updates.totalWrong = stats.totalWrong + wrongCount;

  if (correctCount > 0) {
    updates.wordsLearnedCount = stats.wordsLearnedCount + correctCount;
  }

  stats = await repoUpsertUserStats(env, session.userId, updates as any);

  // Achievement checking
  const existingAchievements = await repoGetUserAchievements(env, session.userId);
  const existingIds = new Set(existingAchievements.map((a) => a.achievementId));
  const newAchievements: { id: string; name: string; icon: string }[] = [];

  const ach = ACHIEVEMENT_DEFINITIONS;

  function tryUnlock(id: string) {
    if (!existingIds.has(id)) {
      const def = ach.find((a) => a.id === id);
      if (def) newAchievements.push({ id: def.id, name: def.name, icon: def.icon });
    }
  }

  if (mode === "unit") {
    if (stats.totalTestsCompleted >= 1) tryUnlock("first_test");
    if (wrongCount === 0 && totalWords >= 5) tryUnlock("perfect_score");
    if (stats.wordsLearnedCount >= 10) tryUnlock("words_10");
    if (stats.wordsLearnedCount >= 50) tryUnlock("words_50");
    if (stats.wordsLearnedCount >= 100) tryUnlock("words_100");
    if (stats.wordsLearnedCount >= 500) tryUnlock("words_500");
  }
  if (newStreakCount >= 3) tryUnlock("streak_3");
  if (newStreakCount >= 7) tryUnlock("streak_7");
  if (newStreakCount >= 30) tryUnlock("streak_30");
  if (stats.totalReviewsCompleted >= 10) tryUnlock("reviews_10");
  if (stats.totalReviewsCompleted >= 50) tryUnlock("reviews_50");
  if (stats.totalReviewsCompleted >= 100) tryUnlock("reviews_100");
  if (correctCount === totalWords && totalWords >= 10 && mode === "unit") tryUnlock("speed_demon");

  // Persist new achievements
  await Promise.all(
    newAchievements.map((a) => repoUnlockAchievement(env, session.userId, a.id)),
  );

  return jsonOk({ stats, xpEarned, newAchievements });
}

async function handleGetUserAchievements(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);

  const achievements = await repoGetUserAchievements(env, session.userId);
  return jsonOk({ achievements });
}

const ACHIEVEMENT_DEFINITIONS = [
  { id: "first_test", name: "First Steps", icon: "🎯", desc: "Complete your first test" },
  { id: "perfect_score", name: "Perfect Score", icon: "💯", desc: "Get 100% on a test (5+ words)" },
  { id: "streak_3", name: "Getting Started", icon: "🔥", desc: "3-day study streak" },
  { id: "streak_7", name: "Week Warrior", icon: "🔥", desc: "7-day study streak" },
  { id: "streak_30", name: "Monthly Master", icon: "🔥", desc: "30-day study streak" },
  { id: "words_10", name: "Vocabulary Novice", icon: "📖", desc: "Learn 10 words" },
  { id: "words_50", name: "Vocabulary Learner", icon: "📖", desc: "Learn 50 words" },
  { id: "words_100", name: "Vocabulary Builder", icon: "📚", desc: "Learn 100 words" },
  { id: "words_500", name: "Vocabulary Master", icon: "📚", desc: "Learn 500 words" },
  { id: "reviews_10", name: "Reviewer", icon: "🔄", desc: "Complete 10 review sessions" },
  { id: "reviews_50", name: "Dedicated Reviewer", icon: "🔄", desc: "Complete 50 review sessions" },
  { id: "reviews_100", name: "Review Legend", icon: "🔄", desc: "Complete 100 review sessions" },
  { id: "speed_demon", name: "Speed Demon", icon: "⚡", desc: "Answer 10+ words all correctly in one test" },
];

// ===================== AI HANDLER =====================

async function handleGenerateArticle(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);

  const body = await parseBody<{
    words?: Array<{ word: string; meaning: string }>;
    level?: string;
    topic?: string;
  }>(request);

  if (!body || !Array.isArray(body.words) || body.words.length === 0) {
    return jsonError("words 数组不能为空", 400);
  }
  if (body.words.length > 50) {
    return jsonError("单次最多 50 个单词", 400);
  }

  const level = body.level || "intermediate";
  const topic = body.topic || "daily life";
  const wordList = body.words
    .map((w) => `- ${w.word}: ${w.meaning}`)
    .join("\n");

  const prompt = `You are an English vocabulary teacher. Create a short, engaging English article (150-250 words) for ${level} level students about "${topic}".

The article must naturally incorporate ALL of the following vocabulary words:
${wordList}

Requirements:
- Write a coherent, interesting article
- Use each vocabulary word naturally in context
- Make the article appropriate for ${level} level
- Do NOT list the words separately; embed them in the narrative
- Return ONLY the article text, no additional commentary`;

  try {
    const article = await callGeminiGenerateContent(env, prompt);
    return jsonOk({ article });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Gemini AI error:", err);
    return jsonError("生成文章失败: " + message, 502);
  }
}

// ===================== ENRICHMENT HANDLER =====================

async function handleEnrichBatch(
  request: Request,
  env: Env,
): Promise<Response> {
  const apiKey = request.headers.get("X-API-Key");
  if (!apiKey || apiKey !== env.ENRICH_API_KEY) {
    return jsonError("Unauthorized", 401);
  }

  const body = await parseBody<{
    words?: Array<{ id: string; word: string; pos?: string }>;
  }>(request);

  if (!body || !Array.isArray(body.words) || body.words.length === 0) {
    return jsonError("words 数组不能为空", 400);
  }
  if (body.words.length > 40) {
    return jsonError("单次最多 40 个单词", 400);
  }

  const wordLines = body.words
    .map((w, i) => `${i + 1}. ${w.word}${w.pos ? ` (${w.pos})` : ""}`)
    .join("\n");

  const prompt = `You are a vocabulary assistant. For each English word below, provide:
1. IPA phonetics (British English)
2. The most common Chinese translation

Respond with a JSON array only, no markdown, no extra text. Each entry: {"index": N, "phonetic": "/.../", "meaning": "..."}

Words:
${wordLines}`;

  try {
    const text = await callGeminiGenerateContent(env, prompt);
    const results = extractEnrichJson(text);

    if (!results.length) {
      return jsonError("Failed to parse Gemini response: " + text.slice(0, 200), 502);
    }

    const enriched: Array<{ id: string; word: string; phonetic: string; meaning: string }> = [];

    for (const res of results) {
      const idx = Number(res.index ?? 0) - 1;
      if (idx < 0 || idx >= body.words.length) continue;
      const wordId = body.words[idx].id;
      const phonetic = String(res.phonetic ?? "").trim();
      const meaning = String(res.meaning ?? "").trim();
      if (!phonetic && !meaning) continue;

      await repoUpdateWord(env, null, wordId, { phonetic, meaning });
      enriched.push({ id: wordId, word: body.words[idx].word, phonetic, meaning });
    }

  return jsonOk({ enriched, total: words.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Enrichment error:", err);
    return jsonError("Enrichment failed: " + message, 502);
  }
}

function extractEnrichJson(text: string): Array<Record<string, unknown>> {
  text = text.trim();
  if (text.startsWith("```")) {
    text = text.split("\n").slice(text.startsWith("```") && text.includes("\n") ? 1 : 0).join("\n");
    const end = text.lastIndexOf("```");
    if (end !== -1) text = text.slice(0, end);
  }
  text = text.trim();
  try {
    return JSON.parse(text) as Array<Record<string, unknown>>;
  } catch {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as Array<Record<string, unknown>>;
      } catch {
        return [];
      }
    }
    return [];
  }
}

async function handleEnrichFree(request: Request, env: Env): Promise<Response> {
  const apiKey = request.headers.get("X-API-Key");
  if (!apiKey || apiKey !== env.ENRICH_API_KEY) {
    return jsonError("Unauthorized", 401);
  }

  const body = await parseBody<{
    words?: Array<{ id: string; word: string; pos?: string }>;
    unit?: string;
    limit?: number;
  }>(request);

  if (!body) {
    return jsonError("Invalid request body", 400);
  }

  let words = body.words ?? [];

  // If unit specified (and no words passed), fetch unenriched words from DB
  if (words.length === 0 && body.unit) {
    try {
      const limit = Math.min(body.limit ?? 50, 200);
      const rows = await sbGet<WordRow>(
        env,
        `/words?unit=eq.${encodeURIComponent(body.unit)}&or=(phonetic.eq.,meaning.eq.)&select=id,word,pos&limit=${limit}`,
      );
      words = rows.map((r) => ({ id: r.id, word: r.word, pos: r.pos ?? undefined }));
    } catch (e) {
      return jsonError("Failed to fetch words from database: " + (e instanceof Error ? e.message : String(e)), 500);
    }
  }

  if (words.length === 0) {
    return jsonError("No words to enrich", 400);
  }

  const enriched: Array<{ id: string; word: string; phonetic: string; meaning: string }> = [];

  for (const w of words) {
    let phonetic = "";
    let meaning = "";

    try {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w.word)}`;
      const res = await fetch(url, { headers: { "User-Agent": "VocabMaster/1.0" } });
      if (res.ok) {
        const data = (await res.json()) as Array<Record<string, unknown>>;
        if (data?.[0]) {
          const entry = data[0];
          if (typeof entry.phonetic === "string" && entry.phonetic) {
            phonetic = entry.phonetic as string;
          } else {
            const phonetics = entry.phonetics as Array<Record<string, unknown>> | undefined;
            if (phonetics) {
              for (const ph of phonetics) {
                if (typeof ph.text === "string" && ph.text) {
                  phonetic = ph.text as string;
                  break;
                }
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(w.word)}`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.ok) {
        const data = (await res.json()) as Array<unknown>;
        if (data?.[0] && Array.isArray(data[0]) && Array.isArray(data[0][0]) && data[0][0]?.[0]) {
          meaning = String((data[0][0] as Array<unknown>)[0] as string);
        }
      }
    } catch {
      // ignore
    }

    if (phonetic || meaning) {
      try {
        await repoUpdateWord(env, null, w.id, { phonetic, meaning });
        enriched.push({ id: w.id, word: w.word, phonetic, meaning });
      } catch {
        // skip if update fails
      }
    }
  }

  return jsonOk({ enriched, total: words.length });
}

async function handleOcrImport(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<{ image: string; mimeType: string }>(request);
  if (!body || !body.image) {
    return jsonError("Image data is required", 400);
  }

  const mimeType = body.mimeType || "image/jpeg";
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    return jsonError(`Unsupported image type: ${mimeType}`, 400);
  }

  const prompt = `You are OCR for English vocabulary. This is a newspaper image. Extract ONLY the bold/headline words that are suitable for English vocabulary learning. Return them as a JSON array of strings, e.g. ["word1","word2","word3"]. Do NOT include normal body text, only bold/highlighted words. If no bold words are found, return an empty array [].`;

  let raw: string;
  try {
    raw = await callGeminiVision(env, prompt, body.image, mimeType);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OCR failed";
    console.error("OCR Gemini call failed:", msg);
    return jsonError(msg, 502);
  }

  let words: string[];
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    words = JSON.parse(cleaned);
    if (!Array.isArray(words)) throw new Error("Not an array");
  } catch {
    return jsonError("Failed to parse OCR result. Raw response: " + raw.slice(0, 200), 500);
  }

  return jsonOk({ words });
}

async function handleManualAdd(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);

  const body = await parseBody<{
    words: string[];
    unit: string;
    publisher: string;
  }>(request);

  if (!body || !Array.isArray(body.words) || body.words.length === 0) {
    return jsonError("words 数组不能为空", 400);
  }
  if (!body.unit || !body.unit.trim()) {
    return jsonError("unit 不能为空", 400);
  }

  const unit = body.unit.trim();
  const publisher = body.publisher?.trim() || "21st Century";

  const enriched: Array<{
    word: string;
    phonetic: string;
    meaning: string;
    publisher: string;
    unit: string;
  }> = [];

  for (const raw of body.words) {
    const word = raw.trim();
    if (!word) continue;

    let phonetic = "";
    let meaning = "";

    try {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
      const res = await fetch(url, { headers: { "User-Agent": "VocabMaster/1.0" } });
      if (res.ok) {
        const data = (await res.json()) as Array<Record<string, unknown>>;
        if (data?.[0]) {
          const entry = data[0];
          if (typeof entry.phonetic === "string" && entry.phonetic) {
            phonetic = entry.phonetic as string;
          } else {
            const phonetics = entry.phonetics as Array<Record<string, unknown>> | undefined;
            if (phonetics) {
              for (const ph of phonetics) {
                if (typeof ph.text === "string" && ph.text) {
                  phonetic = ph.text as string;
                  break;
                }
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(word)}`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.ok) {
        const data = (await res.json()) as Array<unknown>;
        if (data?.[0] && Array.isArray(data[0]) && Array.isArray(data[0][0]) && data[0][0]?.[0]) {
          meaning = String((data[0][0] as Array<unknown>)[0] as string);
        }
      }
    } catch {
      // ignore
    }

    enriched.push({ word, phonetic, meaning, publisher, unit });
  }

  const created = await repoAddWords(env, session.userId, enriched);
  return jsonOk({ words: created });
}

async function handleEnrichWords(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env);
  if (!session) return jsonError("Unauthorized", 401);

  const body = await parseBody<{ ids?: string[] }>(request);
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
    return jsonError("ids 数组不能为空", 400);
  }

  // Fetch current words from DB
  const idList = body.ids.join(",");
  const rows = await sbGet<WordRow>(env, `/words?id=in.(${idList})&select=id,word,phonetic,meaning`);
  if (rows.length === 0) return jsonError("No matching words found", 404);

  const enriched: Array<{ id: string; word: string; phonetic: string; meaning: string }> = [];
  const skipped: Array<{ id: string; word: string; reason: string }> = [];

  for (const row of rows) {
    let phonetic = row.phonetic || "";
    let meaning = row.meaning || "";
    let phoneticFetched = false;
    let meaningFetched = false;

    // Fetch phonetic if missing
    if (!phonetic) {
      try {
        const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(row.word)}`;
        const res = await fetch(url, { headers: { "User-Agent": "VocabMaster/1.0" } });
        if (res.ok) {
          const data = (await res.json()) as Array<Record<string, unknown>>;
          if (data?.[0]) {
            const entry = data[0];
            if (typeof entry.phonetic === "string" && entry.phonetic) {
              phonetic = entry.phonetic as string;
            } else {
              const phonetics = entry.phonetics as Array<Record<string, unknown>> | undefined;
              if (phonetics) {
                for (const ph of phonetics) {
                  if (typeof ph.text === "string" && ph.text) {
                    phonetic = ph.text as string;
                    break;
                  }
                }
              }
            }
          }
        }
        if (!phonetic) phoneticFetched = true; // tried but API had no result
      } catch {
        phoneticFetched = true; // tried but failed
      }
    }

    // Fetch meaning if missing
    if (!meaning) {
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(row.word)}`;
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (res.ok) {
          const data = (await res.json()) as Array<unknown>;
          if (data?.[0] && Array.isArray(data[0]) && Array.isArray(data[0][0]) && data[0][0]?.[0]) {
            meaning = String((data[0][0] as Array<unknown>)[0] as string);
          }
        }
      } catch {
        // ignore
      }
    }

    if (phonetic !== row.phonetic || meaning !== row.meaning) {
      try {
        await repoUpdateWord(env, null, row.id, { phonetic, meaning });
        enriched.push({ id: row.id, word: row.word, phonetic, meaning });
      } catch {
        skipped.push({ id: row.id, word: row.word, reason: "保存失败" });
      }
    } else if (row.phonetic && row.meaning) {
      skipped.push({ id: row.id, word: row.word, reason: "已有完整音标和释义" });
    } else if (phoneticFetched && !phonetic && !meaning) {
      skipped.push({ id: row.id, word: row.word, reason: "未找到该词的音标和释义" });
    } else if (phoneticFetched && !phonetic) {
      skipped.push({ id: row.id, word: row.word, reason: "未找到音标" });
    }
  }

  return jsonOk({ enriched, skipped, total: body.ids.length });
}
