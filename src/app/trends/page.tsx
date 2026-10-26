import { redirect } from "next/navigation";

// Trends now live on the home page; keep old links and bookmarks working.
export default function TrendsPage() {
  redirect("/");
}
