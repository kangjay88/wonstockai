import { redirect } from "next/navigation";

export default function Home() {
  // The proxy bounces unauthenticated users to /login; authenticated users land
  // on the dashboard.
  redirect("/dashboard");
}
