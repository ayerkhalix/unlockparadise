import { ContentImage } from "@/components/ui/content-image";
import { serverSupabase } from "@/lib/supabase/server";
import { databaseError } from "@/lib/http";
import { planningPlace } from "@/lib/repositories/planning";
export async function Recommendations({ placeId }: { placeId: string }) {
  const db = await serverSupabase();
  const result = await db
    .from("place_recommendations")
    .select(
      "recommendation_type,position,recommended:places!place_recommendations_recommended_place_id_fkey(id,slug,title,status,vip_content,place_areas(areas(name,slug)),place_categories(categories(name,slug)),place_media(kind,media(id,status)),place_details(latitude,longitude,excerpt))",
    )
    .eq("source_place_id", placeId)
    .order("position");
  databaseError(result.error);
  const cards = (result.data || [])
    .map((row) => ({
      place: planningPlace(row.recommended),
      type: row.recommendation_type,
      excerpt: (
        row.recommended as unknown as {
          place_details: { excerpt: string } | null;
        }
      )?.place_details?.excerpt,
    }))
    .filter((r) => r.place);
  if (!cards.length) return null;
  return (
    <section className="p2-recommendations">
      <h2>More places to explore</h2>
      <div className="p2-recommendation-grid">
        {cards.map(({ place: p, type, excerpt }) => (
          <article className="p2-recommendation" key={p!.id}>
            <a className="p2-recommendation__link" href={`/place/${p!.slug}/`}>
              {p!.image && <ContentImage sizes="96px" src={p!.image} alt="" loading="lazy" />}
              <div>
                <span className="p2-eyebrow">{type || p!.category}</span>
                <h3>{p!.title}</h3>
                <span className="p2-recommendation-area">{p!.area}</span>
                {excerpt && <p>{excerpt.replace(/<[^>]*>/g, "")}</p>}
                <span className="p2-recommendation-explore">
                  View destination ↗
                </span>
              </div>
            </a>
            <button
              className="p2-button p2-button--quiet"
              data-add-itinerary={p!.id}
            >
              Add to Itinerary
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
