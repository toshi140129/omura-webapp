"use client";
import type { RaceRow } from "@/app/page";

function isHit(r: RaceRow) {
  const c1 = r.r11.p1 === "1";
  const c3 = r.r12.p1 === "1";
  const c4 = [r.r11.p2, r.r11.p3].some((b) => [r.r12.p2, r.r12.p3].includes(b));
  const pay = parseInt(r.r12.pay || "0");
  return c1 && c3 && c4 && pay > 0 && pay < 4000;
}

function rate(hits: number, total: number) {
  return total ? Math.round((hits / total) * 100) : 0;
}

export default function ExtraConditions({ data }: { data: RaceRow[] }) {
  // 10R払戻帯別の12R的中率
  const payBands = [
    { label: "10R低配当(~1000)", filter: (r: RaceRow) => parseInt(r.r10.pay || "0") > 0 && parseInt(r.r10.pay || "0") < 1000 },
    { label: "10R中配当(1000~5000)", filter: (r: RaceRow) => { const p = parseInt(r.r10.pay || "0"); return p >= 1000 && p < 5000; } },
    { label: "10R高配当(5000~)", filter: (r: RaceRow) => parseInt(r.r10.pay || "0") >= 5000 },
  ];

  const payBandStats = payBands.map(({ label, filter }) => {
    const rows = data.filter(filter);
    const hits = rows.filter(isHit);
    return { label, total: rows.length, hit: hits.length, rate: rate(hits.length, rows.length) };
  });

  // 1号艇連続1着（10R・11R・12Rすべて1着）
  const all1st = data.filter((r) => r.r10.p1 === "1" && r.r11.p1 === "1" && r.r12.p1 === "1");
  const consec_rate = rate(all1st.length, data.length);

  // 高配当（10000円以上）が出る条件
  const highPay = data.filter((r) => parseInt(r.r12.pay || "0") >= 10000);
  const highPayConds = [
    {
      label: "11R 1着≠1号艇",
      count: highPay.filter((r) => r.r11.p1 !== "1").length,
    },
    {
      label: "10R 1着≠1号艇",
      count: highPay.filter((r) => r.r10.p1 !== "1").length,
    },
    {
      label: "11R払戻5000円以上",
      count: highPay.filter((r) => parseInt(r.r11.pay || "0") >= 5000).length,
    },
    {
      label: "10R払戻5000円以上",
      count: highPay.filter((r) => parseInt(r.r10.pay || "0") >= 5000).length,
    },
  ];

  return (
    <div className="mb-6 rounded-lg border border-gray-700 p-4">
      <h2 className="font-bold mb-3 text-lg">追加条件探索</h2>

      <h3 className="text-sm font-bold text-gray-400 mb-2">10R払戻帯別の12R的中率</h3>
      <div className="space-y-1 mb-4">
        {payBandStats.map((s) => (
          <div key={s.label} className="flex justify-between text-xs bg-gray-800 rounded p-2">
            <span className="text-gray-300">{s.label}</span>
            <span className={`font-bold ${s.rate >= 50 ? "text-yellow-400" : "text-white"}`}>
              {s.rate}% ({s.hit}/{s.total})
            </span>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-bold text-gray-400 mb-2">1号艇3連続1着の頻度</h3>
      <div className="bg-gray-800 rounded p-2 text-sm mb-4">
        <span className="text-gray-300">10R・11R・12Rすべて1号艇1着：</span>
        <span className="font-bold text-yellow-400 ml-2">
          {all1st.length}日 ({consec_rate}%)
        </span>
      </div>

      <h3 className="text-sm font-bold text-gray-400 mb-2">12R高配当(10000円以上)が出る条件</h3>
      <div className="text-xs text-gray-400 mb-1">高配当日数：{highPay.length}日</div>
      <div className="space-y-1">
        {highPayConds.map((c) => (
          <div key={c.label} className="flex justify-between text-xs bg-gray-800 rounded p-2">
            <span className="text-gray-300">{c.label}</span>
            <span className="font-bold text-red-400">
              {c.count}日 ({highPay.length ? Math.round((c.count / highPay.length) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
