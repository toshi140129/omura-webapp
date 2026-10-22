"use client";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

export type TabKey = "today" | "analysis" | "history";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "today", label: "今日", icon: "⚡" },
  { key: "analysis", label: "分析", icon: "📊" },
  { key: "history", label: "履歴", icon: "📋" },
];

const STORAGE_KEY = "omura.tab";

// 現在のタブは URL ハッシュ（なければ前回保存したタブ）を正とする
function readTab(): TabKey {
  const hash = window.location.hash.replace("#", "");
  if (TABS.some((t) => t.key === hash)) return hash as TabKey;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && TABS.some((t) => t.key === saved)) return saved as TabKey;
  } catch {
    /* localStorage が使えない環境は無視 */
  }
  return "today";
}

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

function getServerTab(): TabKey {
  return "today";
}

type Props = {
  lastDate: string;
  totalDays: number;
  today: ReactNode;
  analysis: ReactNode;
  history: ReactNode;
};

export default function AppShell({
  lastDate,
  totalDays,
  today,
  analysis,
  history,
}: Props) {
  const tab = useSyncExternalStore(subscribe, readTab, getServerTab);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const select = (key: TabKey) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, key);
    } catch {
      /* ignore */
    }
    // 履歴を増やさずにハッシュだけ差し替え、購読側に通知する
    window.history.replaceState(null, "", `#${key}`);
    window.dispatchEvent(new Event("hashchange"));
    window.scrollTo({ top: 0 });
  };

  const panes: Record<TabKey, ReactNode> = { today, analysis, history };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="sticky top-0 z-20 border-b border-gray-800 bg-gray-900/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2.5">
          <h1 className="text-base font-bold leading-tight text-yellow-400">
            大村ボートレース 予測
          </h1>
          <div className="text-right text-[11px] leading-tight text-gray-400">
            <div>
              最終データ{" "}
              <span className="font-bold text-gray-200 tabular-nums">
                {lastDate}
              </span>
            </div>
            <div className="tabular-nums">{totalDays}日分</div>
          </div>
        </div>
        {/* 画面幅が広いときはタブを上に出す */}
        <nav className="mx-auto hidden max-w-2xl gap-1 px-4 pb-2 sm:flex">
          {TABS.map((t) => (
            <TabButton key={t.key} active={tab === t.key} onClick={() => select(t.key)}>
              {t.icon} {t.label}
            </TabButton>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-28 pt-4 sm:pb-8">
        {TABS.map((t) => (
          <section key={t.key} hidden={tab !== t.key} aria-label={t.label}>
            {panes[t.key]}
          </section>
        ))}
      </main>

      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed right-4 z-20 rounded-full border border-gray-600 bg-gray-800/95 px-3 py-2 text-xs font-bold text-gray-200 shadow-lg bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] sm:bottom-6"
        >
          ↑ 上へ
        </button>
      )}

      {/* スマホは親指で届く下タブ */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-800 bg-gray-900/95 backdrop-blur pb-[env(safe-area-inset-bottom)] sm:hidden">
        <div className="mx-auto grid max-w-2xl grid-cols-3">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => select(t.key)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                  active ? "text-yellow-400 font-bold" : "text-gray-400"
                }`}
              >
                <span className="text-lg leading-none">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`rounded-full px-4 py-1.5 text-sm ${
        active
          ? "bg-yellow-500 font-bold text-black"
          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
      }`}
    >
      {children}
    </button>
  );
}
