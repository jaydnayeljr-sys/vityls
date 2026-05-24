import { redirect } from "next/navigation";

// The Today dashboard is the home screen — biological age, calorie balance,
// macros, sleep and activity at a glance.
export default function Home() {
  redirect("/today");
}
