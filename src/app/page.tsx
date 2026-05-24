import { redirect } from "next/navigation";

// Phase 1 has one functional screen — the Profile. Send the user there.
// The Today dashboard arrives in a later phase.
export default function Home() {
  redirect("/profile");
}
