/**
 * boatrace.jp（大村 jcd=24）の出走表・直前情報を取得して、見送りサインに必要な項目だけ取り出す。
 * 外部ライブラリなしで動くように、HTMLは正規表現で読む。
 * HTML構造は omura-boatrace/omura_extra_fetch.py（PCで実データ検証済み）と同じ前提:
 *   出走表  tbody.is-fs12 の1行目 td: 0=枠, 1=写真, 2=登録番号/級別/選手名, 3=F/L/平均ST, 4=全国, 5=当地, 6=モーター, 7=ボート
 *   直前情報 tbody.is-fs12 の1行目 td: 0=枠, 1=写真, 2=選手名, 3=体重, 4=展示タイム, 5=チルト
 */

export const JCD = "24";
const BASE = "https://www.boatrace.jp/owpc/pc/race/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
/** boatrace.jp への問い合わせをキャッシュする秒数 */
export const REVALIDATE_SEC = 300;

export type Boat = {
  waku: string;
  name: string;
  klass: string; // A1/A2/B1/B2
  winRate: number | null; // 全国勝率
  localWinRate: number | null; // 当地勝率
  avgST: number | null;
  exhibitionTime: number | null; // 展示タイム（直前情報が出るまで null）
  tilt: number | null; // チルト角（直前情報が出るまで null）
};

export type Weather = {
  weather: string; // 晴/曇り/雨 など
  wind: string; // m
  wave: string; // cm
};

export type RaceInfo = {
  date: string; // YYYY-MM-DD
  rno: number;
  raceListAvailable: boolean;
  beforeInfoAvailable: boolean;
  raceType: string; // 予選/準優勝戦/優勝戦 など
  title: string; // 節名
  boats: Boat[];
  weather: Weather | null;
  /** スタート展示の進入順（コース1から艇番を並べたもの。未発表なら空） */
  startExhibition: string[];
};

export function todayJST(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function url(page: string, rno: number, hd: string): string {
  return `${BASE}${page}?rno=${rno}&jcd=${JCD}&hd=${hd}`;
}

async function fetchHtml(u: string): Promise<string> {
  try {
    const res = await fetch(u, {
      headers: { "User-Agent": UA },
      next: { revalidate: REVALIDATE_SEC },
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------- HTML ヘルパー
function nfkc(s: string): string {
  return s.normalize("NFKC").replace(/ /g, " ").trim();
}

/** タグを落として文字列にする。<br> は改行として残す */
function textOf(html: string): string {
  return nfkc(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/[ \t]+/g, " ")
      .replace(/\s*\n\s*/g, "\n"),
  );
}

function lines(html: string): string[] {
  return textOf(html)
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
}

function num(s: string | undefined, re = /-?\d+(?:\.\d+)?/): number | null {
  if (!s) return null;
  const m = nfkc(s).match(re);
  return m ? parseFloat(m[0]) : null;
}

function noData(html: string): boolean {
  return !html || html.includes("データがありません");
}

/** <tbody class="is-fs12"> ごとに、1行目の <td> の中身（HTML）を配列で返す */
function firstRowCells(html: string): string[][] {
  const out: string[][] = [];
  const tbodyRe = /<tbody[^>]*class="[^"]*\bis-fs12\b[^"]*"[^>]*>([\s\S]*?)<\/tbody>/g;
  let m: RegExpExecArray | null;
  while ((m = tbodyRe.exec(html)) !== null) {
    const tr = /<tr[^>]*>([\s\S]*?)<\/tr>/.exec(m[1]);
    if (!tr) continue;
    const cells: string[] = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let td: RegExpExecArray | null;
    while ((td = tdRe.exec(tr[1])) !== null) cells.push(td[1]);
    if (cells.length) out.push(cells);
  }
  return out;
}

// ---------------------------------------------------------------- 出走表
const RACE_TYPE_RE =
  /(優勝戦|準優勝戦|準優進出戦|順位決定戦|特別選抜[A-Z]?|予選特選|選抜|特選|予選|一般戦|一般|ドリーム戦|ドリーム|トライアル\d*|敗者戦|選抜戦|シード戦)/;

export function parseRaceList(html: string): {
  available: boolean;
  raceType: string;
  title: string;
  boats: Boat[];
} {
  if (noData(html)) return { available: false, raceType: "", title: "", boats: [] };
  let raceType = "";
  const h3 = /<h3[^>]*class="[^"]*title16_titleDetail__add2020[^"]*"[^>]*>([\s\S]*?)<\/h3>/.exec(html);
  if (h3) {
    const t = textOf(h3[1]).replace(/\d{4}m.*$/, "").trim();
    const r = RACE_TYPE_RE.exec(t);
    raceType = r ? r[1] : t;
  }
  let title = "";
  const h2 = /class="[^"]*heading2_titleName[^"]*"[^>]*>([\s\S]*?)<\/(?:h2|div|span|a)>/.exec(html);
  if (h2) title = textOf(h2[1]);

  const boats: Boat[] = [];
  for (const tds of firstRowCells(html)) {
    if (tds.length < 8) continue;
    const waku = (textOf(tds[0]).match(/\d/) ?? [""])[0];
    if (!waku) continue;
    const cellText = textOf(tds[2]).replace(/\n/g, " ");
    const kl = /\b([AB][12])\b/.exec(cellText);
    const a = /<a[^>]*>([\s\S]*?)<\/a>/.exec(tds[2]);
    const name = a ? textOf(a[1]).replace(/\s+/g, "") : "";
    const fl = lines(tds[3]);
    const st = fl.find((t) => /^\d\.\d{2}$/.test(t));
    const nat = lines(tds[4]).map((t) => num(t)).filter((v): v is number => v !== null);
    const loc = lines(tds[5]).map((t) => num(t)).filter((v): v is number => v !== null);
    boats.push({
      waku,
      name,
      klass: kl ? kl[1] : "",
      winRate: nat[0] ?? null,
      localWinRate: loc[0] ?? null,
      avgST: st ? parseFloat(st) : null,
      exhibitionTime: null,
      tilt: null,
    });
  }
  boats.sort((x, y) => x.waku.localeCompare(y.waku));
  return { available: boats.length >= 6, raceType, title, boats };
}

// ---------------------------------------------------------------- 直前情報
/** スタート展示の進入順（コース1から艇番）。omura_extra_fetch.py の parse_start_table と同じ前提で、
 *  「スタート展示」を含む table の中の艇番アイコン（table1_boatImage1Number）を順に拾う */
export function parseStartExhibition(html: string): string[] {
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/g;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(html)) !== null) {
    const body = m[1];
    if (!textOf(body).includes("スタート展示") && !/table1_boatImage1Number/.test(body)) continue;
    const order: string[] = [];
    const numRe = /table1_boatImage1Number[^>]*>\s*([1-6])\s*</g;
    let n: RegExpExecArray | null;
    while ((n = numRe.exec(body)) !== null) order.push(n[1]);
    if (order.length >= 5 && order.length <= 6) return order;
  }
  return [];
}

export function parseBeforeInfo(html: string): {
  available: boolean;
  exhibition: Record<string, number>;
  tilt: Record<string, number>;
  startExhibition: string[];
  weather: Weather | null;
} {
  if (noData(html)) return { available: false, exhibition: {}, tilt: {}, startExhibition: [], weather: null };
  const exhibition: Record<string, number> = {};
  const tilt: Record<string, number> = {};
  for (const tds of firstRowCells(html)) {
    if (tds.length < 6) continue;
    const waku = (textOf(tds[0]).match(/\d/) ?? [""])[0];
    const t = num(textOf(tds[4]), /\d\.\d{2}/);
    if (waku && t !== null) exhibition[waku] = t;
    const tl = num(textOf(tds[5]), /-?\d+(?:\.\d+)?/);
    if (waku && tl !== null) tilt[waku] = tl;
  }
  const startExhibition = parseStartExhibition(html);

  let weather: Weather | null = null;
  // class 名は "weather1" そのもの（"is-weather1" や "weather1_body" は除く）
  const w1 = /<div[^>]*class="(?:[^"]*\s)?weather1(?:\s[^"]*)?"[^>]*>([\s\S]*?)(?:<div[^>]*class="(?:[^"]*\s)?weather2(?:\s[^"]*)?"|<\/section>|$)/.exec(html);
  if (w1) {
    const block = w1[1];
    const pick = (unit: RegExp, label: "Title" | "Data"): string => {
      const i = block.search(unit);
      if (i < 0) return "";
      const rest = block.slice(i);
      const m = new RegExp(`weather1_bodyUnitLabel${label}[^>]*>([\\s\\S]*?)<`).exec(rest);
      return m ? textOf(m[1]) : "";
    };
    const weatherText = pick(/is-weather\b/, "Title");
    const wind = pick(/is-wind["\s]/, "Data");
    const wave = pick(/is-wave\b/, "Data");
    if (weatherText || wind || wave) {
      weather = {
        weather: weatherText,
        wind: (wind.match(/\d+/) ?? [""])[0],
        wave: (wave.match(/\d+/) ?? [""])[0],
      };
    }
  }
  const available = Object.keys(exhibition).length >= 6;
  return { available, exhibition, tilt, startExhibition, weather };
}

// ---------------------------------------------------------------- まとめて取得
export async function fetchRaceInfo(dateISO: string, rno = 12): Promise<RaceInfo> {
  const hd = dateISO.replace(/-/g, "");
  const [listHtml, beforeHtml] = await Promise.all([
    fetchHtml(url("racelist", rno, hd)),
    fetchHtml(url("beforeinfo", rno, hd)),
  ]);
  const list = parseRaceList(listHtml);
  const before = parseBeforeInfo(beforeHtml);
  const boats = list.boats.map((b) => ({
    ...b,
    exhibitionTime: before.exhibition[b.waku] ?? null,
    tilt: before.tilt[b.waku] ?? null,
  }));
  let weather = before.weather;
  // 12Rの直前情報がまだ無いときは、直近のレースの気象を使う（天気の見送り判定用）
  if (!weather && list.available) {
    for (const r of [rno - 1, rno - 2, rno - 3]) {
      if (r < 1) break;
      const w = parseBeforeInfo(await fetchHtml(url("beforeinfo", r, hd))).weather;
      if (w) {
        weather = w;
        break;
      }
    }
  }
  return {
    date: dateISO,
    rno,
    raceListAvailable: list.available,
    beforeInfoAvailable: before.available,
    raceType: list.raceType,
    title: list.title,
    boats,
    weather,
    startExhibition: before.startExhibition,
  };
}
