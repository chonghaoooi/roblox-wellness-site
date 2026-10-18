import { MealGallery } from "@/components/MealGallery";
import { LogFab } from "@/components/LogFab";
import { getUser } from "@/lib/auth";
import { recentMeals } from "@/lib/queries";

export const metadata = { title: "Meals" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function MealsPage() {
  const user = await getUser();
  const meals = await recentMeals(user?.id);
  return <>
    <MealGallery meals={meals} me={user?.username} />
    <LogFab href={user ? "/log#meal" : "/login"} />
  </>;
}
