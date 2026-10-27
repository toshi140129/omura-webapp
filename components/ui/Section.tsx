import type { ReactNode } from "react";

type Props = {
  id: string;
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  accent?: "yellow" | "gray";
  children: ReactNode;
};

/**
 * 折りたたみ式のカード。ネイティブの <details> を使うので JS なしで動き、
 * サーバーコンポーネントを中に入れられる。
 */
export default function Section({
  id,
  title,
  summary,
  defaultOpen = false,
  accent = "gray",
  children,
}: Props) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group mb-3 rounded-xl border border-gray-700 bg-gray-900/60 open:bg-gray-900"
    >
      <summary className="flex cursor-pointer select-none list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span
          className={`inline-block h-5 w-1 shrink-0 rounded ${
            accent === "yellow" ? "bg-yellow-400" : "bg-gray-600"
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold leading-tight">{title}</span>
          {summary && (
            <span className="mt-0.5 block truncate text-xs text-gray-400">
              {summary}
            </span>
          )}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="h-5 w-5 shrink-0 text-gray-500 transition-transform group-open:rotate-180"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </summary>
      <div className="border-t border-gray-800 px-4 pb-4 pt-3">{children}</div>
    </details>
  );
}
