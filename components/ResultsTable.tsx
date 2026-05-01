import type { RaceRow } from "@/app/page";

export default function ResultsTable({ data }: { data: RaceRow[] }) {
  return (
    <div className="rounded-lg border border-gray-700 p-4">
      <h2 className="font-bold mb-3 text-lg">過去結果</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-center">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="py-2 px-1">日付</th>
              <th className="py-2 px-1">10R</th>
              <th className="py-2 px-1">払戻</th>
              <th className="py-2 px-1">11R</th>
              <th className="py-2 px-1">払戻</th>
              <th className="py-2 px-1">12R</th>
              <th className="py-2 px-1">払戻</th>
              <th className="py-2 px-1">天気</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const cond1 = row.r11.p1 === "1";
              const cond3 = row.r12.p1 === "1";
              const r11_23 = [row.r11.p2, row.r11.p3];
              const r12_23 = [row.r12.p2, row.r12.p3];
              const cond4 = r11_23.some((b) => r12_23.includes(b));
              const pay = parseInt(row.r12.pay || "0");
              const hit = cond1 && cond3 && cond4 && pay > 0 && pay < 4000;
              return (
                <tr
                  key={row.date}
                  className={`border-b border-gray-800 ${
                    hit ? "bg-green-900/30" : ""
                  }`}
                >
                  <td className="py-2 px-1 text-gray-300">
                    {row.date.slice(5)}
                  </td>
                  <td className="py-2 px-1">
                    {row.r10.p1}-{row.r10.p2}-{row.r10.p3}
                  </td>
                  <td className="py-2 px-1 text-yellow-400">{row.r10.pay}</td>
                  <td className={`py-2 px-1 ${cond1 ? "text-green-400 font-bold" : ""}`}>
                    {row.r11.p1}-{row.r11.p2}-{row.r11.p3}
                  </td>
                  <td className="py-2 px-1 text-yellow-400">{row.r11.pay}</td>
                  <td className={`py-2 px-1 ${hit ? "text-green-400 font-bold" : ""}`}>
                    {row.r12.p1}-{row.r12.p2}-{row.r12.p3}
                  </td>
                  <td className="py-2 px-1 text-yellow-400">{row.r12.pay}</td>
                  <td className="py-2 px-1 text-gray-300">{row.weather || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
