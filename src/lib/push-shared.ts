export const defaultPushPreferences = { meals: true, gym: true, steps: true, weight: true, reminders: true, updates: true };
export type PushPreferences = typeof defaultPushPreferences;
/** Alerts about what other people did. (Reminders and update announcements are separate preferences.) */
export type ActivityKind = "meals" | "gym" | "steps" | "weight";
export type PushMessage = { title: string; body: string; url: string; tag: string };
export const pushCategories: { key: keyof PushPreferences; label: string }[] = [
  { key: "meals", label: "Meals and meal photos" },
  { key: "gym", label: "Gym posts, lifts and check-ins" },
  { key: "steps", label: "Step updates" },
  { key: "weight", label: "Weigh-ins and height updates" },
  { key: "reminders", label: "Reminders for you: gym 8am, meals 10am / 2pm / 8pm, steps 9pm (Singapore time)" },
  { key: "updates", label: "“App updated!” announcements" },
];
