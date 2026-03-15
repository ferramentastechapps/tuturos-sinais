// Admin authentication module — single-user hardcoded access
// Credentials are intentionally hardcoded as this is a single-user admin system

const ADMIN_EMAIL = "ferramentastech.apps@gmail.com";
const ADMIN_PASSWORD = "30maio!Sds";

// Fixed UUID for the admin user — used in all Supabase queries
export const ADMIN_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const SESSION_KEY = "ts_admin_token";
const RATE_LIMIT_KEY = "ts_rate_limit";

// 30 days in milliseconds
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export interface AdminSession {
  email: string;
  role: "admin";
  permissions: string[];
  userId: string;
  loginAt: string;
  expiresAt: string;
}

interface RateLimitState {
  attempts: number;
  lastAttemptAt: number;
  blockedUntil: number | null;
}

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

export function validateLogin(email: string, password: string): boolean {
  return email.trim() === ADMIN_EMAIL && password === ADMIN_PASSWORD;
}

// ─────────────────────────────────────────────
// Session Management
// ─────────────────────────────────────────────

export function saveSession(): AdminSession {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  const session: AdminSession = {
    email: ADMIN_EMAIL,
    role: "admin",
    permissions: ["full_access"],
    userId: ADMIN_USER_ID,
    loginAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const session: AdminSession = JSON.parse(raw);
    if (!session.expiresAt || !session.role) return null;

    // Check expiration
    if (new Date(session.expiresAt) <= new Date()) {
      clearSession();
      return null;
    }

    return session;
  } catch {
    clearSession();
    return null;
  }
}

export function isSessionValid(): boolean {
  return getSession() !== null;
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ─────────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────────

const MAX_ATTEMPTS = 3;
const BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const ATTEMPT_WINDOW_MS = 60 * 1000;      // 1 minute window

function getRateLimit(): RateLimitState {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return { attempts: 0, lastAttemptAt: 0, blockedUntil: null };
    return JSON.parse(raw);
  } catch {
    return { attempts: 0, lastAttemptAt: 0, blockedUntil: null };
  }
}

function saveRateLimit(state: RateLimitState): void {
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(state));
}

export function resetRateLimit(): void {
  localStorage.removeItem(RATE_LIMIT_KEY);
}

/**
 * Returns null if allowed to attempt login.
 * Returns milliseconds remaining if blocked.
 */
export function checkRateLimit(): number | null {
  const state = getRateLimit();
  const now = Date.now();

  // Currently blocked?
  if (state.blockedUntil && now < state.blockedUntil) {
    return state.blockedUntil - now;
  }

  // Reset if outside attempt window
  if (now - state.lastAttemptAt > ATTEMPT_WINDOW_MS) {
    saveRateLimit({ attempts: 0, lastAttemptAt: now, blockedUntil: null });
    return null;
  }

  return null;
}

export function recordFailedAttempt(): { blocked: boolean; remainingMs: number | null } {
  const state = getRateLimit();
  const now = Date.now();

  // Reset window if stale
  const attempts =
    now - state.lastAttemptAt > ATTEMPT_WINDOW_MS ? 1 : state.attempts + 1;

  const blockedUntil =
    attempts >= MAX_ATTEMPTS ? now + BLOCK_DURATION_MS : state.blockedUntil;

  saveRateLimit({ attempts, lastAttemptAt: now, blockedUntil: blockedUntil ?? null });

  if (blockedUntil && now < blockedUntil) {
    console.warn(`[Auth] Login bloqueado por ${BLOCK_DURATION_MS / 60000} min após ${MAX_ATTEMPTS} tentativas.`);
    return { blocked: true, remainingMs: blockedUntil - now };
  }

  console.warn(`[Auth] Tentativa de login inválida #${attempts}`);
  return { blocked: false, remainingMs: null };
}
