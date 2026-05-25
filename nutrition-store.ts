import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Signed-in visitors land on the Today dashboard; everyone else on the
// landing page.
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/today" : "/login");
}
