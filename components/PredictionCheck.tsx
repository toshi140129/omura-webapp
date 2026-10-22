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
  const A = latest.r11.p2;
  const B = latest.r11.p3;

  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
        <RaceBox label="10R" race={latest.r10} />
        <RaceBox label="11R" race={latest.r11} highlight={cond1} />
        <RaceBox label="12R" race={latest.r12} highlight={hit} />
      </div>

      {!active ? (
        <div className="rounded-lg bg-gray-800 px-3 py-3 text-center text-sm text-gray-400">
          ①未成立（11R 1着≠1号艇）のため見送り日
        </div>
      ) : (
        <>
          <div
            className={`mb-3 rounded-lg py-3 text-center text-lg font-bold ${
              hit ? "bg-green-600 text-white" : "bg-gray-700 text-gray-300"
            }`}
          >
            {hit ? "✅ 的中条件成立" : "❌ 未成立"}
          </div>
          <div className="mb-3 rounded-lg bg-gray-800 p-3 text-sm">
            <div className="mb-1 text-xs text-gray-400">
              この日の買い目（11R 2着=
              <span className="font-bold text-white">{A}</span>・3着=
              <span className="font-bold text-white">{B}</span>）
            </div>
            <div className="grid grid-cols-2 gap-1 text-center font-bold tabular-nums">
              <span className="rounded bg-gray-700 py-1.5">1-{A}-全</span>
              <span className="rounded bg-gray-700 py-1.5">1-{B}-全</span>
              <span className="rounded bg-gray-700 py-1.5">1-全-{A}</span>
              <span className="rounded bg-gray-700 py-1.5">1-全-{B}</span>
            </div>
            <div className="mt-1 text-[11px] text-gray-500">
              このうち3連単40倍未満を資金配分で購入
            </div>
          </div>
          <div className="space-y-1.5 text-sm">
            <Cond ok={cond1} label="① 11R 1着=1号艇" />
            <Cond ok={cond2} label="② 10R・11Rの3着順が不一致" />
            <Cond ok={cond3} label="③ 12R 1着=1号艇" />
            <Cond ok={cond4} label="④ 11R 2・3着が12R 2・3着に絡む" />
            <Cond
              ok={cond5}
              label={`⑤ 12R 3連単40倍未満（${pay12.toLocaleString()}円）`}
            />
          </div>
        </>
      )}
    </div>
  );
}

function RaceBox({
  label,
  race,
  highlight,
}: {
  label: string;
  race: RaceRow["r10"];
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-2 ${
        highlight ? "bg-green-900/40 ring-1 ring-green-500" : "bg-gray-800"
      }`}
    >
      <div className="text-gray-400">{label}</div>
      <div className="text-base font-bold tabular-nums">
        {race.p1}-{race.p2}-{race.p3}
      </div>
      <div className="text-yellow-400 tabular-nums">
        {race.pay ? `${parseInt(race.pay).toLocaleString()}円` : "-"}
      </div>
    </div>
  );
}

function Cond({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-2 rounded px-2 py-1.5 ${
        ok ? "bg-green-900/20 text-green-300" : "bg-red-900/20 text-red-300"
      }`}
    >
      <span>{ok ? "✅" : "❌"}</span>
      <span>{label}</span>
    </div>
  );
}
