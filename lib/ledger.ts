/**
 * 実戦の帳簿（実際に買った記録）の型・集計・CSV 変換。
 * 集計ルールは共有フォルダの omura/帳簿/update_ledger.py と同じ:
 *   - 結果が空欄の行は「結果待ち」で、収支・集計に入れない
 *   - 結果に「返還」と書いた行は 払戻=購入額（収支0）で、購入回数・的中率・回収率・連敗に数えない
 *   - 的中は 払戻 > 0
 * サーバー（app/api/ledger）とブラウザ（components/Ledger.tsx）の両方から使うので、ここには Node / React 固有のものを入れない。
 */

export type LedgerEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  venue: string; // 大村
  race: string; // 12R
  method: string; // 3連単1番人気1点
  combo: string; // 買い目 1-2-4（複数なら「,」区切り）
  amount: number; // 購入額（円）
  result: string; // 12Rの着順 1-3-4 ／ 返還 ／ 空欄=結果待ち
  payout: number; // 払戻（円）。ハズレは0
  memo: string;
};

export type LedgerRow = LedgerEntry & {
  status: "pending" | "refund" | "hit" | "miss";
  profit: number | null; // 結果待ちは null
  cum: number | null;
};

export type LedgerSummary = {
  rows: LedgerRow[]; // 日付の古い順
  bets: number; // 購入回数（返還・結果待ちを除く）
  hits: number;
  hitRate: number | null; // %
  stake: number;
  returned: number;
  roi: number | null; // %
  total: number; // 累計収支
  streak: number; // 現在の連敗
  maxStreak: number;
  maxDD: number; // 高値からの最大落ち込み（0以下）
  refunds: number;
  pending: number;
};

export const DEFAULT_METHOD = "3連単1番人気1点";
export const DEFAULT_AMOUNT = 50000;

export const CSV_COLS = ["日付", "場", "レース", "買い方", "買い目", "購入額", "結果", "払戻", "収支", "累計収支", "メモ"] as const;

export function isPending(e: Pick<LedgerEntry, "result">): boolean {
  return e.result.trim() === "";
}

export function isRefund(e: Pick<LedgerEntry, "result">): boolean {
  return e.result.includes("返還");
}

/** 買い目「1-2-4」「1-2-4,1-2-3」を組番の配列にする */
export function combosOf(s: string): string[] {
  return s
    .normalize("NFKC")
    .split(/[,、\s/]+/)
    .map((c) => c.replace(/[^1-6]/g, ""))
    .filter((c) => c.length === 3)
    .map((c) => `${c[0]}-${c[1]}-${c[2]}`);
}

/** 着順「1-3-4」「134」を正規化。3艇そろわなければ空 */
export function normalizeCombo(s: string): string {
  return combosOf(s)[0] ?? "";
}

/**
 * 結果と100円あたり払戻から、この行の払戻額を出す。
 * 1点買いだけ自動で出せる（多点買いは1点あたりの金額が分からないので null）。
 */
export function autoPayout(combo: string, amount: number, result: string, payPer100: number | null): number | null {
  if (isRefund({ result })) return amount;
  const r = normalizeCombo(result);
  if (!r) return null;
  const buys = combosOf(combo);
  if (!buys.includes(r)) return 0;
  if (buys.length !== 1 || payPer100 == null) return null;
  return Math.round((amount / 100) * payPer100);
}

export function summarize(entries: LedgerEntry[]): LedgerSummary {
  const sorted = [...entries].sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));
  const rows: LedgerRow[] = [];
  let cum = 0;
  let peak = 0;
  let maxDD = 0;
  let bets = 0;
  let hits = 0;
  let stake = 0;
  let returned = 0;
  let streak = 0;
  let maxStreak = 0;
  let refunds = 0;
  let pending = 0;
  for (const e of sorted) {
    if (isPending(e)) {
      pending++;
      rows.push({ ...e, status: "pending", profit: null, cum: null });
      continue;
    }
    if (isRefund(e)) {
      refunds++;
      rows.push({ ...e, payout: e.amount, status: "refund", profit: 0, cum });
      continue;
    }
    const profit = e.payout - e.amount;
    cum += profit;
    bets++;
    stake += e.amount;
    returned += e.payout;
    const hit = e.payout > 0;
    if (hit) {
      hits++;
      streak = 0;
    } else {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    }
    peak = Math.max(peak, cum);
    maxDD = Math.min(maxDD, cum - peak);
    rows.push({ ...e, status: hit ? "hit" : "miss", profit, cum });
  }
  return {
    rows,
    bets,
    hits,
    hitRate: bets ? (hits / bets) * 100 : null,
    stake,
    returned,
    roi: stake ? (returned / stake) * 100 : null,
    total: cum,
    streak,
    maxStreak,
    maxDD,
    refunds,
    pending,
  };
}

// ---------------------------------------------------------------- 入力チェック
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function str(v: unknown, max: number, keep = false): string {
  if (typeof v !== "string") return "";
  return (keep ? v : v.normalize("NFKC")).trim().slice(0, max);
}

function int(v: unknown): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[,円¥\s]/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.min(100_000_000, Math.round(n))) : 0;
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** 外から来た値を LedgerEntry に整える。日付が無ければ null */
export function sanitizeEntry(v: unknown): LedgerEntry | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const date = str(o.date, 10);
  if (!DATE_RE.test(date)) return null;
  const id = str(o.id, 40).replace(/[^0-9a-zA-Z_-]/g, "") || newId();
  const result = str(o.result, 20);
  const amount = int(o.amount);
  return {
    id,
    date,
    venue: str(o.venue, 10) || "大村",
    race: str(o.race, 10) || "12R",
    method: str(o.method, 40) || DEFAULT_METHOD,
    combo: str(o.combo, 120),
    amount,
    result: isRefund({ result }) ? "返還" : result,
    payout: isRefund({ result }) ? amount : int(o.payout),
    memo: str(o.memo, 500, true), // メモは全角かっこ等をそのまま残す
  };
}

// ---------------------------------------------------------------- CSV（帳簿.csv と同じ列）
function csvCell(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(entries: LedgerEntry[]): string {
  const { rows } = summarize(entries);
  const lines = [CSV_COLS.join(",")];
  for (const r of rows) {
    const pend = r.status === "pending";
    lines.push(
      [
        r.date,
        r.venue,
        r.race,
        r.method,
        r.combo,
        String(r.amount),
        r.result,
        pend ? "" : String(r.payout),
        pend ? "" : String(r.profit),
        pend ? "" : String(r.cum),
        r.memo,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}

/** RFC4180 くらいの CSV を2次元配列にする（ダブルクォート・改行入りセル対応） */
export function parseCSVText(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c.trim() !== ""));
}

/** 帳簿.csv（ヘッダー付き）を LedgerEntry の配列にする。日付の読めない行は飛ばす */
export function fromCSV(text: string): LedgerEntry[] {
  const table = parseCSVText(text);
  if (!table.length) return [];
  const head = table[0].map((h) => h.trim());
  const idx = (name: string) => head.indexOf(name);
  const get = (r: string[], name: string) => {
    const i = idx(name);
    return i >= 0 ? (r[i] ?? "") : "";
  };
  const out: LedgerEntry[] = [];
  table.slice(1).forEach((r, n) => {
    const e = sanitizeEntry({
      id: `csv${get(r, "日付").replace(/-/g, "")}${n}`,
      date: get(r, "日付"),
      venue: get(r, "場"),
      race: get(r, "レース"),
      method: get(r, "買い方"),
      combo: get(r, "買い目"),
      amount: get(r, "購入額"),
      result: get(r, "結果"),
      payout: get(r, "払戻"),
      memo: get(r, "メモ"),
    });
    if (e) out.push(e);
  });
  return out;
}
