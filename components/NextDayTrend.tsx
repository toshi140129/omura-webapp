"use client";
import type { RaceRow } from "@/app/page";

const BOATS = ["1", "2", "3", "4", "5", "6"] as const;

type BoatRate = { boat: string; count: number; rate: number };

export default function NextDayTrend({ data }: { data: RaceRow[] }) {
  const pivotBoats = ["1", "2", "3", "4"];

  const stats = pivotBoats.map((boat) => {
    const matches = data.filter((r) => r.r11.p1 === boat);

    const counts: Record<string, number> = {};
    matches.forEach((r) => {
      const winner = r.r12.p1;
      if (winner) counts[winner] = (counts[winner] || 0) + 1;
    });

    const ranking: BoatRate[] = BOATS.map((b) => ({
      boat: b,
      count: counts[b] || 0,
      rate: matches.length
        ? Math.round(((counts[b] || 0) / matches.length) * 100)
        : 0,
    }));

    const top = [...ranking].sort((a, b) => b.count - a.count);
    const topBoat = top[0]?.count ? top[0].boat : null;
    const topRate = top[0]?.rate ?? 0;

    return { boat, total: matches.length, ranking, topBoat, topRate };
  });

  return (
    <div className="mb-6 rounded-lg border border-gray-700 p-4">
      <h2 className="font-bold mb-3 text-lg">同日12Rの1着傾向（11R勝者別）</h2>
      <p className="text-xs text-gray-400 mb-3">
        11Rで各号艇が1着になった日に、同じ日の12Rで1着になりやすい号艇の傾向。
      </p>

      {stats.map((s) => (
        <div key={s.boat} className="mb-4">
          <div className="flex items-center justify-between mb-2 border-l-4 border-yellow-400 pl-2">
            <h3 className="text-sm font-bold text-yellow-400">
              11R 1着 = {s.boat}号艇
              <span className="text-gray-400 text-xs ml-2 font-normal">
                （{s.total}日分）
              </span>
            </h3>
            {s.topBoat && (
              <span className="text-yellow-300 text-xs font-bold">
                最頻: {s.topBoat}号艇 ({s.topRate}%)
              </span>
            )}
          </div>
          {s.total === 0 ? (
            <div className="text-xs text-gray-500 pl-2">該当日なし</div>
          ) : (
            <div className="grid grid-cols-6 gap-1 text-xs text-center">
              {s.ranking.map((b) => {
                const isTop = b.boat === s.topBoat && b.count > 0;
                return (
                  <div
                    key={b.boat}
                    className={`rounded p-1 ${
                      isTop
                        ? "bg-yellow-500 text-black font-bold"
                        : "bg-gray-700 text-gray-200"
                    }`}
                  >
                    <div className="font-bold">{b.boat}号</div>
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
