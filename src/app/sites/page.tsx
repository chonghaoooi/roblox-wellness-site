export const metadata = { title: "Sites" };

// For now the only site is the Doomsday countdown, shown inside the app's own header and navigation.
export default function SitesPage() {
  return (
    <section aria-label="Sites" className="mx-auto max-w-6xl px-2 py-3 sm:px-4">
      <iframe src="/doomsday" title="Doomsday countdown" className="h-[78dvh] w-full rounded-xl border-4 border-black bg-black" allow="autoplay; fullscreen" />
    </section>
  );
}
