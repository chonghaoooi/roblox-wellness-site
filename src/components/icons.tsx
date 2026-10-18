import type { ReactNode } from "react";

const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const I = ({ children }: { children: ReactNode }) => <svg {...base}>{children}</svg>;

export const IconLogin = () => <I><path d="M10 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8M4 12h11M11 8l4 4-4 4" /></I>;
export const IconUserPlus = () => <I><circle cx="9" cy="8" r="4" /><path d="M2 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6" /></I>;
export const IconPlus = () => <I><path d="M12 4v16M4 12h16" /></I>;
export const IconLogout = () => <I><path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8M10 12h11M17 8l4 4-4 4" /></I>;
export const IconGear = () => <I><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></I>;
export const IconSave = () => <I><path d="M5 12l5 5L20 6" /></I>;
export const IconHome = () => <I><path d="M3 11l9-8 9 8M5 10v10h14V10" /></I>;
export const IconTrash = () => <I><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></I>;
export const IconChat = () => <I><path d="M4 5h16v11H9l-5 4z" /></I>;
export const IconSend = () => <I><path d="M3 11l18-8-8 18-2-8z" /></I>;
export const IconBell = () => <I><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 21h4M12 2v2" /></I>;
export const IconMeals = () => <I><path d="M4 3v6c0 3 6 3 6 0V3M7 3v18M19 3c-4 3-4 9 0 9V3v18" /></I>;
export const IconGym = () => <I><path d="M3 8v8M7 5v14M17 5v14M21 8v8M7 12h10" /></I>;
export const IconTrends = () => <I><path d="M4 20V10M12 20V4M20 20v-7" /></I>;
export const IconShop = () => <I><path d="M3 9h18l-2 11H5zM8 9l3-6M16 9l-3-6M9 13v3M15 13v3" /></I>;
