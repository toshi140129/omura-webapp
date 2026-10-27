/**
 * 12Rメイン理論の「見送りサイン」。
 * 追加データ分析（2026-10-22、①②成立549日・1万円固定）で、前半(2023-24)と後半(2025-26)の
 * 両方で同じ向きに出た条件だけを有効にしている。条件を足すときは SKIP_RULES に1件追加するだけでよい。
 * 2026-10-27: 「曇り」を追加（1番人気1点・2万定額 322日の検証）。見送りとは別に「追い風サイン」（BOOST_RULES）も返す。
 */
import type { RaceInfo } from "./boatrace";

export type SignStatus = "skip" | "ok" | "pending";

export type SignResult = {
  id: string;
  label: string;
  /** 判定に使うデータが出るタイミング */
  stage: "出走表" | "直前情報";
  status: SignStatus;
  /** 判定の根拠（例: 「1号艇 5.80 − 最高 7.10 = −1.30」） */
  detail: string;
  /** 分析で見えた差（該当日 / それ以外） */
  evidence: string;
};

export type SkipRule = {
  id: string;
  label: string;
  stage: "出走表" | "直前情報";
  evidence: string;
  /** false のものは候補どまり（画面に出さない） */
  enabled: boolean;
  evaluate: (info: RaceInfo) => { status: SignStatus; detail: string };
};

const fmt = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? "-" : v.toFixed(d));

export const SKIP_RULES: SkipRule[] = [
  {
    id: "winrate_gap",
    label: "1号艇の勝率が他艇より1.0以上低い",
    stage: "出走表",
    evidence: "該当94日: 的中37%・回収率75%（それ以外 59%・90%）",
    enabled: true,
    evaluate: (info) => {
      const b1 = info.boats.find((b) => b.waku === "1");
      const others = info.boats.filter((b) => b.waku !== "1" && b.winRate !== null);
      if (!b1 || b1.winRate === null || others.length === 0) {
        return { status: "pending", detail: "出走表が未発表" };
      }
      const best = Math.max(...others.map((b) => b.winRate as number));
      const bestBoat = others.find((b) => b.winRate === best);
      const gap = b1.winRate - best;
      const detail = `1号艇 ${fmt(b1.winRate)} − 最高 ${fmt(best)}（${bestBoat?.waku}号艇）= ${gap >= 0 ? "+" : ""}${fmt(gap)}`;
      return { status: gap <= -1.0 ? "skip" : "ok", detail };
    },
  },
  {
    id: "exhibition_rank",
    label: "1号艇の展示タイムが4位以下",
    stage: "直前情報",
    evidence: "該当130日: 的中47%・回収率80%（それ以外 58%・90%）",
    enabled: true,
    evaluate: (info) => {
      const times = info.boats
        .filter((b) => b.exhibitionTime !== null)
        .map((b) => ({ waku: b.waku, t: b.exhibitionTime as number }));
      const b1 = times.find((x) => x.waku === "1");
      if (times.length < 6 || !b1) {
        return { status: "pending", detail: "直前情報（展示タイム）待ち" };
      }
      const rank = 1 + times.filter((x) => x.t < b1.t).length;
      const fastest = times.reduce((a, b) => (b.t < a.t ? b : a));
      const detail = `1号艇 ${fmt(b1.t)} は6艇中${rank}位（最速 ${fastest.waku}号艇 ${fmt(fastest.t)}）`;
      return { status: rank >= 4 ? "skip" : "ok", detail };
    },
  },
  {
    id: "rain",
    label: "12Rが雨",
    stage: "直前情報",
    evidence: "該当66日: 的中42%・回収率66%（それ以外 57%・90%）",
    enabled: true,
    evaluate: (info) => {
      if (!info.weather || !info.weather.weather) {
        return { status: "pending", detail: "直前情報（天候）待ち" };
      }
      const w = info.weather;
      const extra = [w.wind ? `風 ${w.wind}m` : "", w.wave ? `波 ${w.wave}cm` : ""].filter(Boolean).join(" / ");
      const detail = `${w.weather}${extra ? `（${extra}）` : ""}${info.beforeInfoAvailable ? "" : " ※前のレース時点"}`;
      return { status: w.weather.includes("雨") ? "skip" : "ok", detail };
    },
  },
  {
    id: "cloudy",
    label: "12Rが曇り",
    stage: "直前情報",
    evidence: "該当101日: 1番人気的中9.9%・回収率63%（晴 20.9%・136%、2023〜26年すべて同じ向き）",
    enabled: true,
    evaluate: (info) => {
      if (!info.weather || !info.weather.weather) {
        return { status: "pending", detail: "直前情報（天候）待ち" };
      }
      const w = info.weather.weather;
      const detail = `${w}${info.beforeInfoAvailable ? "" : " ※前のレース時点"}`;
      return { status: w.includes("曇") ? "skip" : "ok", detail };
    },
  },
  {
    id: "other_tilt",
    label: "1号艇以外にチルト0.5以上の艇がいる",
    stage: "直前情報",
    evidence: "該当81日: 的中12%・回収率87%（それ以外 19%・121%、2023〜26年すべて同じ向き）",
    enabled: true,
    evaluate: (info) => {
      const tilts = info.boats.filter((b) => b.tilt !== null).map((b) => ({ waku: b.waku, t: b.tilt as number }));
      if (tilts.length < 5) {
        return { status: "pending", detail: "直前情報（チルト）待ち" };
      }
      const up = tilts.filter((x) => x.waku !== "1" && x.t >= 0.5);
      const detail = tilts.map((x) => `${x.waku}号${x.t >= 0 ? "+" : ""}${x.t.toFixed(1)}`).join(" ");
      return {
        status: up.length ? "skip" : "ok",
        detail: up.length ? `${detail}（${up.map((x) => x.waku).join("・")}号艇が0.5以上）` : detail,
      };
    },
  },
  {
    id: "boat1_tilt",
    label: "1号艇のチルトが0.5以上",
    stage: "直前情報",
    evidence: "該当17日: 的中1回・回収率31%（日数が少ないので候補扱い）",
    enabled: true,
    evaluate: (info) => {
      const b1 = info.boats.find((b) => b.waku === "1");
      if (!b1 || b1.tilt === null) {
        return { status: "pending", detail: "直前情報（チルト）待ち" };
      }
      return { status: b1.tilt >= 0.5 ? "skip" : "ok", detail: `1号艇 ${b1.tilt >= 0 ? "+" : ""}${b1.tilt.toFixed(1)}` };
    },
  },
  {
    id: "start_exhibition",
    label: "スタート展示の進入が枠なりでない",
    stage: "直前情報",
    evidence: "該当17日: 的中1回・回収率35%（日数が少ないので候補扱い）",
    enabled: true,
    evaluate: (info) => {
      const order = info.startExhibition;
      if (!order || order.length < 5) {
        return { status: "pending", detail: "直前情報（スタート展示）待ち" };
      }
      const wakunari = order.every((w, i) => w === String(i + 1));
      return { status: wakunari ? "ok" : "skip", detail: order.join("-") + (wakunari ? "（枠なり）" : "（枠なりでない）") };
    },
  },
  {
    // 候補（別スレッド「選手別の的中傾向」で検出。採用は未決定なので画面には出さない）
    id: "local_gap",
    label: "1号艇の当地勝率が全国勝率より0.5以上低い",
    stage: "出走表",
    evidence: "候補",
    enabled: false,
    evaluate: (info) => {
      const b1 = info.boats.find((b) => b.waku === "1");
      if (!b1 || b1.winRate === null || b1.localWinRate === null) {
        return { status: "pending", detail: "出走表が未発表" };
      }
      const gap = b1.localWinRate - b1.winRate;
      return {
        status: gap <= -0.5 ? "skip" : "ok",
        detail: `当地 ${fmt(b1.localWinRate)} − 全国 ${fmt(b1.winRate)} = ${gap >= 0 ? "+" : ""}${fmt(gap)}`,
      };
    },
  },
];

/** 追い風サイン: 見送りではなく「この日の1号艇は強い」という後押し（2026-10-27 検証、1番人気1点・2万定額） */
export type BoostResult = {
  id: string;
  label: string;
  active: boolean;
  detail: string;
  evidence: string;
};

export const BOOST_RULES: { id: string; label: string; evidence: string; evaluate: (info: RaceInfo) => { active: boolean; detail: string } }[] = [
  {
    id: "local_branch",
    label: "1号艇が地元・長崎支部",
    evidence: "該当55日: 的中23.6%・回収率160%（それ以外 16.1%・103%、前半162%・後半158%）",
    evaluate: (info) => {
      const b1 = info.boats.find((b) => b.waku === "1");
      if (!b1) return { active: false, detail: "出走表が未発表" };
      if (!b1.branch) return { active: false, detail: "支部を読めず" };
      return { active: b1.branch === "長崎", detail: `1号艇 ${b1.name} は${b1.branch}支部` };
    },
  },
  {
    id: "b_class",
    label: "1号艇がB級（見送らない）",
    evidence: "B1 20日: 的中30%・回収率228%（A1 241日は15%・98%）。的中は低いがオッズが高く、見送ると損",
    evaluate: (info) => {
      const b1 = info.boats.find((b) => b.waku === "1");
      if (!b1) return { active: false, detail: "出走表が未発表" };
      if (!b1.klass) return { active: false, detail: "級別を読めず" };
      return { active: b1.klass.startsWith("B"), detail: `1号艇 ${b1.name} は ${b1.klass}` };
    },
  },
];

export function evaluateBoosts(info: RaceInfo): BoostResult[] {
  return BOOST_RULES.map((r) => {
    const { active, detail } = r.evaluate(info);
    return { id: r.id, label: r.label, active, detail, evidence: r.evidence };
  });
}

export function evaluateSigns(info: RaceInfo): SignResult[] {
  return SKIP_RULES.filter((r) => r.enabled).map((r) => {
    const { status, detail } = r.evaluate(info);
    return { id: r.id, label: r.label, stage: r.stage, status, detail, evidence: r.evidence };
  });
}

export type Verdict = "skip" | "go" | "pending";

export function overallVerdict(signs: SignResult[]): Verdict {
  if (signs.some((s) => s.status === "skip")) return "skip";
  if (signs.every((s) => s.status === "ok")) return "go";
  return "pending";
}
