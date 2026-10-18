import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/AdminForms";
import { getAdmin } from "@/lib/admin-auth";

export const metadata = { title: "Admin login", robots: { index: false, follow: false } };

export default async function Page() {
  if (await getAdmin()) redirect("/admin");
  return <div className="px-3 py-10"><AdminLoginForm /><p className="mt-6 text-center"><Link className="panel inline-block px-4 py-2 text-sun underline" href="/">Back to the site</Link></p></div>;
}
