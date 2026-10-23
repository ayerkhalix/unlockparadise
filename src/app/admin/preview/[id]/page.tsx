import { notFound, redirect } from "next/navigation";
import { currentSession } from "@/lib/auth/session";
import { destinationRepository } from "@/lib/destinations";
import { DestinationDetail } from "@/components/destination-detail";
export const metadata = { title: "Administrator Place preview" };
export default async function Preview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await currentSession();
  if (!current?.staff) redirect("/admin/mfa/");
  const { id } = await params;
  const row = await current.db
    .from("places")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  if (!row.data) notFound();
  const place = await destinationRepository.getBySlug(row.data.slug);
  if (!place) notFound();
  return (
    <>
      <p className="p2-preview-status" role="status">
        Administrator preview — {place.title}
      </p>
      <DestinationDetail place={place} tier="explorer-plus" />
    </>
  );
}
