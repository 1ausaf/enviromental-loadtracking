import { redirect } from "next/navigation";

// Phase 0: send everyone to /dashboard. Phase 1 will route to /login first
// when no authenticated session is found.
export default function Home() {
  redirect("/dashboard");
}
