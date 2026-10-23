"use client";
import { useId, useState } from "react";
import { archetypes, interests } from "@/lib/traveler";
import { SearchInput } from "./ui/search-input";

const identities = Object.entries(archetypes)
  .filter(([key]) => key !== "curious-explorer")
  .map(([key, value]) => {
    const mask = key === "wildcard" ? 63 : Number(key.replace("identity-", ""));
    return {
      key,
      label: value.label,
      interests: interests
        .filter((_, i) => mask & (1 << i))
        .map((v) => v.label)
        .join(" · "),
    };
  });
export function TravelerTargeting({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [custom, setCustom] = useState(value.length > 0);
  const [search, setSearch] = useState("");
  const id = useId();
  const choices = identities.filter((v) =>
    (v.label + " " + v.interests)
      .toLocaleLowerCase("en")
      .includes(search.trim().toLocaleLowerCase("en")),
  );
  return (
    <section
      id="place-audience"
      className="place-editor-section traveler-targeting"
      aria-labelledby={id}
    >
      <h2 id={id}>Who is this Place for?</h2>
      <p>
        Choose who sees this Place in their personalized suggestions. Everyone
        can still find it through browsing, subject to membership access.
      </p>
      <label className="traveler-targeting__mode">
        Recommendation audience
        <select
          value={custom ? "selected" : "automatic"}
          onChange={(e) => {
            setCustom(e.target.value === "selected");
            if (e.target.value === "automatic") onChange([]);
          }}
        >
          <option value="automatic">
            Match automatically using categories
          </option>
          <option value="selected">Choose traveler types</option>
        </select>
      </label>
      {custom && (
        <>
          <div className="traveler-targeting__tools">
            <label>
              Find a traveler type
              <SearchInput
                label="Find a traveler type"
                value={search}
                onValueChange={setSearch}
                preventSubmit
                placeholder="Search a name or interest"
              />
            </label>
            <span role="status">{value.length} selected</span>
            {value.length > 0 && (
              <button type="button" onClick={() => onChange([])}>
                Clear selection
              </button>
            )}
          </div>
          <fieldset className="traveler-targeting__choices">
            <legend>Traveler types</legend>
            {choices.map((v) => (
              <label key={v.key}>
                <input
                  type="checkbox"
                  checked={value.includes(v.key)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...value, v.key]
                        : value.filter((key) => key !== v.key),
                    )
                  }
                />
                <span>
                  <strong>{v.label}</strong>
                  <small>{v.interests}</small>
                </span>
              </label>
            ))}
            {!choices.length && (
              <p>
                No traveler types match. Try an interest such as coffee or
                beaches.
              </p>
            )}
          </fieldset>
          {value.length === 0 && (
            <p className="p2-muted">
              No types selected. Category matching will be used until you select
              one.
            </p>
          )}
        </>
      )}
    </section>
  );
}
