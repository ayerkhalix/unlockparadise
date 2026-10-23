import { redirect } from "next/navigation";
export const metadata = { title: "Create a trip" };
export default function Page() {
  redirect("/itineraries/?create=1");
}
