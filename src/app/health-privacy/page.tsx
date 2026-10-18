import Link from "next/link";

export const metadata = { title: "Step data privacy" };
export default function HealthPrivacyPage() {
  return <article className="panel mx-3 my-8 max-w-2xl space-y-4 p-5 sm:mx-auto sm:p-6">
    <h1 className="rb-text text-3xl">STEP DATA & PRIVACY</h1>
    <p>Connecting Apple Health or Health Connect is optional. The native app requests read-only permission for Steps. It does not request access to heart rate, sleep, weight, GPS routes or other health records, and does not write anything to your phone’s health store.</p>
    <p>With your consent, the app reads the health store’s aggregated step count for the current site day. Only the date, daily step total, source and sync time are sent to this site over HTTPS. Raw health samples and device histories stay on your phone.</p>
    <p><strong>Your step total and username appear on public leaderboards and in community statistics.</strong> Signed-in users who have enabled activity notifications may receive a generic step-log alert; that alert contains no numeric health values.</p>
    <p>Daily counts are stored with your other logs until you or an administrator removes them. You can delete a synced counter in Log → Recent logs. Turn off automatic sync first if you do not want the counter recreated on the next sync.</p>
    <p>To stop future reads, turn off automatic sync on the tracker page and revoke Roblox’s Steps permission in Apple Health or Android Health Connect. Turning sync off does not delete existing logs. Health data is not used for advertising or sold.</p>
    <p>The web and bookmarked Home Screen versions cannot read your health store. In those versions you may use the existing screenshot logging flow. The native companion does not replace the Home Screen app’s Web Push notification support.</p>
    <p>For questions or removal requests, contact the site owner through the administrator who invited you to this personal project.</p>
    <Link className="text-neon underline" href="/trackers">Back to step connections</Link>
  </article>;
}
