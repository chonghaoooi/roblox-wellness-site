import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Fredoka, Lilita_One } from "next/font/google";
import { Header } from "@/components/Header";
import { KeyboardSpace } from "@/components/KeyboardSpace";
import { MainNavigation } from "@/components/MainNavigation";
import { getAppBrand } from "@/lib/site-config";
import "./globals.css";

const lilita = Lilita_One({ weight: "400", subsets: ["latin"], variable: "--font-lilita", display: "swap" });
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getAppBrand();
  const type = brand.customIcon ? "image/jpeg" : "image/png";
  return {
    title: { default: `${brand.name} — daily stats leaderboards`, template: `%s — ${brand.name}` },
    description: "Log your weight, calories and steps and see how you stack up against everyone else, live.",
    applicationName: brand.name,
    appleWebApp: { capable: true, title: brand.name, statusBarStyle: "black-translucent" },
    icons: {
      icon: [
        { url: brand.icon32, sizes: "32x32", type },
        { url: brand.icon192, sizes: "192x192", type },
      ],
      apple: [{ url: brand.iconApple, sizes: "180x180", type }],
    },
  };
}

// Keyboards shrink the page instead of covering the chat input.
export const viewport: Viewport = { width: "device-width", initialScale: 1, interactiveWidget: "resizes-content", viewportFit: "cover", themeColor: "#000000" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lilita.variable} ${fredoka.variable}`}>
      <body className="min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3 focus:text-black">Skip to content</a>
        <Header />
        <MainNavigation />
        <KeyboardSpace />
        <main id="main">{children}</main>
        <footer className="panel mx-auto my-8 max-w-3xl px-5 py-4 text-center text-sm">
          A fan-made personal project. Not affiliated with or endorsed by Roblox.
          <Link href="/admin" className="ml-3 text-sun underline">Admin</Link>
        </footer>
      </body>
    </html>
  );
}
