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
  addWords as repoAddWords,
  getWords as repoGetWords,
  clearAllUserData,
  getMistakes as repoGetMistakes,
  addOrUpdateMistakes as repoAddOrUpdateMistakes,
  removeMistake as repoRemoveMistake,
  ensureAdmin,
  normalizeUsername,
} from "../_repositories";
import { callGeminiGenerateContent } from "../_gemini";
import {
  updateWord as repoUpdateWord,
  deleteWord as repoDeleteWord,
  deleteWords as repoDeleteWords,
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

    // ===================== VERTEX PROXY =====================
    if (path === "/api-proxy" && method === "POST") {
      return await handleVertexProxy(request, env);
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
  };
  return jsonOk({ user, token });
}

async function handleRegister(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<{ username?: string; password?: string }>(
    request,
  );
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

  let userRecord;
  try {
    userRecord = await createUser(env, body.username, body.password, "user");
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "注册失败";
    return jsonError(message, 409);
  }

  const token = await makeToken(env, userRecord.id, userRecord.role);
  const user = {
    id: userRecord.id,
    username: userRecord.username,
    role: userRecord.role,
  };
  return jsonOk({ user, token }, 201);
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
  const ownerId = ownerIdStr ? parseInt(ownerIdStr) : session.userId;

  if (!isAdmin(session) && ownerId !== session.userId) {
    return jsonError("Forbidden", 403);
  }

  const words = await repoGetWords(env, ownerId);
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
