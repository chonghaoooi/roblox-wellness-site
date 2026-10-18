import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/forms";
import { getUser } from "@/lib/auth";

export const metadata = { title: "Sign up" };

export default async function Page() {
  if (await getUser()) redirect("/");
  return (
    <div className="px-4 py-10">
      <SignupForm />
      <p className="panel mx-auto mt-6 max-w-lg px-4 py-3 text-center">
        Already have an account? <Link className="neon underline" href="/login">Login</Link>
      </p>
    </div>
  );
}
