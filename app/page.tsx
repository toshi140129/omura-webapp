import ResultsTable from "@/components/ResultsTable";
import PredictionCheck from "@/components/PredictionCheck";
import MartingaleCalc from "@/components/MartingaleCalc";
import StatsAnalysis from "@/components/StatsAnalysis";
import SeasonalAnalysis from "@/components/SeasonalAnalysis";
import ExtraConditions from "@/components/ExtraConditions";
import NextDayTrend from "@/components/NextDayTrend";
import PopularityTrend from "@/components/PopularityTrend";
import WeatherTrend from "@/components/WeatherTrend";
import WeatherDetailTrend from "@/components/WeatherDetailTrend";
import ComboRanking from "@/components/ComboRanking";
import RealtimeEV from "@/components/RealtimeEV";
import TodaySigns from "@/components/TodaySigns";
import VerificationSummary from "@/components/VerificationSummary";
import FlatBetSimulator from "@/components/FlatBetSimulator";
import AppShell from "@/components/ui/AppShell";
import Section from "@/components/ui/Section";

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
  seriesDay: string;
  eventType: string;
  weather: string;
  airTemp: string;
  waterTemp: string;
  stabilizer: string;
  tideLevel: string;
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
          seriesDay: (cols[25] ?? "").trim(),
          eventType: (cols[26] ?? "").trim(),
          weather: (cols[27] ?? "").trim(),
          airTemp: (cols[28] ?? "").trim(),
          waterTemp: (cols[29] ?? "").trim(),
          stabilizer: (cols[30] ?? "").trim(),
          tideLevel: (cols[31] ?? "").trim(),
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

  const latest = data[0];

  const today = (
    <>
      <Section
        id="signs"
        title="12R 見送りサイン"
        summary="出走表と直前情報から、負けやすい日を3条件で判定"
        defaultOpen
        accent="yellow"
      >
        <TodaySigns />
      </Section>
      <Section
        id="realtime"
        title="本日のリアルタイム期待値"
        summary="11R終了後に自動更新。EV 100%以上は黄色"
        defaultOpen
        accent="yellow"
      >
        <RealtimeEV />
      </Section>
      <Section
        id="check"
        title="予測チェック"
        summary={`最新データ日 ${latest.date} の5条件と買い目`}
        defaultOpen
        accent="yellow"
      >
        <PredictionCheck data={data} />
      </Section>
      <Section
        id="martingale"
        title="マーチンゲール計算"
        summary="次回賭け金を2つの式で比較"
        defaultOpen
      >
        <MartingaleCalc />
      </Section>
      <Section
        id="verification"
        title="資金配分の検証結果（要約）"
        summary="2023-01〜2026-10 の収支検証。固定値"
      >
        <VerificationSummary />
      </Section>
    </>
  );

  const analysis = (
    <>
      <Section
        id="flatbet"
        title="定額買いの収支シミュレーター"
        summary="12R 1番人気1点を定額で買い続けた累計収支・年別/月別・最大連敗"
        defaultOpen
        accent="yellow"
      >
        <FlatBetSimulator />
      </Section>
      <Section id="stats" title="確率分析" summary="5条件の成立率と組み合わせ別的中率" defaultOpen>
        <StatsAnalysis data={data} />
      </Section>
      <Section id="seasonal" title="季節・時期別分析" summary="季節・月・曜日・節内日数・開催種別">
        <SeasonalAnalysis data={data} />
      </Section>
      <Section id="extra" title="追加条件探索" summary="10R払戻帯・1号艇3連続・高配当条件">
        <ExtraConditions data={data} />
      </Section>
      <Section id="nextday" title="同日12Rの1着傾向（11R勝者別）" summary="11Rの勝ち艇ごとの12R 1着分布">
        <NextDayTrend data={data} />
      </Section>
      <Section id="popularity" title="同日12Rの人気順傾向（11R人気順別）" summary="11Rの決着人気ごとの12R人気分布">
        <PopularityTrend data={data} />
      </Section>
      <Section id="weather" title="気象条件別の1着傾向" summary="風速・波高・風向・天気別">
        <WeatherTrend data={data} />
      </Section>
      <Section id="weather-detail" title="気象詳細・潮汐別の12R 1着号艇傾向" summary="気温・水温・安定板・潮位別">
        <WeatherDetailTrend data={data} />
      </Section>
      <Section id="combo" title="条件組合せランキング" summary="人気上位4点買いの条件別回収率">
        <ComboRanking data={data} />
      </Section>
    </>
  );

  const history = (
    <Section id="results" title="過去結果" summary={`${data.length}日分。①成立日・的中日で絞り込み可`} defaultOpen>
      <ResultsTable data={data} />
    </Section>
  );

  return (
    <AppShell
      lastDate={latest.date}
      totalDays={data.length}
      today={today}
      analysis={analysis}
      history={history}
    />
  );
}
