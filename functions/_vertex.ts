import { Env } from './_helpers';

interface ServiceAccountJson {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function base64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    bytes = new Uint8Array(input);
  }
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return bytes.buffer;
}

async function signJwt(serviceAccount: ServiceAccountJson): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = serviceAccount.token_uri ?? 'https://oauth2.googleapis.com/token';
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64url(signature)}`;
}

export async function getGoogleAccessToken(env: Env): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not configured.');
  }

  const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) as ServiceAccountJson;
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Invalid service account JSON.');
  }

  const assertion = await signJwt(serviceAccount);
  const tokenUri = serviceAccount.token_uri ?? 'https://oauth2.googleapis.com/token';
  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google OAuth token request failed with status ${response.status}.`);
  }

  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error('Google OAuth token response did not contain access_token.');
  }

  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 3600) * 1000),
  };
  return data.access_token;
}

export async function callVertexGenerateContent(env: Env, prompt: string): Promise<string> {
  const accessToken = await getGoogleAccessToken(env);
  const location = env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const project = env.GOOGLE_CLOUD_PROJECT;
  const model = env.VERTEX_MODEL || 'gemini-2.5-flash';
  if (!project) throw new Error('GOOGLE_CLOUD_PROJECT is not configured.');

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Goog-User-Project': project,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1200,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Vertex AI request failed with status ${response.status}.`);
  }

  const data = await response.json() as any;
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part: { text?: string }) => part.text ?? '').join('').trim();
  if (!text) throw new Error('Vertex AI returned an empty article.');
  return text;
}

export function isAllowedVertexProxyUrl(originalUrl: string): boolean {
  try {
    const url = new URL(originalUrl);
    const modelMethods = new Set(['generateContent', 'predict', 'streamGenerateContent']);
    const agentMethods = new Set(['query', 'streamQuery']);
    const isSafeSegment = (value: string | undefined) => Boolean(value) && encodeURIComponent(value!) === value;

    if (url.hostname === 'aiplatform.googleapis.com') {
      const segments = url.pathname.split('/');
      if (
        segments.length === 6 &&
        segments[0] === '' &&
        isSafeSegment(segments[1]) &&
        segments[2] === 'publishers' &&
        segments[3] === 'google' &&
        segments[4] === 'models'
      ) {
        const [model, method] = segments[5].split(':');
        return isSafeSegment(model) && modelMethods.has(method);
      }
    }

    if (url.hostname.endsWith('-aiplatform.googleapis.com')) {
      const segments = url.pathname.split('/');
      if (
        segments.length === 8 &&
        segments[0] === '' &&
        isSafeSegment(segments[1]) &&
        segments[2] === 'projects' &&
        isSafeSegment(segments[3]) &&
        segments[4] === 'locations' &&
        isSafeSegment(segments[5]) &&
        segments[6] === 'reasoningEngines'
      ) {
        const [id, method] = segments[7].split(':');
        return isSafeSegment(id) && agentMethods.has(method);
      }
    }

    return false;
  } catch {
    return false;
  }
}

export function toVertexEndpoint(env: Env, originalUrl: string): string {
  const url = new URL(originalUrl);
  const location = env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const project = env.GOOGLE_CLOUD_PROJECT;
  if (!project) throw new Error('GOOGLE_CLOUD_PROJECT is not configured.');

  if (url.hostname === 'aiplatform.googleapis.com') {
    const segments = url.pathname.split('/');
    return `https://${location}-aiplatform.googleapis.com/${segments[1]}/projects/${project}/locations/${location}/publishers/google/models/${segments[5]}`;
  }
  return originalUrl;
}
