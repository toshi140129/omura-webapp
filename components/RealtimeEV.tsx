type EVPattern = {
  pattern: string;
  hit: number;
  total: number;
  prob: number;
  avg_pay: number;
  ev: number;
};

type RealtimePayload = {
  date: string;
  fetched_at: string;
  r11: { p1: string; p2: string; p3: string; pay: string };
  r12_weather: {
    wind: string;
    wdir: string;
    wave: string;
    weather?: string;
    air_temp?: string;
    water_temp?: string;
  };
  series_day: string;
  event_type: string;
  matched_samples: number;
  applied_filters: [string, string][];
  patterns: EVPattern[];
};

const REALTIME_URL =
  "https://raw.githubusercontent.com/toshi140129/omura-boatrace/master/realtime_ev.json";

async function fetchRealtimeEV(): Promise<RealtimePayload | null> {
  try {
    const res = await fetch(REALTIME_URL, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as RealtimePayload;
  } catch {
    return null;
  }
}

function todayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

const FILTER_LABELS: Record<string, string> = {
  r11_p1: "11R1着",
  event_type: "開催",
  weather: "天気",
  wind_b: "風速",
  wave_b: "波高",
  series_day: "節日数",
  r12_wdir: "風向",
};

export default async function RealtimeEV() {
  const data = await fetchRealtimeEV();

  if (!data) {
    return (
      <p className="text-sm text-gray-400">
        まだ本日分のデータがありません。11R終了後に自動更新されます。
      </p>
    );
  }

  const isToday = data.date === todayJST();
  const evPlus = (data.patterns ?? []).filter((p) => p.ev >= 100);
  const evList = data.patterns ?? [];

  return (
    <div>
      {isToday && evPlus.length > 0 && (
        <div className="mb-3 rounded-lg bg-yellow-500 px-3 py-2 text-center text-sm font-bold text-black">
          本日 EV+ の買い目が {evPlus.length} 点あります
        </div>
      )}
      {!isToday && (
        <div className="mb-3 rounded-lg bg-gray-800 px-3 py-2 text-center text-xs text-gray-400">
          本日分は未更新です（表示は {data.date} のもの）
        </div>
      )}

      <div className="mb-3 space-y-1 rounded-lg bg-gray-800/60 p-3 text-xs text-gray-400">
        <div>
          <span className="text-gray-500">対象日:</span> {data.date}
        </div>
        <div>
          <span className="text-gray-500">11R結果:</span>{" "}
          <span className="font-bold text-white">
            {data.r11.p1}-{data.r11.p2}-{data.r11.p3}
          </span>
          <span className="text-gray-500"> 払戻 {data.r11.pay}円</span>
        </div>
        <div>
          <span className="text-gray-500">12R天気:</span>{" "}
          <span className="font-bold text-white">
            {data.r12_weather.weather ?? "?"}
          </span>
          <span className="text-gray-500">
            {" "}/ 風 {data.r12_weather.wind}m / 波 {data.r12_weather.wave}cm / 風向 {data.r12_weather.wdir}
            {data.r12_weather.air_temp ? ` / 気温 ${data.r12_weather.air_temp}℃` : ""}
            {data.r12_weather.water_temp ? ` / 水温 ${data.r12_weather.water_temp}℃` : ""}
          </span>
        </div>
        <div>
          <span className="text-gray-500">開催:</span> {data.event_type} {data.series_day}日目 / 類似サンプル {data.matched_samples}日
        </div>
        {data.applied_filters?.length > 0 && (
          <div>
            <span className="text-gray-500">適用条件:</span>{" "}
            {data.applied_filters
              .map(([k, v]) => `${FILTER_LABELS[k] ?? k}=${v}`)
              .join(" / ")}
          </div>
        )}
        <div>
          <span className="text-gray-500">更新:</span>{" "}
          {data.fetched_at?.slice(11, 16) ?? "-"}
        </div>
      </div>

      {evList.length === 0 ? (
        <p className="text-xs text-gray-500">
          類似条件のサンプルが不足しています
        </p>
      ) : (
        <div className="space-y-1.5">
          <div className="mb-1 text-xs text-gray-400">
            期待値TOP10（黄＝EV 100%以上）
          </div>
          {evList.slice(0, 10).map((p) => {
            const evPlusFlag = p.ev >= 100;
            return (
              <div
                key={p.pattern}
                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${
                  evPlusFlag
                    ? "bg-yellow-900/30 ring-1 ring-yellow-700"
                    : "bg-gray-800"
                }`}
              >
                <div>
                  <div className="text-base font-bold tabular-nums">{p.pattern}</div>
                  <div className="text-[11px] text-gray-400 tabular-nums">
                    的中 {(p.prob * 100).toFixed(1)}% / 平均 {Math.round(p.avg_pay).toLocaleString()}円 / {p.hit}/{p.total}
                  </div>
                </div>
                <div
                  className={`text-right text-lg font-bold tabular-nums ${
                    evPlusFlag ? "text-yellow-400" : "text-gray-400"
                  }`}
                >
                  {Math.round(p.ev)}%
                  <div className="text-[10px] font-normal text-gray-500">EV</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-gray-600 mt-2">
        ※1点100円換算。omura_realtime.py(タスクスケジューラ)が更新。
      </p>
    </div>
  );
}
