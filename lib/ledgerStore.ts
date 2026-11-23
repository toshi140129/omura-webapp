/**
 * 帳簿の保存先: Upstash Redis（Vercel の Storage → Marketplace から無料プランで作れる）。
 * Vercel でプロジェクトにつなぐと KV_REST_API_URL / KV_REST_API_TOKEN（または UPSTASH_REDIS_REST_URL / _TOKEN）が自動で入る。
 * REST API を fetch で直接呼ぶので追加パッケージは要らない。サーバー側（app/api/ledger）からだけ使う。
 *
 * 合言葉: 環境変数 LEDGER_PASSCODE があればそれ。無ければ最初に画面で決めた合言葉（ソルト付きハッシュ）を Redis に置く。
 */
import type { LedgerEntry } from "./ledger";
import { sanitizeEntry } from "./ledger";

const KEY_ENTRIES = "omura:ledger:entries";
const KEY_BACKUP = "omura:ledger:backup"; // 書き換え前の中身を新しい順に30件まで残す
const KEY_PASS = "omura:ledger:pass";
const KEY_FAIL = "omura:ledger:fail";
const MAX_FAIL_PER_HOUR = 20;

function findEnv(suffixes: string[]): string {
  for (const s of suffixes) if (process.env[s]) return process.env[s] as string;
  // 接続時に接頭辞を付けた場合（例 OMURA_KV_REST_API_URL）も拾う
  for (const [k, v] of Object.entries(process.env)) if (v && suffixes.some((s) => k.endsWith(`_${s}`))) return v;
  return "";
}

function conf(): { url: string; token: string } | null {
  const url = findEnv(["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"]);
  const token = findEnv(["KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"]);
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function storeConfigured(): boolean {
  return conf() !== null;
}

async function cmd<T = unknown>(...args: (string | number)[]): Promise<T> {
  const c = conf();
  if (!c) throw new Error("store-not-configured");
  const res = await fetch(c.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args.map(String)),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
  if (!res.ok || json.error) throw new Error(`redis: ${json.error ?? res.status}`);
  return json.result as T;
}

export async function loadEntries(): Promise<LedgerEntry[]> {
  const raw = await cmd<string | null>("GET", KEY_ENTRIES);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown[];
    return arr.map(sanitizeEntry).filter((e): e is LedgerEntry => e !== null);
  } catch {
    return [];
  }
}

export async function saveEntries(entries: LedgerEntry[]): Promise<void> {
  const prev = await cmd<string | null>("GET", KEY_ENTRIES);
  if (prev) {
    await cmd("LPUSH", KEY_BACKUP, JSON.stringify({ at: new Date().toISOString(), entries: JSON.parse(prev) }));
    await cmd("LTRIM", KEY_BACKUP, 0, 29);
  }
  await cmd("SET", KEY_ENTRIES, JSON.stringify(entries));
}

// ---------------------------------------------------------------- 合言葉
async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** "env"=環境変数で決まっている / "set"=画面で決めたものがある / "none"=まだ無い */
export async function passState(): Promise<"env" | "set" | "none"> {
  if (process.env.LEDGER_PASSCODE) return "env";
  return (await cmd<string | null>("GET", KEY_PASS)) ? "set" : "none";
}

/** 最初の1回だけ合言葉を登録する（すでにあれば false） */
export async function registerPass(pass: string): Promise<boolean> {
  if (process.env.LEDGER_PASSCODE) return false;
  const salt = crypto.randomUUID();
  const ok = await cmd<string | null>("SET", KEY_PASS, `${salt}:${await sha256(`${salt}:${pass}`)}`, "NX");
  return ok === "OK";
}

export type AuthResult = "ok" | "wrong" | "locked" | "none";

export async function checkPass(pass: string): Promise<AuthResult> {
  const fails = Number((await cmd<string | null>("GET", KEY_FAIL)) ?? 0);
  if (fails >= MAX_FAIL_PER_HOUR) return "locked";
  let ok = false;
  const env = process.env.LEDGER_PASSCODE;
  if (env) {
    ok = sameText(await sha256(pass), await sha256(env));
  } else {
    const stored = await cmd<string | null>("GET", KEY_PASS);
    if (!stored) return "none";
    const [salt, hash] = stored.split(":");
    ok = sameText(await sha256(`${salt}:${pass}`), hash ?? "");
  }
  if (ok) return "ok";
  const n = await cmd<number>("INCR", KEY_FAIL);
  if (Number(n) === 1) await cmd("EXPIRE", KEY_FAIL, 3600);
  return "wrong";
}
