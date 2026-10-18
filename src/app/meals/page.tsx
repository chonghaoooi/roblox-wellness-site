import { redirect } from "next/navigation";

// Meals and workouts now share the Posts page. Browsers keep the #fragment through the redirect, so old links still land on the right card.
export default function MealsPage() {
  redirect("/posts");
}
