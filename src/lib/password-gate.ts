import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// The # 비밀번호 channel is the one place in this login-free workspace that
// needs a barrier — a passphrase gate, not real auth. The cookie stores an
// HMAC of a fixed marker (keyed by the passphrase) rather than the passphrase
// itself, so it can't be read back out of the browser.
const COOKIE_NAME = "wonder_pw_gate";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function expectedToken(): string | null {
  const passphrase = process.env.PASSWORDS_CHANNEL_PASSPHRASE;
  if (!passphrase) return null;
  return createHmac("sha256", passphrase).update("wonder-passwords-unlocked").digest("hex");
}

export function gateConfigured(): boolean {
  return Boolean(process.env.PASSWORDS_CHANNEL_PASSPHRASE);
}

export function checkPassphrase(input: string): boolean {
  const passphrase = process.env.PASSWORDS_CHANNEL_PASSPHRASE;
  if (!passphrase) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(passphrase);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isUnlocked(): Promise<boolean> {
  const expected = expectedToken();
  if (!expected) return false;
  const store = await cookies();
  const cookie = store.get(COOKIE_NAME)?.value;
  if (!cookie) return false;
  const a = Buffer.from(cookie);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function unlock(): Promise<void> {
  const token = expectedToken();
  if (!token) return;
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function lock(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
