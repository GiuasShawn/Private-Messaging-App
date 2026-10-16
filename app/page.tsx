import { redirect } from "next/navigation";

/**
 * The prototype opens on the messenger. Authentication is mocked at the UI
 * level on /login; there is no real account system in Phase 1.
 */
export default function Home() {
  redirect("/chat");
}
