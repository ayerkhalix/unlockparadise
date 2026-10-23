"use client";
import { str, StudioTable, type Row } from "./shared";
export default function Trend({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => Number(r.events))),
    width = 800,
    height = 180;
  const points = rows
    .map(
      (r, i) =>
        `${40 + (i * (width - 60)) / Math.max(1, rows.length - 1)},${height - 25 - (Number(r.events) / max) * (height - 50)}`,
    )
    .join(" ");
  return (
    <section className="studio-trend">
      <h2>Measured activity over time</h2>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Daily consented event count. Exact counts are available in the data table below."
      >
        <line
          x1="40"
          y1="155"
          x2="780"
          y2="155"
          stroke="currentColor"
          opacity=".25"
        />
        <text x="8" y="28">
          {max}
        </text>
        <text x="20" y="158">
          0
        </text>
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        {rows.length > 0 && (
          <>
            <text x="40" y="177">
              {str(rows[0].day)}
            </text>
            <text x="780" y="177" textAnchor="end">
              {str(rows[rows.length - 1].day)}
            </text>
          </>
        )}
      </svg>
      <details>
        <summary>View daily counts</summary>
        <StudioTable
          caption="Daily measured activity"
          rows={rows}
          columns={[
            { label: "Date", render: (r) => str(r.day) },
            { label: "Events", render: (r) => str(r.events) },
            { label: "Sessions", render: (r) => str(r.sessions) },
          ]}
        />
      </details>
    </section>
  );
}
