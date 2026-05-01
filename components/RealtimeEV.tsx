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
      <div className="mb-6 rounded-lg border border-gray-700 p-4">
        <h2 className="font-bold text-lg mb-2 text-yellow-400">
          本日のリアルタイム期待値
        </h2>
        <p className="text-xs text-gray-500">
          11R終了後に自動更新されます。
        </p>
      </div>
    );
  }

  const isToday = data.date === todayJST();
  const evPlus = (data.patterns ?? []).filter((p) => p.ev >= 100);
  const evList = data.patterns ?? [];

  return (
    <div
      className={`mb-6 rounded-lg border p-4 ${
        isToday && evPlus.length > 0
          ? "border-yellow-500 bg-yellow-900/10"
          : "border-gray-700"
      }`}
    >
      <h2 className="font-bold text-lg mb-2 text-yellow-400">
        本日のリアルタイム期待値
      </h2>

      <div className="text-xs text-gray-400 mb-3 space-y-0.5">
        <div>
          <span className="text-gray-500">対象日:</span> {data.date}
          {isToday ? "" : "（本日未更新）"}
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
        <div className="space-y-1">
          <div className="text-xs text-gray-400 mb-1">
            ▼ 期待値TOP（黄=EV+ 100%以上）
          </div>
          {evList.slice(0, 10).map((p) => {
            const evPlusFlag = p.ev >= 100;
            return (
              <div
                key={p.pattern}
                className={`rounded p-2 text-xs flex items-center justify-between gap-2 ${
                  evPlusFlag ? "bg-yellow-900/30" : "bg-gray-800"
                }`}
              >
                <span className="font-bold tabular-nums">{p.pattern}</span>
                <span
                  className={`font-bold tabular-nums ${
                    evPlusFlag ? "text-yellow-400" : "text-gray-400"
                  }`}
                >
                  EV {Math.round(p.ev)}%
                </span>
                <span className="text-gray-400 tabular-nums">
                  的中 {(p.prob * 100).toFixed(1)}%
                </span>
                <span className="text-gray-400 tabular-nums">
                  平均 {Math.round(p.avg_pay)}円
                </span>
                <span className="text-gray-500 tabular-nums">
                  {p.hit}/{p.total}
                </span>
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
