import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { plannerHref } from "@/lib/planning";
export const metadata = { title: "Your itinerary" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  redirect(plannerHref(id, (await searchParams).day));
}
