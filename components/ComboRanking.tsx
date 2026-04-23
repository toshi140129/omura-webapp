"use client";
import { useMemo, useState } from "react";
import type { RaceRow } from "@/app/page";

type Bucket = { label: string; match: (n: number) => boolean };

const POPS = [1, 2, 3, 4];

const WIND: Bucket[] = [
  { label: "無風(0m)", match: (n) => n === 0 },
  { label: "弱(1-2m)", match: (n) => n >= 1 && n <= 2 },
  { label: "中(3-4m)", match: (n) => n >= 3 && n <= 4 },
  { label: "強(5-6m)", match: (n) => n >= 5 && n <= 6 },
  { label: "強風(7m〜)", match: (n) => n >= 7 },
];

const WAVE: Bucket[] = [
  { label: "凪(0-1cm)", match: (n) => n >= 0 && n <= 1 },
  { label: "小(2-3cm)", match: (n) => n >= 2 && n <= 3 },
  { label: "中(4-6cm)", match: (n) => n >= 4 && n <= 6 },
  { label: "大(7-9cm)", match: (n) => n >= 7 && n <= 9 },
  { label: "荒(10cm〜)", match: (n) => n >= 10 },
];

const DIRS: Bucket[] = [
  { label: "北(N)", match: (n) => n === 1 || n === 2 || n === 15 || n === 16 },
  { label: "東(E)", match: (n) => n >= 3 && n <= 6 },
  { label: "南(S)", match: (n) => n >= 7 && n <= 10 },
  { label: "西(W)", match: (n) => n >= 11 && n <= 14 },
];

const MIN_SAMPLES = 10;
const TOP_N = 20;
const BET_POINTS = 4; // 3連単人気上位4点買い
const BET_PER_POINT = 100; // 1点あたり100円
const BET_PER_DAY = BET_POINTS * BET_PER_POINT; // 1日あたり400円

type Combo = {
  pop: number;
  windLabel: string;
  waveLabel: string;
  dirLabel: string;
  sample: number;
  hits: number;
  hitRate: number;
  avgPayoutOnHit: number;
  returnRate: number;
  profitPerDay: number;
};

function parseIntOrNull(raw: string): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export default function ComboRanking({ data }: { data: RaceRow[] }) {
  const [sortKey, setSortKey] = useState<"hit" | "ret">("ret");

  const hasWeatherAndRank = useMemo(
    () => data.some((r) => r.r11.rank && r.r12.wind),
    [data]
  );

  const combos = useMemo<Combo[]>(() => {
    if (!hasWeatherAndRank) return [];
    const out: Combo[] = [];
    for (const pop of POPS) {
      const byPop = data.filter((r) => parseIntOrNull(r.r11.rank) === pop);
      for (const wb of WIND) {
        const byWind = byPop.filter((r) => {
          const v = parseIntOrNull(r.r12.wind);
          return v !== null && wb.match(v);
        });
        for (const vb of WAVE) {
          const byWave = byWind.filter((r) => {
            const v = parseIntOrNull(r.r12.wave);
            return v !== null && vb.match(v);
          });
          for (const db of DIRS) {
            const matched = byWave.filter((r) => {
              const v = parseIntOrNull(r.r12.wdir);
              return v !== null && db.match(v);
            });
            if (matched.length < MIN_SAMPLES) continue;

            // 3連単人気上位4点買い: 当選組み合わせの人気ランクが4以内なら的中
            const hits = matched.filter((r) => {
              const rank = parseIntOrNull(r.r12.rank);
              return rank !== null && rank >= 1 && rank <= BET_POINTS;
            });
            const payoutSum = hits.reduce(
              (s, r) => s + (parseIntOrNull(r.r12.pay) ?? 0),
              0
            );
            const hitRate = (hits.length / matched.length) * 100;
            const avgPayoutOnHit = hits.length ? payoutSum / hits.length : 0;
            const totalCost = matched.length * BET_PER_DAY;
            const returnRate = (payoutSum / totalCost) * 100;
            const profitPerDay = (payoutSum - totalCost) / matched.length;

            out.push({
              pop,
              windLabel: wb.label,
              waveLabel: vb.label,
              dirLabel: db.label,
              sample: matched.length,
              hits: hits.length,
              hitRate: Math.round(hitRate * 10) / 10,
              avgPayoutOnHit: Math.round(avgPayoutOnHit),
              returnRate: Math.round(returnRate * 10) / 10,
              profitPerDay: Math.round(profitPerDay),
            });
          }
        }
      }
    }
    return out;
  }, [data, hasWeatherAndRank]);

  const sorted = useMemo(() => {
    const copy = [...combos];
    if (sortKey === "hit") {
      copy.sort(
        (a, b) => b.hitRate - a.hitRate || b.returnRate - a.returnRate
      );
    } else {
      copy.sort(
        (a, b) => b.returnRate - a.returnRate || b.hitRate - a.hitRate
      );
    }
    return copy.slice(0, TOP_N);
  }, [combos, sortKey]);

  if (!hasWeatherAndRank) {
    return (
      <div className="mb-6 rounded-lg border border-gray-700 p-4">
        <h2 className="font-bold mb-3 text-lg">条件組合せランキング</h2>
        <div className="text-xs text-gray-400">
          人気・気象データがまだCSVに揃っていません。
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-gray-700 p-4">
      <h2 className="font-bold mb-3 text-lg">条件組合せランキング</h2>
      <p className="text-xs text-gray-400 mb-3">
        11R決着人気(1-4番) × 12R風速 × 12R波高 × 12R風向 の全組み合わせから、
        サンプル数 {MIN_SAMPLES} 件以上のみを対象に上位 {TOP_N} 件を表示。
        <br />
        ※戦略: 該当日に12Rの3連単人気上位{BET_POINTS}点を各100円で購入
        （1日あたり{BET_PER_DAY}円）。
        的中=当選組が人気{BET_POINTS}番以内。
        回収率={BET_PER_DAY}円/日に対する払戻の比率（100%超で期待値プラス）。
      </p>

      <div className="flex flex-wrap gap-1 mb-3">
        <span className="text-xs text-gray-400 self-center mr-1">ソート:</span>
        {(["ret", "hit"] as const).map((k) => {
          const active = sortKey === k;
          const label = k === "ret" ? "回収率順" : "的中率順";
          return (
            <button
              key={k}
              type="button"
              onClick={() => setSortKey(k)}
              className={`px-2 py-1 text-xs rounded border ${
                active
                  ? "bg-yellow-500 text-black border-yellow-500 font-bold"
                  : "bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          );
        })}
        <span className="text-xs text-gray-500 self-center ml-2">
          全{combos.length}パターン該当
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="text-xs text-gray-500">
          サンプル{MIN_SAMPLES}件以上の組合せがありません
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="py-1 pr-1 text-left">#</th>
                <th className="py-1 px-1 text-left">条件</th>
                <th className="py-1 px-1 text-right">件</th>
                <th className="py-1 px-1 text-right">的中率</th>
                <th className="py-1 px-1 text-right">平均払戻</th>
                <th className="py-1 px-1 text-right">回収率</th>
                <th className="py-1 px-1 text-right">損益/日</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => {
                const profitable = c.returnRate >= 100;
                return (
                  <tr
                    key={`${c.pop}-${c.windLabel}-${c.waveLabel}-${c.dirLabel}`}
                    className={`border-b border-gray-800 ${
                      i === 0 ? "bg-yellow-900/20" : ""
                    }`}
                  >
                    <td className="py-1 pr-1 text-gray-400">{i + 1}</td>
                    <td className="py-1 px-1 text-gray-200">
                      <div className="flex flex-wrap gap-1">
                        <span className="bg-gray-700 rounded px-1">
                          {c.pop}番人気
                        </span>
                        <span className="bg-gray-700 rounded px-1">
                          {c.windLabel}
                        </span>
                        <span className="bg-gray-700 rounded px-1">
                          {c.waveLabel}
                        </span>
                        <span className="bg-gray-700 rounded px-1">
                          {c.dirLabel}
                        </span>
                      </div>
                    </td>
                    <td className="py-1 px-1 text-right text-gray-300">
                      {c.sample}
                    </td>
                    <td className="py-1 px-1 text-right">
                      <span
                        className={
                          c.hitRate >= 50
                            ? "text-yellow-300 font-bold"
                            : "text-gray-200"
                        }
                      >
                        {c.hitRate}%
                      </span>
                      <span className="text-gray-500 text-[10px] ml-1">
                        ({c.hits})
                      </span>
                    </td>
                    <td className="py-1 px-1 text-right text-gray-200">
                      {c.avgPayoutOnHit ? c.avgPayoutOnHit.toLocaleString() : "-"}
                    </td>
                    <td className="py-1 px-1 text-right">
                      <span
                        className={`font-bold ${
                          profitable ? "text-green-400" : "text-gray-300"
                        }`}
                      >
                        {c.returnRate}%
                      </span>
                    </td>
                    <td className="py-1 px-1 text-right">
                      <span
                        className={`font-bold ${
                          c.profitPerDay > 0
                            ? "text-green-400"
                            : c.profitPerDay < 0
                            ? "text-red-400"
                            : "text-gray-300"
                        }`}
                      >
                        {c.profitPerDay > 0 ? "+" : ""}
                        {c.profitPerDay.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
