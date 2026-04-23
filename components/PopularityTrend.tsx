"use client";
import type { RaceRow } from "@/app/page";

type Bucket = { label: string; match: (n: number) => boolean };

const BUCKETS: Bucket[] = [
  { label: "1番", match: (n) => n === 1 },
  { label: "2番", match: (n) => n === 2 },
  { label: "3番", match: (n) => n === 3 },
  { label: "4番", match: (n) => n === 4 },
  { label: "5番", match: (n) => n === 5 },
  { label: "6-10番", match: (n) => n >= 6 && n <= 10 },
  { label: "11-30番", match: (n) => n >= 11 && n <= 30 },
  { label: "31番〜", match: (n) => n >= 31 },
];

const PIVOT_RANKS = [1, 2, 3, 4];

function parseRank(raw: string): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

export default function PopularityTrend({ data }: { data: RaceRow[] }) {
  const hasRankData = data.some((r) => r.r11.rank || r.r12.rank);

  if (!hasRankData) {
    return (
      <div className="mb-6 rounded-lg border border-gray-700 p-4">
        <h2 className="font-bold mb-3 text-lg">同日12Rの人気順傾向（11R人気順別）</h2>
        <div className="text-xs text-gray-400">
          人気順データがまだCSVに取り込まれていません。
          バックフィル完了後、再デプロイで反映されます。
        </div>
      </div>
    );
  }

  const stats = PIVOT_RANKS.map((pivot) => {
    const matches = data.filter((r) => parseRank(r.r11.rank) === pivot);
    const r12Ranks = matches
      .map((r) => parseRank(r.r12.rank))
      .filter((n): n is number => n !== null);

    const bucketCounts = BUCKETS.map((b) => {
      const count = r12Ranks.filter((n) => b.match(n)).length;
      const rate = r12Ranks.length
        ? Math.round((count / r12Ranks.length) * 100)
        : 0;
      return { label: b.label, count, rate };
    });

    const top = [...bucketCounts].sort((a, b) => b.count - a.count)[0];
    const topLabel = top && top.count > 0 ? top.label : null;
    const topRate = top?.rate ?? 0;

    return {
      pivot,
      total: matches.length,
      validTotal: r12Ranks.length,
      bucketCounts,
      topLabel,
      topRate,
    };
  });

  return (
    <div className="mb-6 rounded-lg border border-gray-700 p-4">
      <h2 className="font-bold mb-3 text-lg">同日12Rの人気順傾向（11R人気順別）</h2>
      <p className="text-xs text-gray-400 mb-3">
        11Rが1〜4番人気で決着した日、同じ日の12Rで何番人気が1着に来たかを集計。
        <br />
        ※人気順はboatrace.jpの3連単払戻の「人気」列を使用。
      </p>

      {stats.map((s) => (
        <div key={s.pivot} className="mb-4">
          <div className="flex items-center justify-between mb-2 border-l-4 border-yellow-400 pl-2">
            <h3 className="text-sm font-bold text-yellow-400">
              11R 決着 = {s.pivot}番人気
              <span className="text-gray-400 text-xs ml-2 font-normal">
                （{s.validTotal}日分）
              </span>
            </h3>
            {s.topLabel && (
              <span className="text-yellow-300 text-xs font-bold">
                最頻: {s.topLabel} ({s.topRate}%)
              </span>
            )}
          </div>
          {s.validTotal === 0 ? (
            <div className="text-xs text-gray-500 pl-2">該当日なし</div>
          ) : (
            <div className="grid grid-cols-4 gap-1 text-xs text-center">
              {s.bucketCounts.map((b) => {
                const isTop = b.label === s.topLabel && b.count > 0;
                return (
                  <div
                    key={b.label}
                    className={`rounded p-1 ${
                      isTop
                        ? "bg-yellow-500 text-black font-bold"
                        : "bg-gray-700 text-gray-200"
                    }`}
                  >
                    <div className="font-bold">{b.label}</div>
                    <div>{b.rate}%</div>
                    <div className="text-[10px] opacity-75">{b.count}日</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
