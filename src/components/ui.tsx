import Link from "next/link";
import type { ReactNode } from "react";

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span
      aria-hidden
      className="relative inline-grid shrink-0 place-items-center overflow-hidden rounded-lg border-[3px] border-black font-display text-white"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(hsl(${h} 85% 58%), hsl(${h} 80% 38%))`,
        fontSize: size * 0.5,
        WebkitTextStroke: "0.15em #000",
        paintOrder: "stroke fill",
      }}
    >
      {name.slice(0, 1).toUpperCase()}
      {/* The profile picture, if the person has one, covers the letter; otherwise the endpoint returns a transparent pixel. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/avatar/${encodeURIComponent(name)}`} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
    </span>
  );
}

export function LinkButton({ href, color, icon, children }: { href: string; color: "green" | "purple" | "blue" | "yellow" | "red"; icon?: ReactNode; children: ReactNode }) {
  return (
    <Link href={href} className={`btn btn-${color}`}>
      {icon}
      {children}
    </Link>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="rb-text text-3xl sm:text-4xl">{children}</h2>
      {sub && <p className="panel mt-3 inline-block px-4 py-2 text-base">{sub}</p>}
    </div>
  );
}

export function EmptyState({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`panel grid place-items-center px-5 py-8 text-center ${className}`}>
      <p className="font-display text-xl text-sun">{children}</p>
    </div>
  );
}

export const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
