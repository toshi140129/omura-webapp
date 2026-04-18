import { Suspense } from "react";
import ResultsTable from "@/components/ResultsTable";
import PredictionCheck from "@/components/PredictionCheck";
import MartingaleCalc from "@/components/MartingaleCalc";
import StatsAnalysis from "@/components/StatsAnalysis";
import SeasonalAnalysis from "@/components/SeasonalAnalysis";
import ExtraConditions from "@/components/ExtraConditions";

export const revalidate = 3600;

export type RaceRow = {
  date: string;
  r10: { p1: string; p2: string; p3: string; pay: string };
  r11: { p1: string; p2: string; p3: string; pay: string };
  r12: { p1: string; p2: string; p3: string; pay: string };
};

async function fetchCSV(): Promise<RaceRow[]> {
  const url =
    "https://raw.githubusercontent.com/toshi140129/omura-boatrace/master/omura_results.csv";
  const res = await fetch(url, { next: { revalidate: 3600 } });
  const text = await res.text();
  const lines = text.trim().split("\n").slice(1);
  return lines
    .filter((l) => l.trim())
    .map((line) => {
      const cols = line.split(",");
      return {
        date: cols[0],
        r10: { p1: cols[1], p2: cols[2], p3: cols[3], pay: cols[4] },
        r11: { p1: cols[5], p2: cols[6], p3: cols[7], pay: cols[8] },
        r12: { p1: cols[9], p2: cols[10], p3: cols[11], pay: cols[12] },
      };
    })
    .reverse();
}

export default async function Home() {
  const data = await fetchCSV();
  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-center mb-6 text-yellow-400">
        大村ボートレース 予測システム
      </h1>
      <Suspense fallback={<div>読み込み中...</div>}>
        <PredictionCheck data={data} />
        <MartingaleCalc />
        <StatsAnalysis data={data} />
        <SeasonalAnalysis data={data} />
        <ExtraConditions data={data} />
        <ResultsTable data={data} />
      </Suspense>
    </main>
  );
}
