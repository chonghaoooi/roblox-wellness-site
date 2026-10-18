import { redirect } from "next/navigation";

// Settings moved to the bottom of the shop page.
export default function Page() {
  redirect("/shop#settings");
}
