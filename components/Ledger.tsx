"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  autoPayout,
  combosOf,
  DEFAULT_AMOUNT,
  DEFAULT_METHOD,
  isRefund,
  newId,
  normalizeCombo,
  summarize,
  toCSV,
  type LedgerEntry,
  type LedgerRow,
} from "@/lib/ledger";

type State = "loading" | "no-store" | "need-setup" | "locked" | "wrong" | "too-many" | "ok" | "error";

type RaceApi = {
  date: string;
  favorite: { combos: string[]; odds: number } | null;
  result: { combo: string; pay: number | null } | null;
};

const PASS_KEY = "omura.ledgerPass";

function readPass(): string {
  try {
    return window.localStorage.getItem(PASS_KEY) ?? "";
  } catch {
    return "";
  }
}

function writePass(p: string) {
  try {
    if (p) window.localStorage.setItem(PASS_KEY, p);
    else window.localStorage.removeItem(PASS_KEY);
  } catch {
    /* ignore */
  }
}

function todayJST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function yen(n: number): string {
  return `${n.toLocaleString("ja-JP")}円`;
}

function signedYen(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toLocaleString("ja-JP")}円`;
}

function md(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const w = "日月火水木金土"[d.getUTCDay()];
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}（${w}）`;
}

async function fetchRace(date: string): Promise<RaceApi | null> {
  try {
    const res = await fetch(`/api/race?date=${date}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as RaceApi) : null;
  } catch {
    return null;
  }
}

type Draft = {
  id: string;
  date: string;
  combo: string;
  amount: string;
  result: string;
  refund: boolean;
  payout: string;
  method: string;
  memo: string;
};

function emptyDraft(): Draft {
  return {
    id: "",
    date: todayJST(),
    combo: "",
    amount: String(DEFAULT_AMOUNT),
    result: "",
    refund: false,
    payout: "",
    method: DEFAULT_METHOD,
    memo: "",
  };
}

function draftOf(e: LedgerEntry): Draft {
  const refund = isRefund(e);
  return {
    id: e.id,
    date: e.date,
    combo: e.combo,
    amount: String(e.amount),
    result: refund ? "" : e.result,
    refund,
    payout: e.result && !refund ? String(e.payout) : "",
    method: e.method,
    memo: e.memo,
  };
}

export default function Ledger() {
  const [state, setState] = useState<State>("loading");
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [pass, setPass] = useState("");
  const [passInput, setPassInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const autoChecked = useRef(false);

  const call = useCallback(
    async (method: "GET" | "POST", body?: unknown, p = pass) => {
      const res = await fetch("/api/ledger", {
        method,
        cache: "no-store",
        headers: { "Content-Type": "application/json", "x-ledger-pass": encodeURIComponent(p) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json().catch(() => ({ state: "error" }))) as { state: string; entries?: LedgerEntry[] };
      return json;
    },
    [pass],
  );

  const apply = useCallback((json: { state: string; entries?: LedgerEntry[] }, p?: string) => {
    if (json.state === "ok") {
      if (p !== undefined) {
        writePass(p);
        setPass(p);
      }
      setEntries(json.entries ?? []);
      setState("ok");
      return true;
    }
    if (json.state === "wrong") writePass("");
    setState((["no-store", "need-setup", "locked", "wrong", "too-many"].includes(json.state) ? json.state : "error") as State);
    return false;
  }, []);

  // 最初の読み込み（保存してある合言葉で開く）
  useEffect(() => {
    const t = setTimeout(async () => {
      const p = readPass();
      try {
        apply(await call("GET", undefined, p), p);
      } catch {
        setState("error");
      }
    }, 0);
    return () => clearTimeout(t);
  }, [apply, call]);

  const save = useCallback(
    async (body: unknown, msg: string) => {
      setBusy(true);
      try {
        const json = await call("POST", body);
        if (apply(json)) setNotice(msg);
        else setNotice(json.state === "bad-csv" ? "CSVを読めませんでした（1行目に 日付,場,… の見出しが要ります）" : "保存できませんでした");
        return json.state === "ok";
      } catch {
        setNotice("通信に失敗しました。電波のよいところでもう一度押してください");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [apply, call],
  );

  // 結果待ちの行は、結果が出ていれば自動で埋める（1点買いだけ。多点買いは払戻を手で入れる）
  useEffect(() => {
    if (state !== "ok" || autoChecked.current) return;
    autoChecked.current = true;
    const pending = entries.filter((e) => !e.result && e.date <= todayJST() && combosOf(e.combo).length === 1);
    if (!pending.length) return;
    (async () => {
      const filled: string[] = [];
      for (const e of pending) {
        const r = await fetchRace(e.date);
        if (!r?.result) continue;
        const payout = autoPayout(e.combo, e.amount, r.result.combo, r.result.pay);
        if (payout == null) continue;
        const ok = await save({ action: "save", entry: { ...e, result: r.result.combo, payout } }, "");
        if (ok) filled.push(`${md(e.date)} ${r.result.combo}（${payout > 0 ? `的中 ${yen(payout)}` : "ハズレ"}）`);
      }
      if (filled.length) setNotice(`結果を反映しました: ${filled.join("、")}`);
    })();
  }, [state, entries, save]);

  const summary = useMemo(() => summarize(entries), [entries]);

  const unlock = async (setup: boolean) => {
    const p = passInput.normalize("NFKC").trim();
    if (!p) return;
    setBusy(true);
    try {
      const json = setup ? await call("POST", { action: "setup", pass: p }, p) : await call("GET", undefined, p);
      if (json.state === "too-short") setNotice("合言葉は4文字以上にしてください");
      else if (apply(json, p)) {
        setPassInput("");
        setNotice("");
      }
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return <p className="text-sm text-gray-400">帳簿を読み込み中…</p>;

  if (state === "no-store") {
    return (
      <div className="rounded-lg border border-yellow-700 bg-yellow-900/20 p-3 text-sm leading-relaxed text-gray-200">
        <p className="font-bold text-yellow-300">帳簿の保存先がまだつながっていません</p>
        <p className="mt-1">
          Vercel のプロジェクト → Storage → Create Database → 「Upstash for Redis」（Free）を作って、このプロジェクトに Connect
          したあと、再デプロイすると使えるようになります。
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <p className="rounded-lg border border-red-700 bg-red-900/30 p-3 text-sm">
        帳簿を読み込めませんでした。少し待ってから開き直してください。
      </p>
    );
  }

  if (state !== "ok") {
    const setup = state === "need-setup";
    return (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-gray-300">
          {setup
            ? "はじめに帳簿の合言葉を決めてください（4文字以上）。このスマホには覚えさせるので、次からは入力不要です。他の人はこの合言葉がないと帳簿を見られません。"
            : "帳簿は合言葉で鍵をかけています。合言葉を入れてください。"}
        </p>
        {state === "wrong" && <p className="text-sm font-bold text-red-400">合言葉が違います</p>}
        {state === "too-many" && <p className="text-sm font-bold text-red-400">間違いが続いたので1時間ロック中です</p>}
        <form
          className="flex gap-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            unlock(setup);
          }}
        >
          <input
            type="password"
            autoComplete={setup ? "new-password" : "current-password"}
            value={passInput}
            onChange={(ev) => setPassInput(ev.target.value)}
            placeholder="合言葉"
            className="min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-base"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-yellow-500 px-4 py-2 font-bold text-black disabled:opacity-50"
          >
            {setup ? "決める" : "開く"}
          </button>
        </form>
        {notice && <p className="text-sm text-red-400">{notice}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-700 bg-blue-900/30 p-2.5 text-sm">
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="text-gray-400" aria-label="閉じる">
            ✕
          </button>
        </div>
      )}

      <SummaryCards s={summary} />
      {summary.bets > 1 && <CumChart rows={summary.rows} />}

      {draft ? (
        <EntryForm
          draft={draft}
          setDraft={setDraft}
          busy={busy}
          onCancel={() => setDraft(null)}
          onSave={async (e) => {
            const ok = await save({ action: "save", entry: e }, `${md(e.date)} を記帳しました`);
            if (ok) setDraft(null);
          }}
          onDelete={
            draft.id
              ? async () => {
                  const ok = await save({ action: "delete", id: draft.id }, `${md(draft.date)} の行を消しました`);
                  if (ok) setDraft(null);
                }
              : undefined
          }
        />
      ) : (
        <button
          type="button"
          onClick={() => setDraft(emptyDraft())}
          className="w-full rounded-xl bg-yellow-500 py-3 text-base font-bold text-black"
        >
          ＋ 記帳する
        </button>
      )}

      <EntryList rows={summary.rows} onEdit={(e) => setDraft(draftOf(e))} />

      <DataTools
        entries={entries}
        busy={busy}
        onImport={(csv, mode) =>
          save({ action: "import", csv, mode }, mode === "replace" ? "CSVの中身で帳簿を置き換えました" : "CSVを取り込みました")
        }
        onLock={() => {
          writePass("");
          setPass("");
          setEntries([]);
          setState("locked");
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------- サマリ
function SummaryCards({ s }: { s: ReturnType<typeof summarize> }) {
  const extra = [s.refunds ? `返還${s.refunds}回` : "", s.pending ? `結果待ち${s.pending}回` : ""].filter(Boolean);
  return (
    <div>
      <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-3 text-center">
        <div className="text-xs text-gray-400">累計収支</div>
        <div
          className={`text-3xl font-bold tabular-nums ${s.total > 0 ? "text-green-400" : s.total < 0 ? "text-red-400" : "text-gray-200"}`}
        >
          {signedYen(s.total)}
        </div>
        <div className="mt-0.5 text-xs text-gray-400 tabular-nums">
          投入 {yen(s.stake)} ／ 払戻 {yen(s.returned)}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <Stat label="現在の連敗" value={`${s.streak}連敗`} tone={s.streak >= 5 ? "warn" : undefined} />
        <Stat label="的中率" value={s.hitRate == null ? "-" : `${s.hitRate.toFixed(1)}%`} sub={`${s.hits}/${s.bets}回`} />
        <Stat label="回収率" value={s.roi == null ? "-" : `${s.roi.toFixed(1)}%`} />
        <Stat label="購入回数" value={`${s.bets}回`} />
        <Stat label="最大連敗" value={`${s.maxStreak}連敗`} />
        <Stat label="最大落ち込み" value={s.maxDD ? signedYen(s.maxDD) : "0円"} />
      </div>
      {extra.length > 0 && (
        <p className="mt-1.5 text-xs text-gray-400">ほかに{extra.join("・")}（回数・的中率・連敗には数えない）</p>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/40 px-1 py-2">
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className={`text-base font-bold tabular-nums ${tone === "warn" ? "text-orange-400" : ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500 tabular-nums">{sub}</div>}
    </div>
  );
}

function CumChart({ rows }: { rows: LedgerRow[] }) {
  const pts = rows.filter((r) => r.status === "hit" || r.status === "miss");
  const vals = [0, ...pts.map((r) => r.cum ?? 0)];
  const W = 320;
  const H = 110;
  const pad = 6;
  const min = Math.min(0, ...vals);
  const max = Math.max(0, ...vals);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, vals.length - 1);
  const y = (v: number) => pad + ((max - v) * (H - pad * 2)) / span;
  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = vals[vals.length - 1];
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-2">
      <div className="mb-1 flex justify-between text-[11px] text-gray-400">
        <span>累計収支の推移（購入{pts.length}回）</span>
        <span className="tabular-nums">
          最高 {signedYen(max)} ／ 最低 {signedYen(min)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" role="img" aria-label="累計収支の推移">
        <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="#4b5563" strokeDasharray="3 3" />
        <path d={line} fill="none" stroke={last >= 0 ? "#4ade80" : "#f87171"} strokeWidth={2} strokeLinejoin="round" />
        {pts.map((r, i) =>
          r.status === "hit" ? <circle key={r.id} cx={x(i + 1)} cy={y(r.cum ?? 0)} r={3.5} fill="#facc15" /> : null,
        )}
      </svg>
      <p className="text-[11px] text-gray-500">黄色の点が的中</p>
    </div>
  );
}

// ---------------------------------------------------------------- 一覧
const BADGE: Record<LedgerRow["status"], { label: string; cls: string }> = {
  hit: { label: "的中", cls: "bg-yellow-500 text-black" },
  miss: { label: "ハズレ", cls: "bg-gray-700 text-gray-200" },
  refund: { label: "返還", cls: "bg-blue-800 text-blue-100" },
  pending: { label: "結果待ち", cls: "bg-orange-800 text-orange-100" },
};

function EntryList({ rows, onEdit }: { rows: LedgerRow[]; onEdit: (e: LedgerEntry) => void }) {
  if (!rows.length) {
    return <p className="text-sm text-gray-400">まだ記録がありません。下の「データの取り込み」から帳簿.csvを入れるか、「記帳する」で1行目をつけてください。</p>;
  }
  return (
    <ul className="space-y-2">
      {[...rows].reverse().map((r) => {
        const b = BADGE[r.status];
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onEdit(r)}
              className="w-full rounded-xl border border-gray-700 bg-gray-800/40 p-3 text-left active:bg-gray-800"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold tabular-nums">{md(r.date)}</span>
                <span className="text-xs text-gray-400">
                  {r.venue}
                  {r.race}
                </span>
                <span className={`ml-auto rounded px-2 py-0.5 text-xs font-bold ${b.cls}`}>{b.label}</span>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-1 text-sm tabular-nums">
                <div>
                  <div className="text-[11px] text-gray-500">買い目</div>
                  <div className="font-bold">{r.combo || "-"}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">購入額</div>
                  <div>{yen(r.amount)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">結果</div>
                  <div>{r.result || "-"}</div>
                </div>
              </div>
              {r.status !== "pending" && (
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-300 tabular-nums">
                  <span>払戻 {yen(r.payout)}</span>
                  <span className={(r.profit ?? 0) > 0 ? "text-green-400" : (r.profit ?? 0) < 0 ? "text-red-400" : ""}>
                    収支 {signedYen(r.profit ?? 0)}
                  </span>
                  <span>累計 {signedYen(r.cum ?? 0)}</span>
                </div>
              )}
              {r.memo && <p className="mt-1 line-clamp-2 text-xs text-gray-400">{r.memo}</p>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- 記帳フォーム
function EntryForm({
  draft,
  setDraft,
  busy,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  busy: boolean;
  onSave: (e: LedgerEntry) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [race, setRace] = useState<RaceApi | null>(null);
  const [looking, setLooking] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  const lookup = async () => {
    setLooking(true);
    setMsg("");
    const r = await fetchRace(draft.date);
    setLooking(false);
    setRace(r);
    if (!r) setMsg("boatrace.jp から取れませんでした");
    return r;
  };

  const fillFavorite = async () => {
    const r = race?.date === draft.date ? race : await lookup();
    if (!r?.favorite) {
      setMsg("まだ3連単オッズが出ていません");
      return;
    }
    set({ combo: r.favorite.combos[0] });
    setMsg(
      `今の1番人気 ${r.favorite.combos.join("・")}（${r.favorite.odds}倍）。締切直前に入れ替わることがあるので、実際に買った目に直してください`,
    );
  };

  const fillResult = async () => {
    const r = await lookup();
    if (!r?.result) {
      setMsg("まだ結果が出ていません");
      return;
    }
    const payout = autoPayout(draft.combo, Number(draft.amount) || 0, r.result.combo, r.result.pay);
    set({ result: r.result.combo, refund: false, payout: payout == null ? draft.payout : String(payout) });
    setMsg(
      `結果 ${r.result.combo}（3連単 ${r.result.pay != null ? yen(r.result.pay) : "払戻不明"}）` +
        (payout == null ? "。多点買いなので払戻は手で入れてください" : payout > 0 ? "。的中です" : "。ハズレ"),
    );
  };

  // 結果を手で入れたとき、1点買いなら払戻を自動で出す
  const onResult = (v: string) => {
    const res = normalizeCombo(v);
    const pay = race?.date === draft.date && race.result?.combo === res ? race.result.pay : null;
    const auto = res ? autoPayout(draft.combo, Number(draft.amount) || 0, res, pay) : null;
    set({ result: v, payout: auto != null ? String(auto) : draft.payout });
  };

  const submit = () => {
    const amount = Math.round(Number(draft.amount.replace(/[^0-9]/g, "")) || 0);
    const result = draft.refund ? "返還" : normalizeCombo(draft.result) || draft.result.trim();
    const payout = draft.refund ? amount : Math.round(Number(draft.payout.replace(/[^0-9]/g, "")) || 0);
    onSave({
      id: draft.id || newId(),
      date: draft.date,
      venue: "大村",
      race: "12R",
      method: draft.method.trim() || DEFAULT_METHOD,
      combo: combosOf(draft.combo).join(",") || draft.combo.trim(),
      amount,
      result,
      payout: result ? payout : 0,
      memo: draft.memo.trim(),
    });
  };

  const input = "w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-base";
  const small = "rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1.5 text-xs text-gray-200 disabled:opacity-50";

  return (
    <form
      className="space-y-3 rounded-xl border border-yellow-700 bg-gray-800/60 p-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
    >
      <div className="text-sm font-bold text-yellow-300">{draft.id ? "記録を直す" : "記帳する（大村12R）"}</div>

      <label className="block text-xs text-gray-400">
        日付
        <input type="date" required value={draft.date} onChange={(e) => set({ date: e.target.value })} className={input} />
      </label>

      <div>
        <label className="block text-xs text-gray-400">
          買い目（3連単。複数なら「,」区切り）
          <input
            inputMode="numeric"
            value={draft.combo}
            onChange={(e) => set({ combo: e.target.value })}
            placeholder="1-2-4"
            className={input}
          />
        </label>
        <button type="button" onClick={fillFavorite} disabled={looking} className={`${small} mt-1.5`}>
          今の1番人気を入れる
        </button>
      </div>

      <div>
        <label className="block text-xs text-gray-400">
          購入額（円）
          <input
            inputMode="numeric"
            value={draft.amount}
            onChange={(e) => set({ amount: e.target.value })}
            className={input}
          />
        </label>
        <div className="mt-1.5 flex gap-1.5">
          {[20000, 50000].map((v) => (
            <button key={v} type="button" onClick={() => set({ amount: String(v) })} className={small}>
              {v / 10000}万
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400">
          結果（12Rの着順。空欄なら「結果待ち」で、あとで自動で埋まります）
          <input
            inputMode="numeric"
            value={draft.result}
            disabled={draft.refund}
            onChange={(e) => onResult(e.target.value)}
            placeholder="例 1-3-4"
            className={`${input} disabled:opacity-40`}
          />
        </label>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={fillResult} disabled={looking || draft.refund} className={small}>
            結果を取得
          </button>
          <label className="flex items-center gap-1.5 text-xs text-gray-300">
            <input type="checkbox" checked={draft.refund} onChange={(e) => set({ refund: e.target.checked })} />
            返還（フライング・欠場・不成立）
          </label>
        </div>
      </div>

      {!draft.refund && draft.result.trim() !== "" && (
        <label className="block text-xs text-gray-400">
          払戻（円。ハズレは0）
          <input
            inputMode="numeric"
            value={draft.payout}
            onChange={(e) => set({ payout: e.target.value })}
            placeholder="0"
            className={input}
          />
        </label>
      )}

      <label className="block text-xs text-gray-400">
        メモ
        <textarea
          rows={2}
          value={draft.memo}
          onChange={(e) => set({ memo: e.target.value })}
          placeholder="確定オッズ・見送りサインの状況など"
          className={input}
        />
      </label>

      <details className="text-xs text-gray-400">
        <summary className="cursor-pointer">買い方（いつもと違うときだけ）</summary>
        <input value={draft.method} onChange={(e) => set({ method: e.target.value })} className={`${input} mt-1`} />
      </details>

      {msg && <p className="text-xs leading-relaxed text-blue-300">{msg}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-yellow-500 py-2.5 font-bold text-black disabled:opacity-50">
          {busy ? "保存中…" : "保存"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-gray-600 px-4 py-2.5 text-gray-300">
          やめる
        </button>
      </div>
      {onDelete && (
        <div className="text-right">
          {confirmDel ? (
            <span className="text-xs">
              本当に消しますか？{" "}
              <button type="button" onClick={onDelete} disabled={busy} className="font-bold text-red-400">
                消す
              </button>{" "}
              ／{" "}
              <button type="button" onClick={() => setConfirmDel(false)} className="text-gray-400">
                やめる
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmDel(true)} className="text-xs text-red-400">
              この行を消す
            </button>
          )}
        </div>
      )}
    </form>
  );
}

// ---------------------------------------------------------------- 取り込み・書き出し
function DataTools({
  entries,
  busy,
  onImport,
  onLock,
}: {
  entries: LedgerEntry[];
  busy: boolean;
  onImport: (csv: string, mode: "merge" | "replace") => Promise<boolean>;
  onLock: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [copied, setCopied] = useState(false);

  const download = () => {
    const blob = new Blob(["﻿" + toCSV(entries)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `帳簿_${todayJST()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toCSV(entries));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const small = "rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 disabled:opacity-50";

  return (
    <details className="rounded-xl border border-gray-700 p-3 text-sm">
      <summary className="cursor-pointer font-bold text-gray-300">データの取り込み・書き出し</summary>
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs text-gray-400">帳簿.csv と同じ列（日付,場,レース,買い方,買い目,購入額,結果,払戻,収支,累計収支,メモ）で書き出します。</p>
          <div className="mt-1.5 flex gap-2">
            <button type="button" onClick={download} className={small}>
              CSVを保存
            </button>
            <button type="button" onClick={copy} className={small}>
              {copied ? "コピーしました" : "CSVをコピー"}
            </button>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400">帳簿.csv の中身を貼り付けるか、ファイルを選んで取り込みます（収支・累計収支の列は計算し直すので空でもOK）。</p>
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="mt-1.5 block w-full text-xs text-gray-300"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setCsv(await f.text());
            }}
          />
          <textarea
            rows={4}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="日付,場,レース,買い方,買い目,購入額,結果,払戻,収支,累計収支,メモ"
            className="mt-1.5 w-full rounded-lg border border-gray-600 bg-gray-800 px-2 py-1.5 font-mono text-xs"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-300">
            <label className="flex items-center gap-1">
              <input type="radio" checked={mode === "merge"} onChange={() => setMode("merge")} />
              足りない行だけ足す
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} />
              全部置き換える
            </label>
            <button
              type="button"
              disabled={busy || !csv.trim()}
              onClick={async () => {
                if (await onImport(csv, mode)) setCsv("");
              }}
              className={small}
            >
              取り込む
            </button>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-2 text-right">
          <button type="button" onClick={onLock} className="text-xs text-gray-400 underline">
            このスマホで鍵をかけ直す（合言葉を忘れさせる）
          </button>
        </div>
      </div>
    </details>
  );
}
