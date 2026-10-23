"use client";
import { useEffect, useState } from "react";
import { interests, archetypes } from "@/lib/traveler";
import { requestJSON } from "@/lib/client-api";
type Distribution = { key: string; count: number };
type DiscoveryStats = {
  available: boolean;
  minimum: number;
  completed?: number;
  interests?: Distribution[];
  archetypes?: Distribution[];
};
export function TravelerDiscoveryPanel() {
  const [data, setData] = useState<DiscoveryStats | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    requestJSON<{ data: DiscoveryStats }>(
      "/api/admin/traveler-discovery/",
      "GET",
      undefined,
      controller.signal,
    )
      .then((r) => {
        setData(r.data);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [attempt]);
  return (
    <section
      className="td-configuration"
      aria-labelledby="traveler-insights-title"
    >
      <h2 id="traveler-insights-title">Traveler discovery</h2>
      <p>
        Current preference distribution, separate from browsing activity and
        sales.
      </p>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="p2-button p2-button--quiet"
            onClick={() => setAttempt((a) => a + 1)}
          >
            Retry traveler insights
          </button>
        </div>
      ) : !data ? (
        <p role="status">Loading traveler insights…</p>
      ) : !data.available ? (
        <p>
          Aggregate insights appear after at least {data.minimum} travelers
          complete discovery. Individual answers are private.
        </p>
      ) : (
        <>
          <p>
            {data.completed} travelers have completed discovery. Groups with
            fewer than five travelers are omitted.
          </p>
          <dl>
            {data.interests?.map((row) => (
              <div key={row.key}>
                <dt>{interests.find((i) => i.key === row.key)?.label}</dt>
                <dd>{row.count} travelers</dd>
              </div>
            ))}
          </dl>
          <dl>
            {data.archetypes?.map((row) => (
              <div key={row.key}>
                <dt>{archetypes[row.key as keyof typeof archetypes]?.label}</dt>
                <dd>{row.count} travelers</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <details>
        <summary>Interest mapping & traveler types</summary>
        <p>
          Interests reuse existing Places categories. Nature Explorer groups
          rivers, waterfalls and mountains. Pace adds a small ranking signal
          only where recorded hike durations support it; companions never imply
          safety or suitability.
        </p>
        <dl>
          {interests.map((i) => (
            <div key={i.key}>
              <dt>{i.label}</dt>
              <dd>{i.categories.join(", ")}</dd>
            </div>
          ))}
        </dl>
        <p>
          {Object.values(archetypes)
            .map((a) => a.label)
            .join(" · ")}
        </p>
        <p>
          Six interests produce 63 exact combinations: six single interests, 15
          pairs, 20 triples, 15 groups of four, six groups of five, and The
          Wildcard for all six. Identity depends only on selected interests;
          pace and style do not change it. Preferences never grant membership or
          staff access.
        </p>
      </details>
    </section>
  );
}
