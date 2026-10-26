"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconGym, IconHome, IconMeals, IconSites } from "./icons";

const destinations = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/posts", label: "Posts", Icon: IconMeals },
  { href: "/gym", label: "Gym", Icon: IconGym },
  { href: "/sites", label: "Sites", Icon: IconSites },
] as const;

export function MainNavigation() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin") || ["/login", "/signup", "/coach"].includes(pathname)) return null;

  return (
    <nav className="main-navigation" aria-label="Main navigation">
      {destinations.map(({ href, label, Icon }) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
          <Icon />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
