"""
定額買いシミュレーター（components/FlatBetSimulator.tsx）が使う日別ログを生成する。

対象日: ①11R 1着=1号艇 ②10Rと11Rの3連単が完全一致しない、かつ
見送り7条件（lib/skipRules.ts で有効なもの: 12Rが雨・曇り / 1号艇の勝率差≤-1.0 /
1号艇展示タイム4位以下 / 1号艇以外にチルト0.5以上 / 1号艇チルト0.5以上 / スタート展示の進入が枠なりでない）
に該当しない日。lib/skipRules.ts の条件を変えたらここも合わせて再生成する。
買い目は 12R 3連単の確定オッズ最低（1番人気）1点。払戻は omura_results.csv の実払戻（100円あたり）。

使い方（omura-boatrace のCSVを指定）:
  python scripts/build_flat_bet_log.py <omura_results.csv> <omura_daily_extra.csv> <omura_12r_odds.csv> <omura_racers.csv>
出力: lib/flatBetLog.ts
"""
import csv, sys, os

res_path, ext_path, odds_path, racers_path = sys.argv[1:5]
out_path = os.path.join(os.path.dirname(__file__), "..", "lib", "flatBetLog.ts")

def read(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

res = {r["日付"]: r for r in read(res_path)}
ext = {r["日付"]: r for r in read(ext_path)}
odds = {}
for r in read(odds_path):
    d = r.pop("日付")
    o = {}
    for combo, v in r.items():
        try:
            o[combo] = float(v)
        except ValueError:
            pass
    if o:
        odds[d] = o

# 12R のチルト（枠ごと）
tilt = {}
for r in read(racers_path):
    if r.get("R") != "12":
        continue
    try:
        t = float(r["チルト"])
    except (ValueError, KeyError):
        continue
    tilt.setdefault(r["日付"], {})[r["枠"]] = t

def num(s):
    try:
        return float(str(s).replace("F", "").replace("L", ""))
    except ValueError:
        return None

rows = []
for d in sorted(res):
    r = res[d]
    if r["11R_1着"] != "1":
        continue
    if (r["10R_1着"], r["10R_2着"], r["10R_3着"]) == (r["11R_1着"], r["11R_2着"], r["11R_3着"]):
        continue
    e = ext.get(d)
    if not e or d not in odds:
        continue
    if r.get("12R_天気", "") in ("雨", "曇り"):
        continue
    wd = num(e.get("12R_1号艇勝率差"))
    if wd is not None and wd <= -1.0:
        continue
    ex = num(e.get("12R_1号艇展示タイム順位"))
    if ex is not None and ex >= 4:
        continue
    tl = tilt.get(d, {})
    if any(t >= 0.5 for w, t in tl.items() if w != "1"):
        continue
    if tl.get("1", 0) >= 0.5:
        continue
    if e.get("12R_展示枠なり") == "0":
        continue
    o = odds[d]
    res12 = f'{r["12R_1着"]}-{r["12R_2着"]}-{r["12R_3着"]}'
    lo = min(o.values())
    ties = [c for c, v in o.items() if v == lo]
    # 最低オッズが同じ目が複数あるときは、結果CSVの公式人気（12R_人気=1）で1番人気を決める
    fav = res12 if (len(ties) > 1 and res12 in ties and r.get("12R_人気") == "1") else ties[0]
    pay = int(r["12R_払戻"]) if res12 == fav and r["12R_払戻"] else 0
    rows.append((d, fav, o[fav], res12, pay))

hits = sum(1 for x in rows if x[4] > 0)
lines = [
    "/**",
    " * 定額買いシミュレーター用の日別ログ。scripts/build_flat_bet_log.py で生成（手で編集しない）。",
    " * 条件: ①②成立かつ見送り7条件（雨・曇り・勝率差≤-1.0・展示4位以下・他艇チルト0.5以上・1号艇チルト0.5以上・進入が枠なりでない）に該当しない日に、",
    " * 12R 3連単の1番人気（確定オッズ最低）を1点買い。pay は的中時の100円あたり払戻（不的中は0）。",
    f" * 期間 {rows[0][0]}〜{rows[-1][0]}、{len(rows)}日、的中{hits}回。",
    " */",
    "export type FlatBetRow = {",
    "  /** 日付 YYYY-MM-DD */ d: string;",
    "  /** 買い目（12R 1番人気） */ fav: string;",
    "  /** 確定オッズ */ o: number;",
    "  /** 12R 結果 */ res: string;",
    "  /** 100円あたり払戻（不的中は0） */ pay: number;",
    "};",
    "",
    f'export const FLAT_BET_RANGE = {{ from: "{rows[0][0]}", to: "{rows[-1][0]}" }};',
    "",
    "export const FLAT_BET_LOG: FlatBetRow[] = [",
]
for d, fav, o, res12, pay in rows:
    lines.append(f'  {{ d: "{d}", fav: "{fav}", o: {o}, res: "{res12}", pay: {pay} }},')
lines.append("];")
lines.append("")
with open(out_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print(f"{len(rows)}日 的中{hits}回 -> {out_path}")
