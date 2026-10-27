"use client";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { FLAT_BET_LOG, FLAT_BET_RANGE, type FlatBetRow } from "@/lib/flatBetLog";

/**
 * 定額買いの収支シミュレーター。
 * 「①②成立＋見送り3条件クリアの日に 12R 3連単1番人気を1点」を、入力した定額で
 * 毎回買った場合の累計収支・年別/月別収支・サマリーを過去ログ（lib/flatBetLog.ts）から即時計算する。
 */

const PRESETS = [10000, 20000, 30000, 50000];
const STORAGE_KEY = "omura.flatbet.amount";
const DEFAULT_AMOUNT = 20000;
const MIN_AMOUNT = 1000;
const MAX_AMOUNT = 200000;

// 色: 折れ線は1系列なので青1色、棒の正負は状態色（プラス緑・マイナス赤）
const C_LINE = "#3987e5";
const C_GOOD = "#0ca30c";
const C_BAD = "#d03b3b";
const C_SURFACE = "#111827";
const C_GRID = "#374151";
const C_AXIS = "#9ca3af";

type DayResult = FlatBetRow & {
  bet: number;
  ret: number;
  pl: number;
  cum: number;
};

type Bucket = { key: string; label: string; days: number; hits: number; pl: number; invested: number };

type Summary = {
  rows: DayResult[];
  days: number;
  hits: number;
  invested: number;
  returned: number;
  total: number;
  maxDD: number;
  maxDDFrom: string;
  maxDDTo: string;
  maxStreak: number;
  maxStreakEnd: string;
  perYear: number;
  perMonth: number;
  months: Bucket[];
  years: Bucket[];
};

const yen = (v: number) => `${v < 0 ? "−" : v > 0 ? "+" : ""}${Math.abs(v).toLocaleString("ja-JP")}円`;
const yenPlain = (v: number) => `${v.toLocaleString("ja-JP")}円`;
const man = (v: number) => {
  const a = Math.abs(v) / 10000;
  const s = a >= 100 ? a.toFixed(0) : a >= 10 ? a.toFixed(1) : a.toFixed(2);
  return `${v < 0 ? "−" : v > 0 ? "+" : ""}${s.replace(/\.?0+$/, "")}万`;
};
const tickLabel = (v: number) => {
  if (v === 0) return "0";
  const a = Math.abs(v);
  const s = a >= 10000 ? `${(a / 10000).toLocaleString("ja-JP")}万` : a.toLocaleString("ja-JP");
  return `${v < 0 ? "−" : ""}${s}`;
};
const pct = (n: number, d: number) => (d === 0 ? "-" : `${((n / d) * 100).toFixed(1)}%`);

function niceStep(range: number, target = 4) {
  if (range <= 0) return 1;
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (raw <= m * mag) return m * mag;
  }
  return 10 * mag;
}

function dayNumber(d: string) {
  return Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000);
}

function simulate(log: FlatBetRow[], amount: number): Summary {
  let cum = 0;
  let peak = 0;
  let peakDate = log[0]?.d ?? "";
  let maxDD = 0;
  let maxDDFrom = "";
  let maxDDTo = "";
  let streak = 0;
  let maxStreak = 0;
  let maxStreakEnd = "";
  let hits = 0;
  let invested = 0;
  let returned = 0;
  const months = new Map<string, Bucket>();
  const years = new Map<string, Bucket>();
  const rows: DayResult[] = log.map((r) => {
    const ret = Math.round((r.pay * amount) / 100);
    const pl = ret - amount;
    cum += pl;
    invested += amount;
    returned += ret;
    if (r.pay > 0) {
      hits++;
      streak = 0;
    } else {
      streak++;
      if (streak > maxStreak) {
        maxStreak = streak;
        maxStreakEnd = r.d;
      }
    }
    if (cum > peak) {
      peak = cum;
      peakDate = r.d;
    }
    if (cum - peak < maxDD) {
      maxDD = cum - peak;
      maxDDFrom = peakDate;
      maxDDTo = r.d;
    }
    const ym = r.d.slice(0, 7);
    const y = r.d.slice(0, 4);
    const bump = (m: Map<string, Bucket>, key: string, label: string) => {
      const b = m.get(key) ?? { key, label, days: 0, hits: 0, pl: 0, invested: 0 };
      b.days++;
      b.hits += r.pay > 0 ? 1 : 0;
      b.pl += pl;
      b.invested += amount;
      m.set(key, b);
    };
    bump(months, ym, `${+ym.slice(5, 7)}月`);
    bump(years, y, `${y}年`);
    return { ...r, bet: amount, ret, pl, cum };
  });
  const total = cum;
  const span = log.length ? dayNumber(log[log.length - 1].d) - dayNumber(log[0].d) + 1 : 0;
  const perYear = span > 0 ? (total * 365) / span : 0;
  return {
    rows,
    days: log.length,
    hits,
    invested,
    returned,
    total,
    maxDD,
    maxDDFrom,
    maxDDTo,
    maxStreak,
    maxStreakEnd,
    perYear,
    perMonth: perYear / 12,
    months: [...months.values()],
    years: [...years.values()],
  };
}

// 定額は localStorage を正とする小さな外部ストア（使えない環境ではメモリ上の値）
let memAmount = DEFAULT_AMOUNT;
const AMOUNT_EVENT = "omura.flatbet.amount";
function readAmount(): number {
  try {
    const v = Number(window.localStorage.getItem(STORAGE_KEY));
    if (v >= MIN_AMOUNT && v <= MAX_AMOUNT) return v;
  } catch {
    /* ignore */
  }
  return memAmount;
}
function writeAmount(v: number) {
  memAmount = v;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(v));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(AMOUNT_EVENT));
}
function subscribeAmount(cb: () => void) {
  window.addEventListener(AMOUNT_EVENT, cb);
  return () => window.removeEventListener(AMOUNT_EVENT, cb);
}
const serverAmount = () => DEFAULT_AMOUNT;

export default function FlatBetSimulator() {
  const amount = useSyncExternalStore(subscribeAmount, readAmount, serverAmount);
  // 入力欄の途中の文字列。null のときは確定済みの定額を表示する
  const [draft, setDraft] = useState<string | null>(null);
  const [year, setYear] = useState<string>("all");
  const [barMode, setBarMode] = useState<"month" | "year">("month");

  const apply = (v: number) => {
    const n = Math.min(MAX_AMOUNT, Math.max(MIN_AMOUNT, Math.round(v / 100) * 100 || DEFAULT_AMOUNT));
    writeAmount(n);
    setDraft(null);
  };

  const yearOptions = useMemo(() => {
    const ys = new Set(FLAT_BET_LOG.map((r) => r.d.slice(0, 4)));
    return [...ys].sort();
  }, []);

  const log = useMemo(
    () => (year === "all" ? FLAT_BET_LOG : FLAT_BET_LOG.filter((r) => r.d.startsWith(year))),
    [year],
  );
  const s = useMemo(() => simulate(log, amount), [log, amount]);
  const roi = s.invested > 0 ? (s.returned / s.invested) * 100 : 0;

  return (
    <div className="space-y-5 text-sm">
      {/* 条件の説明 */}
      <p className="text-xs leading-relaxed text-gray-400">
        ①11R 1着=1号艇 ②10Rと11Rの3連単が不一致、かつ見送り3条件（1号艇の勝率差≤−1.0・雨・展示タイム4位以下）に
        当てはまらない日に、12R 3連単の1番人気を1点だけ同じ金額で買い続けた場合の収支です。
        対象 {FLAT_BET_RANGE.from}〜{FLAT_BET_RANGE.to}、{FLAT_BET_LOG.length}日。確定オッズ・実払戻で計算。
      </p>

      {/* 入力行: 定額と期間 */}
      <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-800/60 p-3">
        <div className="flex items-center gap-2">
          <label htmlFor="flatbet-amount" className="shrink-0 text-xs font-bold text-gray-300">
            1点の定額
          </label>
          <input
            id="flatbet-amount"
            type="number"
            inputMode="numeric"
            min={MIN_AMOUNT}
            max={MAX_AMOUNT}
            step={1000}
            value={draft ?? String(amount)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => apply(Number(draft ?? amount))}
            onKeyDown={(e) => {
              if (e.key === "Enter") apply(Number(draft ?? amount));
            }}
            className="w-28 rounded-md border border-gray-600 bg-gray-900 px-2 py-1.5 text-right font-bold text-yellow-300 tabular-nums"
          />
          <span className="text-xs text-gray-400">円</span>
        </div>
        <input
          type="range"
          aria-label="定額スライダー"
          min={MIN_AMOUNT}
          max={100000}
          step={1000}
          value={Math.min(amount, 100000)}
          onChange={(e) => apply(Number(e.target.value))}
          className="w-full accent-yellow-400"
        />
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Chip key={p} active={amount === p} onClick={() => apply(p)}>
              {p / 10000}万円
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-700 pt-3">
          <span className="text-xs font-bold text-gray-300">期間</span>
          <Chip active={year === "all"} onClick={() => setYear("all")}>
            全期間
          </Chip>
          {yearOptions.map((y) => (
            <Chip key={y} active={year === y} onClick={() => setYear(y)}>
              {y}年
            </Chip>
          ))}
        </div>
      </div>

      {/* 結果の要約 */}
      <div>
        <div className="text-xs text-gray-400">
          {yenPlain(amount)}定額 × {s.days}日の最終収支
        </div>
        <div
          className={`mt-1 text-4xl font-bold leading-none ${
            s.total > 0 ? "text-green-300" : s.total < 0 ? "text-red-300" : "text-gray-200"
          }`}
        >
          {yen(s.total)}
        </div>
        <div className="mt-1 text-xs text-gray-400">
          投入 {yenPlain(s.invested)} ／ 払戻 {yenPlain(s.returned)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tile label="回収率" value={`${roi.toFixed(1)}%`} tone={roi >= 100 ? "good" : "bad"} />
        <Tile label="的中" value={`${s.hits}回 / ${s.days}日`} sub={`的中率 ${pct(s.hits, s.days)}`} />
        <Tile label="年平均収支" value={man(s.perYear)} sub={`月平均 ${man(s.perMonth)}`} tone={s.perYear >= 0 ? "good" : "bad"} />
        <Tile
          label="最大の落ち込み"
          value={man(s.maxDD)}
          sub={s.maxDDFrom ? `${s.maxDDFrom.slice(0, 7)}〜${s.maxDDTo.slice(0, 7)}` : "-"}
          tone="bad"
        />
        <Tile
          label="最長連敗"
          value={`${s.maxStreak}連敗`}
          sub={`持ち出し ${man(-s.maxStreak * amount)}`}
          tone="bad"
        />
        <Tile label="軍資金の目安" value={`${Math.ceil((-s.maxDD * 1.2) / 100000) * 10}万`} sub="最大落ち込みの1.2倍" />
      </div>

      {/* 累計収支の推移 */}
      <div>
        <h3 className="mb-1 text-xs font-bold text-gray-300">累計収支の推移（1日ごと）</h3>
        <CumulativeChart rows={s.rows} amount={amount} />
      </div>

      {/* 年別・月別の収支 */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-300">{barMode === "month" ? "月別" : "年別"}の収支</h3>
          <div className="flex gap-1">
            <Chip active={barMode === "month"} onClick={() => setBarMode("month")}>
              月別
            </Chip>
            <Chip active={barMode === "year"} onClick={() => setBarMode("year")}>
              年別
            </Chip>
          </div>
        </div>
        <BucketChart buckets={barMode === "month" ? s.months : s.years} mode={barMode} />
      </div>

      {/* 年別の表 */}
      <div>
        <h3 className="mb-1 text-xs font-bold text-gray-300">年別のまとめ</h3>
        <table className="w-full text-center text-xs tabular-nums">
          <thead>
            <tr className="text-gray-400">
              <th className="py-1 text-left font-normal">年</th>
              <th className="py-1 font-normal">日数</th>
              <th className="py-1 font-normal">的中</th>
              <th className="py-1 font-normal">回収率</th>
              <th className="py-1 text-right font-normal">収支</th>
            </tr>
          </thead>
          <tbody>
            {s.years.map((b) => {
              const r = ((b.pl + b.invested) / b.invested) * 100;
              return (
                <tr key={b.key} className="border-t border-gray-800">
                  <td className="py-1.5 text-left">{b.key}</td>
                  <td className="py-1.5">{b.days}</td>
                  <td className="py-1.5">
                    {b.hits}回（{pct(b.hits, b.days)}）
                  </td>
                  <td className="py-1.5">{r.toFixed(0)}%</td>
                  <td className={`py-1.5 text-right font-bold ${b.pl >= 0 ? "text-green-300" : "text-red-300"}`}>
                    {yen(b.pl)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 日別の表（折りたたみ） */}
      <details className="rounded-lg border border-gray-700">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-bold text-gray-300">
          日別の明細（{s.days}日）を表示
        </summary>
        <div className="max-h-96 overflow-y-auto border-t border-gray-800">
          <table className="w-full text-center text-xs tabular-nums">
            <thead className="sticky top-0 bg-gray-900 text-gray-400">
              <tr>
                <th className="px-2 py-1 text-left font-normal">日付</th>
                <th className="py-1 font-normal">買い目</th>
                <th className="py-1 font-normal">オッズ</th>
                <th className="py-1 font-normal">結果</th>
                <th className="py-1 text-right font-normal">収支</th>
                <th className="px-2 py-1 text-right font-normal">累計</th>
              </tr>
            </thead>
            <tbody>
              {s.rows.map((r) => (
                <tr key={r.d} className={`border-t border-gray-800 ${r.pay > 0 ? "bg-green-900/20" : ""}`}>
                  <td className="px-2 py-1 text-left">{r.d}</td>
                  <td className="py-1">{r.fav}</td>
                  <td className="py-1">{r.o.toFixed(1)}</td>
                  <td className={`py-1 ${r.pay > 0 ? "font-bold text-green-300" : "text-gray-400"}`}>{r.res}</td>
                  <td className={`py-1 text-right ${r.pl >= 0 ? "text-green-300" : "text-red-300"}`}>{yen(r.pl)}</td>
                  <td className="px-2 py-1 text-right">{yen(r.cum)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="text-xs leading-relaxed text-gray-500">
        1番人気は締切直前のオッズ画面で確認して買う前提です（確定オッズ基準のため、締切直前の入れ替わりは
        含みません）。日別ログは scripts/build_flat_bet_log.py で omura-boatrace のCSVから再生成できます。
      </p>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-8 rounded-full px-3 py-1 text-xs ${
        active ? "bg-yellow-500 font-bold text-black" : "bg-gray-700 text-gray-200 hover:bg-gray-600"
      }`}
    >
      {children}
    </button>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-green-300" : tone === "bad" ? "text-red-300" : "text-gray-100";
  return (
    <div className="rounded-lg bg-gray-800 px-3 py-2">
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className={`mt-0.5 text-lg font-bold leading-tight ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-gray-400">{sub}</div>}
    </div>
  );
}

/* ---------- 累計収支の折れ線 ---------- */

const VW = 360;
const LH = 200;
const PAD = { l: 48, r: 14, t: 14, b: 22 };

function CumulativeChart({ rows, amount }: { rows: DayResult[]; amount: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const g = useMemo(() => {
    if (rows.length === 0) return null;
    const d0 = dayNumber(rows[0].d);
    const d1 = Math.max(dayNumber(rows[rows.length - 1].d), d0 + 1);
    const xs = rows.map((r) => PAD.l + ((dayNumber(r.d) - d0) / (d1 - d0)) * (VW - PAD.l - PAD.r));
    let lo = Math.min(0, ...rows.map((r) => r.cum));
    let hi = Math.max(0, ...rows.map((r) => r.cum));
    if (hi === lo) hi = lo + amount;
    const step = niceStep(hi - lo);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (LH - PAD.t - PAD.b);
    const ys = rows.map((r) => y(r.cum));
    const ticks: number[] = [];
    for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
    // 年の境目（1月1日）を縦の目盛りにする
    const yearTicks: { x: number; label: string }[] = [];
    const y0 = +rows[0].d.slice(0, 4);
    const y1 = +rows[rows.length - 1].d.slice(0, 4);
    for (let yy = y0; yy <= y1; yy++) {
      const dn = dayNumber(`${yy}-01-01`);
      if (dn < d0 || dn > d1) continue;
      yearTicks.push({ x: PAD.l + ((dn - d0) / (d1 - d0)) * (VW - PAD.l - PAD.r), label: `${yy}年` });
    }
    if (yearTicks.length === 0) yearTicks.push({ x: PAD.l, label: `${y0}年` });
    const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
    return { xs, ys, y, ticks, yearTicks, path, zero: y(0) };
  }, [rows, amount]);

  if (!g) return <div className="py-6 text-center text-xs text-gray-500">対象日がありません</div>;

  const locate = (clientX: number) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * VW;
    // 一番近い点を探す
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < g.xs.length; i++) {
      const d = Math.abs(g.xs[i] - x);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    setHover(best);
  };

  const last = rows[rows.length - 1];
  const h = hover !== null ? rows[hover] : null;
  const tipLeft = h ? Math.min(Math.max((g.xs[hover!] / VW) * 100, 22), 78) : 0;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${LH}`}
        className="w-full touch-pan-y select-none"
        role="img"
        aria-label="累計収支の推移"
        onPointerMove={(e) => locate(e.clientX)}
        onPointerDown={(e) => locate(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        {g.ticks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.l}
              x2={VW - PAD.r}
              y1={g.y(v)}
              y2={g.y(v)}
              stroke={v === 0 ? C_AXIS : C_GRID}
              strokeWidth={v === 0 ? 1.2 : 1}
            />
            <text x={PAD.l - 6} y={g.y(v) + 3.5} textAnchor="end" fontSize={10} fill={C_AXIS}>
              {tickLabel(v)}
            </text>
          </g>
        ))}
        {g.yearTicks.map((t) => (
          <g key={t.label}>
            <line x1={t.x} x2={t.x} y1={PAD.t} y2={LH - PAD.b} stroke={C_GRID} strokeWidth={1} />
            <text x={t.x + 3} y={LH - 8} fontSize={10} fill={C_AXIS}>
              {t.label}
            </text>
          </g>
        ))}
        <path d={g.path} fill="none" stroke={C_LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* 終点 */}
        <circle cx={g.xs[g.xs.length - 1]} cy={g.ys[g.ys.length - 1]} r={5} fill={C_SURFACE} />
        <circle cx={g.xs[g.xs.length - 1]} cy={g.ys[g.ys.length - 1]} r={3.5} fill={C_LINE} />
        {hover === null && (
          <text
            x={Math.min(g.xs[g.xs.length - 1], VW - PAD.r - 2)}
            y={g.ys[g.ys.length - 1] < PAD.t + 14 ? g.ys[g.ys.length - 1] + 16 : g.ys[g.ys.length - 1] - 9}
            textAnchor="end"
            fontSize={11}
            fontWeight="bold"
            fill="#e5e7eb"
          >
            {man(last.cum)}
          </text>
        )}
        {h && (
          <g>
            <line x1={g.xs[hover!]} x2={g.xs[hover!]} y1={PAD.t} y2={LH - PAD.b} stroke={C_AXIS} strokeWidth={1} />
            <circle cx={g.xs[hover!]} cy={g.ys[hover!]} r={6} fill={C_SURFACE} />
            <circle cx={g.xs[hover!]} cy={g.ys[hover!]} r={4} fill={C_LINE} />
          </g>
        )}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-gray-600 bg-gray-800/95 px-2 py-1 text-[11px] leading-snug shadow-lg"
          style={{ left: `${tipLeft}%` }}
        >
          <div className="font-bold text-gray-100">{h.d}</div>
          <div className="text-gray-300">
            {h.fav}（{h.o.toFixed(1)}倍） {h.pay > 0 ? "的中" : "ハズレ"} {yen(h.pl)}
          </div>
          <div className="text-gray-300">
            累計 <span className="font-bold text-gray-100">{yen(h.cum)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- 年別・月別の棒 ---------- */

const BH = 170;
const BPAD = { l: 48, r: 10, t: 16, b: 20 };

function BucketChart({ buckets, mode }: { buckets: Bucket[]; mode: "month" | "year" }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const g = useMemo(() => {
    if (buckets.length === 0) return null;
    let lo = Math.min(0, ...buckets.map((b) => b.pl));
    let hi = Math.max(0, ...buckets.map((b) => b.pl));
    if (hi === lo) hi = lo + 10000;
    const step = niceStep(hi - lo);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    const y = (v: number) => BPAD.t + ((hi - v) / (hi - lo)) * (BH - BPAD.t - BPAD.b);
    const slot = (VW - BPAD.l - BPAD.r) / buckets.length;
    const w = Math.max(1, Math.min(24, slot - 2));
    const xs = buckets.map((_, i) => BPAD.l + slot * i + (slot - w) / 2);
    const ticks: number[] = [];
    for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
    const labels = buckets
      .map((b, i) => ({ i, text: mode === "year" ? b.label : b.key.endsWith("-01") || i === 0 ? `${b.key.slice(0, 4)}年` : "" }))
      .filter((l) => l.text);
    return { y, xs, w, slot, ticks, labels, zero: y(0) };
  }, [buckets, mode]);

  if (!g) return <div className="py-6 text-center text-xs text-gray-500">対象月がありません</div>;

  const locate = (clientX: number) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * VW;
    const i = Math.floor((x - BPAD.l) / g.slot);
    setHover(i >= 0 && i < buckets.length ? i : null);
  };

  const h = hover !== null ? buckets[hover] : null;
  const tipLeft = h ? Math.min(Math.max(((g.xs[hover!] + g.w / 2) / VW) * 100, 22), 78) : 0;

  // 4px の角丸をデータ側の端だけに付ける（基準線側は直角）
  const barPath = (x: number, v: number) => {
    const top = Math.min(g.y(v), g.zero);
    const bottom = Math.max(g.y(v), g.zero);
    const hgt = bottom - top;
    const r = Math.min(4, hgt, g.w / 2);
    if (hgt < 0.5) return "";
    if (v >= 0) {
      return `M${x},${bottom} V${top + r} a${r},${r} 0 0 1 ${r},-${r} H${x + g.w - r} a${r},${r} 0 0 1 ${r},${r} V${bottom} Z`;
    }
    return `M${x},${top} V${bottom - r} a${r},${r} 0 0 0 ${r},${r} H${x + g.w - r} a${r},${r} 0 0 0 ${r},-${r} V${top} Z`;
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${BH}`}
        className="w-full touch-pan-y select-none"
        role="img"
        aria-label={mode === "month" ? "月別の収支" : "年別の収支"}
        onPointerMove={(e) => locate(e.clientX)}
        onPointerDown={(e) => locate(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        {g.ticks.map((v) => (
          <g key={v}>
            <line
              x1={BPAD.l}
              x2={VW - BPAD.r}
              y1={g.y(v)}
              y2={g.y(v)}
              stroke={v === 0 ? C_AXIS : C_GRID}
              strokeWidth={v === 0 ? 1.2 : 1}
            />
            <text x={BPAD.l - 6} y={g.y(v) + 3.5} textAnchor="end" fontSize={10} fill={C_AXIS}>
              {tickLabel(v)}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => (
          <path
            key={b.key}
            d={barPath(g.xs[i], b.pl)}
            fill={b.pl >= 0 ? C_GOOD : C_BAD}
            opacity={hover === null || hover === i ? 1 : 0.55}
          />
        ))}
        {mode === "year" &&
          buckets.map((b, i) => (
            <text
              key={b.key}
              x={g.xs[i] + g.w / 2}
              y={b.pl >= 0 ? g.y(b.pl) - 4 : g.y(b.pl) + 11}
              textAnchor="middle"
              fontSize={10}
              fontWeight="bold"
              fill="#e5e7eb"
            >
              {man(b.pl)}
            </text>
          ))}
        {g.labels.map((l) => (
          <text
            key={l.i}
            x={mode === "year" ? g.xs[l.i] + g.w / 2 : g.xs[l.i]}
            y={BH - 6}
            textAnchor={mode === "year" ? "middle" : "start"}
            fontSize={10}
            fill={C_AXIS}
          >
            {l.text}
          </text>
        ))}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-gray-600 bg-gray-800/95 px-2 py-1 text-[11px] leading-snug shadow-lg"
          style={{ left: `${tipLeft}%` }}
        >
          <div className="font-bold text-gray-100">
            {mode === "month" ? `${h.key.slice(0, 4)}年${+h.key.slice(5, 7)}月` : h.label}
          </div>
          <div className="text-gray-300">
            {h.days}日・的中{h.hits}回 <span className="font-bold text-gray-100">{yen(h.pl)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
