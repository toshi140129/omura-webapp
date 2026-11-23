import type { NextRequest } from "next/server";
import { fromCSV, sanitizeEntry, type LedgerEntry } from "@/lib/ledger";
import {
  checkPass,
  loadEntries,
  passState,
  registerPass,
  saveEntries,
  storeConfigured,
} from "@/lib/ledgerStore";

/**
 * 実戦の帳簿 API（合言葉が必要。ヘッダー x-ledger-pass で渡す）
 * GET  /api/ledger                         … 帳簿の全行
 * POST /api/ledger {action:"setup", pass}  … 最初の合言葉を決める（環境変数 LEDGER_PASSCODE が無いときだけ）
 * POST /api/ledger {action:"save", entry}  … 1行を追加・上書き（id で判定）
 * POST /api/ledger {action:"delete", id}   … 1行を消す
 * POST /api/ledger {action:"import", csv, mode:"merge"|"replace"} … 帳簿.csv を取り込む
 * 書き換えのたびに直前の中身を30件まで控えておく（lib/ledgerStore.ts）。
 */

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

/** 合言葉を確かめる。だめなら返すべきレスポンス、よければ null */
async function guard(request: NextRequest): Promise<Response | null> {
  if (!storeConfigured()) return json({ state: "no-store" });
  const ps = await passState();
  if (ps === "none") return json({ state: "need-setup" });
  let pass = request.headers.get("x-ledger-pass") ?? "";
  try {
    pass = decodeURIComponent(pass).normalize("NFKC").trim();
  } catch {
    /* そのまま使う */
  }
  if (!pass) return json({ state: "locked" });
  const r = await checkPass(pass);
  if (r === "locked") return json({ state: "too-many" }, 429);
  if (r !== "ok") return json({ state: "wrong" }, 401);
  return null;
}

function sameBet(a: LedgerEntry, b: LedgerEntry) {
  return a.date === b.date && a.race === b.race && a.combo === b.combo && a.amount === b.amount;
}

export async function GET(request: NextRequest) {
  try {
    const ng = await guard(request);
    if (ng) return ng;
    return json({ state: "ok", entries: await loadEntries() });
  } catch (e) {
    console.error("ledger GET", e);
    return json({ state: "error" }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "setup") {
      if (!storeConfigured()) return json({ state: "no-store" });
      const pass = String(body.pass ?? "").normalize("NFKC").trim();
      if (pass.length < 4) return json({ state: "too-short" }, 400);
      if (!(await registerPass(pass))) return json({ state: "already-set" }, 409);
      return json({ state: "ok", entries: await loadEntries() });
    }

    const ng = await guard(request);
    if (ng) return ng;
    let entries = await loadEntries();

    if (action === "save") {
      const e = sanitizeEntry(body.entry);
      if (!e) return json({ state: "bad-entry" }, 400);
      const i = entries.findIndex((x) => x.id === e.id);
      if (i >= 0) entries[i] = e;
      else entries.push(e);
    } else if (action === "delete") {
      const id = String(body.id ?? "");
      entries = entries.filter((x) => x.id !== id);
    } else if (action === "import") {
      const rows = fromCSV(String(body.csv ?? ""));
      if (!rows.length) return json({ state: "bad-csv" }, 400);
      if (body.mode === "replace") entries = rows;
      else entries = [...entries, ...rows.filter((r) => !entries.some((x) => sameBet(x, r)))];
    } else {
      return json({ state: "bad-action" }, 400);
    }

    entries.sort((a, b) => a.date.localeCompare(b.date));
    await saveEntries(entries);
    return json({ state: "ok", entries });
  } catch (e) {
    console.error("ledger POST", e);
    return json({ state: "error" }, 500);
  }
}
