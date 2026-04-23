import ResultsTable from "@/components/ResultsTable";
import PredictionCheck from "@/components/PredictionCheck";
import MartingaleCalc from "@/components/MartingaleCalc";
import StatsAnalysis from "@/components/StatsAnalysis";
import SeasonalAnalysis from "@/components/SeasonalAnalysis";
import ExtraConditions from "@/components/ExtraConditions";
import NextDayTrend from "@/components/NextDayTrend";
import PopularityTrend from "@/components/PopularityTrend";
import WeatherTrend from "@/components/WeatherTrend";

export const revalidate = 3600;

export type RaceData = {
  p1: string;
  p2: string;
  p3: string;
  pay: string;
  rank: string;
  wind: string;
  wdir: string;
  wave: string;
};

export type RaceRow = {
  date: string;
  r10: RaceData;
  r11: RaceData;
  r12: RaceData;
};

async function fetchCSV(): Promise<RaceRow[]> {
  const url =
    "https://raw.githubusercontent.com/toshi140129/omura-boatrace/master/omura_results.csv";
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error(`CSV fetch failed: ${res.status} ${res.statusText}`);
      return [];
    }
    const text = await res.text();
    const lines = text.trim().split("\n").slice(1);
    return lines
      .filter((l) => l.trim())
      .map((line) => {
        const cols = line.split(",");
        return {
          date: cols[0],
          r10: {
            p1: cols[1], p2: cols[2], p3: cols[3], pay: cols[4],
            rank: cols[13] ?? "",
            wind: cols[16] ?? "", wdir: cols[17] ?? "", wave: cols[18] ?? "",
          },
          r11: {
            p1: cols[5], p2: cols[6], p3: cols[7], pay: cols[8],
            rank: cols[14] ?? "",
            wind: cols[19] ?? "", wdir: cols[20] ?? "", wave: cols[21] ?? "",
          },
          r12: {
            p1: cols[9], p2: cols[10], p3: cols[11], pay: cols[12],
            rank: cols[15] ?? "",
            wind: cols[22] ?? "", wdir: cols[23] ?? "", wave: cols[24] ?? "",
          },
        };
      })
      .reverse();
  } catch (err) {
    console.error("CSV fetch error:", err);
    return [];
  }
}

export default async function Home() {
  const data = await fetchCSV();

  if (data.length === 0) {
    return (
      <main className="min-h-screen bg-gray-900 text-white p-4 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-center mb-6 text-yellow-400">
          大村ボートレース 予測システム
        </h1>
        <div className="rounded-lg border border-red-700 bg-red-900/30 p-4 text-center">
          <p className="font-bold mb-2">データを取得できませんでした</p>
          <p className="text-sm text-gray-300">
            時間をおいて再度アクセスしてください。
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-center mb-6 text-yellow-400">
        大村ボートレース 予測システム
      </h1>
      <PredictionCheck data={data} />
      <MartingaleCalc />
      <StatsAnalysis data={data} />
      <SeasonalAnalysis data={data} />
      <ExtraConditions data={data} />
      <NextDayTrend data={data} />
      <PopularityTrend data={data} />
      <WeatherTrend data={data} />
      <ResultsTable data={data} />
    </main>
  );
}
