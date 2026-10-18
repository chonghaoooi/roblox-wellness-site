import Link from "next/link";
import { logout } from "@/app/actions";
import { getUser } from "@/lib/auth";
import { todayStr } from "@/lib/dates";
import { getAppBrand } from "@/lib/site-config";
import { currentPushDevice, pushConfigured, pushPublicKey } from "@/lib/push";
import { hasEntryOn } from "@/lib/queries";
import { IconBell, IconChat, IconShop, IconLogin, IconLogout, IconPlus, IconUserPlus } from "./icons";
import { NotificationGate } from "./NotificationGate";
import { Ticker } from "./Ticker";
import { TrackerAutoSync } from "./TrackerAutoSync";
import { LinkButton } from "./ui";

export async function Header() {
  const user = await getUser();
  const brand = await getAppBrand();
  const needsLog = user ? !(await hasEntryOn(user.id, todayStr())) : false;
  // Signed in, notifications are set up on the server, but this device isn't subscribed: send them to the notifications page first.
  let promptNotifications = false;
  if (user && pushConfigured()) {
    const device = await currentPushDevice(user.id);
    promptNotifications = !(device && device.publicKey === pushPublicKey());
  }
  return (
    <header className="site-header sticky top-0 z-40 border-b-[6px] border-black bg-[#0b0b12]/95 shadow-[0_6px_0_rgba(0,0,0,0.4)]">
      {user && <TrackerAutoSync userId={user.id} />}
      {promptNotifications && <NotificationGate />}
      <div className="mobile-safe-area" aria-hidden="true" />
      <Ticker />
      <div className="mx-auto flex max-w-[110rem] items-center justify-between gap-2 px-3 py-2 sm:flex-wrap sm:gap-3 sm:px-4">
        <Link href="/" className="flex min-w-0 items-center gap-1.5 sm:gap-2" aria-label={`${brand.name}, home`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.icon192} alt="" width={40} height={40} className="h-8 w-8 rounded-lg border-2 border-black object-cover sm:h-10 sm:w-10" />
          <span className={`rb-text whitespace-nowrap text-[0.95rem] sm:text-3xl ${user ? "max-sm:sr-only" : ""}`}>{brand.name.toUpperCase()}</span>
        </Link>
        <nav className="account-actions flex shrink-0 items-center gap-2 sm:gap-3" aria-label="Account">
          {user ? (
            <>
              <span className="neon hidden text-xl sm:inline" title="Signed in as">{user.username}</span>
              <span className="relative">
                <LinkButton href="/log" color="green" icon={<IconPlus />}><span className="max-sm:hidden">Log today</span><span className="sm:hidden max-[379px]:sr-only">Log</span></LinkButton>
                {needsLog && (
                  <span className="badge-bang absolute -right-2 -top-3" role="img" aria-label="You haven't logged today">!</span>
                )}
              </span>
              <LinkButton href="/notifications" color="blue" icon={<IconBell />}><span className="max-sm:sr-only">Notifications</span></LinkButton>
              <LinkButton href="/coach" color="purple" icon={<IconChat />}><span className="max-sm:sr-only">Coach</span></LinkButton>
              <span className="relative">
                <LinkButton href="/shop" color="yellow" icon={<IconShop />}><span className="max-sm:sr-only">Shop</span></LinkButton>
                <span className="badge-bang shop-alert absolute -right-2 -top-3 pointer-events-none" aria-hidden="true">!</span>
              </span>
              <form action={logout}>
                <button className="btn btn-yellow"><IconLogout /><span className="max-sm:sr-only">Log out</span></button>
              </form>
            </>
          ) : (
            <>
              <LinkButton href="/signup" color="purple" icon={<IconUserPlus />}><span className="max-sm:hidden">Sign up</span><span className="sm:hidden">Join</span></LinkButton>
              <LinkButton href="/login" color="green" icon={<IconLogin />}>Login</LinkButton>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
