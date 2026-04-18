"use client";
import type { RaceRow } from "@/app/page";

export default function PredictionCheck({ data }: { data: RaceRow[] }) {
  const latest = data[0];
  if (!latest) return null;

  const cond1 = latest.r11.p1 === "1";
  const cond2 = !(
    latest.r10.p1 === latest.r11.p1 &&
    latest.r10.p2 === latest.r11.p2 &&
    latest.r10.p3 === latest.r11.p3
  );
  const cond3 = latest.r12.p1 === "1";
  const r11_23 = [latest.r11.p2, latest.r11.p3];
  const r12_23 = [latest.r12.p2, latest.r12.p3];
  const cond4 = r11_23.some((b) => r12_23.includes(b));
  const pay12 = parseInt(latest.r12.pay || "0");
  const cond5 = pay12 > 0 && pay12 < 4000;

  const hit = cond1 && cond2 && cond3 && cond4 && cond5;
  const active = cond1;

  return (
    <div className="mb-6 rounded-lg border border-gray-700 p-4">
      <h2 className="font-bold mb-3 text-lg">
        予測チェック{" "}
        <span className="text-sm text-gray-400">({latest.date})</span>
      </h2>
      {!active ? (
        <div className="text-gray-400">①未成立（11R 1着≠1号艇）</div>
      ) : (
        <>
          <div className="space-y-1 text-sm mb-3">
            <Cond ok={cond1} label="① 11R 1着=1号艇" />
            <Cond ok={cond2} label="② 10R・11Rの3着順が不一致" />
            <Cond ok={cond3} label="③ 12R 1着=1号艇" />
            <Cond ok={cond4} label="④ 11R 2・3着が12R 2・3着に絡む" />
            <Cond ok={cond5} label={`⑤ 12R 3連単40倍未満（${pay12}円）`} />
          </div>
          <div
            className={`text-center font-bold py-2 rounded ${
              hit
                ? "bg-green-600 text-white"
                : "bg-gray-700 text-gray-300"
            }`}
          >
            {hit ? "✅ 的中条件成立！" : "❌ 未成立"}
          </div>
        </>
      )}
    </div>
  );
}

function Cond({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={ok ? "text-green-400" : "text-red-400"}>
      {ok ? "✅" : "❌"} {label}
    </div>
  );
}
