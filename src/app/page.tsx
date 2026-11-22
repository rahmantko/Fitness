import { Avatar } from "@/components/avatar";
import Link from "next/link";
import { redirect } from "next/navigation";
import { regenerateInviteCode } from "./actions";
import { TopBar } from "@/components/shell";
import { InviteShare } from "@/components/invite-share";
import { Card, Empty } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { getRoster } from "@/lib/queries";
import { fmtDate, fmtDelta, fmtNum } from "@/lib/format";

export default async function Home() {
  const user = await requireUser();
  if (user.role === "client") redirect(`/clients/${user.id}`);

  const roster = await getRoster(user.id);
  const waiting = roster.filter((r) => r.needsFeedback).length;

  return (
    <>
      <TopBar user={user} />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Clients</h1>
            <p className="text-sm text-muted">
              {roster.length} client{roster.length === 1 ? "" : "s"}
              {waiting > 0 && ` · ${waiting} check-in${waiting === 1 ? "" : "s"} waiting for feedback`}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
            <span className="text-muted">Invite code</span>
            <InviteShare code={user.inviteCode ?? ""} coachName={user.name} />
            <form action={regenerateInviteCode}>
              <button className="text-xs text-muted underline hover:text-text" title="Old code stops working">
                New code
              </button>
            </form>
          </div>
        </div>

        {process.env.RAILWAY_ENVIRONMENT_NAME && !process.env.RAILWAY_VOLUME_MOUNT_PATH && (
          <p className="rounded-xl border border-warn/40 bg-surface p-4 text-sm">
            <strong className="text-warn">Storage not set up:</strong> photos and lab reports will be deleted whenever
            the app updates. In Railway, right-click this app, choose <em>Attach volume</em>, and use the mount path{" "}
            <code>/app/data</code>.
          </p>
        )}

        {roster.length === 0 ? (
          <Card>
            <Empty>
              No clients yet. Tap Invite client above to send your sign-up link. New clients appear here as soon as they join.
            </Empty>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Client</th>
                  <th className="px-4 py-2 font-medium">Last check-in</th>
                  <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">Weight</th>
                  <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">Change</th>
                  <th className="hidden px-4 py-2 text-right font-medium md:table-cell">Avg steps (7d)</th>
                  <th className="hidden px-4 py-2 text-right font-medium md:table-cell">Days logged (7d)</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => (
                  <tr key={r.client.id} className="border-t border-border hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${r.client.id}`} className="flex items-center gap-3 hover:text-accent">
                        <Avatar name={r.client.name} avatarKey={r.client.avatarKey} size="md" />
                        <span className="min-w-0">
                          <span className="block font-medium">{r.client.name}</span>
                          <span className="block truncate text-xs text-muted">{r.client.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {r.lastCheckin ? fmtDate(r.lastCheckin.date) : <span className="text-muted">None yet</span>}
                      {r.needsFeedback && (
                        <Link
                          href={`/clients/${r.client.id}/checkins`}
                          className="ml-2 inline-block rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent"
                        >
                          Needs feedback
                        </Link>
                      )}
                      {r.newReply && (
                        <Link
                          href={`/clients/${r.client.id}/checkins`}
                          className="ml-2 inline-block rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-warn"
                        >
                          New reply
                        </Link>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                      {r.lastCheckin?.weightKg != null ? `${fmtNum(r.lastCheckin.weightKg)} kg` : "–"}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                      {r.weightChange != null ? `${fmtDelta(r.weightChange)} kg` : "–"}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">{fmtNum(r.avgSteps)}</td>
                    <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">{r.daysLogged}/7</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
