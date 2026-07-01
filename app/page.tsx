import { redirect } from "next/navigation";

export default function RootPage() {
  // Marketing landing lives at /mock/launchwake.html for now; send visitors into
  // the app (middleware routes unauthenticated users to /login).
  redirect("/app");
}
