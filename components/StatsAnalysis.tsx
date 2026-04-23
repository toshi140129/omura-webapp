"use client";
import type { RaceRow } from "@/app/page";

type Stats = {
  total: number;
  cond1Days: number;
  cond1Rate: number;
  cond3GivenCond1: number;
  cond4GivenCond1: number;
  combTable: { label: string; hit: number; total: number; rate: number }[];
  c12total: number;
  condTable12: { label: string; count: number; total: number; rate: number }[];
};

function calcStats(data: RaceRow[]): Stats {
  const total = data.length;
  const cond1Days = data.filter((r) => r.r11.p1 === "1").length;

  const c1 = data.filter((r) => r.r11.p1 === "1");
  const cond3GivenCond1 = c1.length
    ? Math.round((c1.filter((r) => r.r12.p1 === "1").length / c1.length) * 100)
    : 0;

  const c1c4 = c1.filter((r) => {
    const r11_23 = [r.r11.p2, r.r11.p3];
    const r12_23 = [r.r12.p2, r.r12.p3];
    return r11_23.some((b) => r12_23.includes(b));
  });
  const cond4GivenCond1 = c1.length
    ? Math.round((c1c4.length / c1.length) * 100)
    : 0;

  const combos: { label: string; filter: (r: RaceRow) => boolean }[] = [
    { label: "①のみ", filter: (r) => r.r11.p1 === "1" },
    {
      label: "①②",
      filter: (r) => {
        const c1 = r.r11.p1 === "1";
        const c2 = !(r.r10.p1 === r.r11.p1 && r.r10.p2 === r.r11.p2 && r.r10.p3 === r.r11.p3);
        return c1 && c2;
      },
    },
    {
      label: "①③",
      filter: (r) => r.r11.p1 === "1" && r.r12.p1 === "1",
    },
    {
      label: "①②③",
      filter: (r) => {
        const c1 = r.r11.p1 === "1";
        const c2 = !(r.r10.p1 === r.r11.p1 && r.r10.p2 === r.r11.p2 && r.r10.p3 === r.r11.p3);
        const c3 = r.r12.p1 === "1";
        return c1 && c2 && c3;
      },
    },
    {
      label: "①③④",
      filter: (r) => {
        const c1 = r.r11.p1 === "1";
        const c3 = r.r12.p1 === "1";
        const c4 = [r.r11.p2, r.r11.p3].some((b) => [r.r12.p2, r.r12.p3].includes(b));
        return c1 && c3 && c4;
      },
    },
    {
      label: "①②③④",
      filter: (r) => {
        const c1 = r.r11.p1 === "1";
        const c2 = !(r.r10.p1 === r.r11.p1 && r.r10.p2 === r.r11.p2 && r.r10.p3 === r.r11.p3);
        const c3 = r.r12.p1 === "1";
        const c4 = [r.r11.p2, r.r11.p3].some((b) => [r.r12.p2, r.r12.p3].includes(b));
        return c1 && c2 && c3 && c4;
      },
    },
    {
      label: "①②③④⑤(全)",
      filter: (r) => {
        const c1 = r.r11.p1 === "1";
        const c2 = !(r.r10.p1 === r.r11.p1 && r.r10.p2 === r.r11.p2 && r.r10.p3 === r.r11.p3);
        const c3 = r.r12.p1 === "1";
        const c4 = [r.r11.p2, r.r11.p3].some((b) => [r.r12.p2, r.r12.p3].includes(b));
        const c5 = parseInt(r.r12.pay || "0") > 0 && parseInt(r.r12.pay || "0") < 4000;
        return c1 && c2 && c3 && c4 && c5;
      },
    },
  ];

  const hitFilter = (r: RaceRow) => {
    const c1 = r.r11.p1 === "1";
    const c3 = r.r12.p1 === "1";
    const c4 = [r.r11.p2, r.r11.p3].some((b) => [r.r12.p2, r.r12.p3].includes(b));
    const c5 = parseInt(r.r12.pay || "0") > 0 && parseInt(r.r12.pay || "0") < 4000;
    return c1 && c3 && c4 && c5;
  };

  const combTable = combos.map(({ label, filter }) => {
    const matched = data.filter(filter);
    const hits = matched.filter(hitFilter);
    return {
      label,
      hit: hits.length,
      total: matched.length,
      rate: matched.length ? Math.round((hits.length / matched.length) * 100) : 0,
    };
  });

  // ①②成立時の条件付き確率
  const c12 = data.filter((r) => {
    const c1 = r.r11.p1 === "1";
    const c2 = !(r.r10.p1 === r.r11.p1 && r.r10.p2 === r.r11.p2 && r.r10.p3 === r.r11.p3);
    return c1 && c2;
  });
  const condTable12 = [
    {
      label: "③も来る（12R 1着=1号艇）",
      count: c12.filter((r) => r.r12.p1 === "1").length,
    },
    {
      label: "④も来る（2・3着に共通艇）",
      count: c12.filter((r) => [r.r11.p2, r.r11.p3].some((b) => [r.r12.p2, r.r12.p3].includes(b))).length,
    },
    {
      label: "③④両方来る",
      count: c12.filter((r) => {
        const c3 = r.r12.p1 === "1";
        const c4 = [r.r11.p2, r.r11.p3].some((b) => [r.r12.p2, r.r12.p3].includes(b));
        return c3 && c4;
      }).length,
    },
    {
      label: "③④⑤全部来る（的中）",
      count: c12.filter((r) => {
        const c3 = r.r12.p1 === "1";
        const c4 = [r.r11.p2, r.r11.p3].some((b) => [r.r12.p2, r.r12.p3].includes(b));
        const c5 = parseInt(r.r12.pay || "0") > 0 && parseInt(r.r12.pay || "0") < 4000;
        return c3 && c4 && c5;
      }).length,
    },
  ].map(({ label, count }) => ({
    label,
    count,
    total: c12.length,
    rate: c12.length ? Math.round((count / c12.length) * 100) : 0,
  }));

  return { total, cond1Days, cond1Rate: total ? Math.round((cond1Days / total) * 100) : 0, cond3GivenCond1, cond4GivenCond1, combTable, c12total: c12.length, condTable12 };
}

export default function StatsAnalysis({ data }: { data: RaceRow[] }) {
  const s = calcStats(data);
  return (
    <div className="mb-6 rounded-lg border border-gray-700 p-4">
      <h2 className="font-bold mb-3 text-lg">確率分析</h2>
      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        <Stat label="総日数" value={`${s.total}日`} />
        <Stat label="①成立日" value={`${s.cond1Days}日 (${s.cond1Rate}%)`} />
        <Stat label="①→③確率" value={`${s.cond3GivenCond1}%`} />
        <Stat label="①→④確率" value={`${s.cond4GivenCond1}%`} />
      </div>
      <h3 className="text-sm font-bold text-gray-400 mb-2">①②成立時の条件付き確率</h3>
      <div className="text-xs text-gray-400 mb-1">①②成立日数：{s.c12total}日</div>
      <div className="space-y-1 mb-4">
        {s.condTable12.map((row) => (
          <div key={row.label} className="flex justify-between text-xs bg-gray-800 rounded p-2">
            <span className="text-gray-300">{row.label}</span>
            <span className={`font-bold ${row.rate >= 50 ? "text-yellow-400" : "text-white"}`}>
              {row.rate}% ({row.count}/{row.total}日)
            </span>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-bold text-gray-400 mb-2">条件組み合わせ別的中率</h3>
      <table className="w-full text-xs text-center">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700">
            <th className="py-1 text-left">条件</th>
            <th className="py-1">該当</th>
            <th className="py-1">的中</th>
            <th className="py-1">的中率</th>
          </tr>
        </thead>
        <tbody>
          {s.combTable.map((row) => (
            <tr key={row.label} className="border-b border-gray-800">
              <td className="py-1 text-left text-gray-300">{row.label}</td>
              <td className="py-1">{row.total}</td>
              <td className="py-1 text-green-400">{row.hit}</td>
              <td className={`py-1 font-bold ${row.rate >= 50 ? "text-yellow-400" : "text-white"}`}>{row.rate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800 rounded p-2">
      <div className="text-gray-400 text-xs">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}
