import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms";
import { getUser } from "@/lib/auth";

export const metadata = { title: "Login" };

export default async function Page() {
  if (await getUser()) redirect("/");
  return (
    <div className="px-4 py-10">
      <LoginForm />
      <p className="panel mx-auto mt-6 max-w-lg px-4 py-3 text-center">
        New here? <Link className="neon underline" href="/signup">Create an account</Link>
      </p>
    </div>
  );
}
