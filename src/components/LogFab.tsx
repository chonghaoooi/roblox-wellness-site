import Link from "next/link";
import { IconPlus } from "./icons";

/** Floating "Log +" button, bottom right, sitting just above the phone nav bar. */
export function LogFab({ href, badge = false, label = "Log" }: { href: string; badge?: boolean; label?: string }) {
  return (
    <div className="log-fab">
      <Link href={href} className="btn btn-green !min-h-14 !px-5 !text-xl shadow-[0_6px_14px_rgba(0,0,0,0.45)]" aria-label={badge ? `${label} (you haven't logged today)` : label}>
        <IconPlus />
        {label} +
      </Link>
      {badge && <span className="badge-bang absolute -right-1.5 -top-2.5" aria-hidden>!</span>}
    </div>
  );
}
