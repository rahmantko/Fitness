import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getCheckins } from "@/lib/queries";
import { fmtDate, fmtDelta, fmtNum } from "@/lib/format";
import { ButtonLink, Card, Empty } from "@/components/ui";
import { FeedbackForm } from "@/components/forms";
import { PhotoStrip } from "@/components/photo-viewer";

export default async function CheckinsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireUser();
  const list = await getCheckins(id);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Check-ins</h2>
        <div className="flex gap-2">
          {list.length >= 2 && (
            <Link href={`/clients/${id}/compare`} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2">
              Compare
            </Link>
          )}
          {viewer.role === "client" && <ButtonLink href={`/clients/${id}/checkins/new`}>New check-in</ButtonLink>}
        </div>
      </div>
      {list.length === 0 && <Empty>No check-ins yet.</Empty>}
      {list.map((c, i) => {
        const prev = list[i + 1];
        const change = prev && c.weightKg != null && prev.weightKg != null ? c.weightKg - prev.weightKg : null;
        return (
          <Card
            key={c.id}
            title={fmtDate(c.date)}
            action={
              prev && (
                <Link href={`/clients/${id}/compare?a=${prev.id}&b=${c.id}`} className="text-sm text-accent">
                  Compare with previous
                </Link>
              )
            }
          >
            <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm sm:grid-cols-6">
              {[
                ["Weight", c.weightKg != null ? `${fmtNum(c.weightKg)} kg` : "–", change != null ? `${fmtDelta(change)} kg` : null],
                ["Body fat", c.bodyFatPct != null ? `${fmtNum(c.bodyFatPct)}%` : "–", null],
                ["Waist", c.waistCm != null ? `${fmtNum(c.waistCm)} cm` : "–", null],
                ["Energy", c.energy ?? "–", null],
                ["Sleep", c.sleep ?? "–", null],
                ["Adherence", c.adherence ?? "–", null],
              ].map(([k, v, sub]) => (
                <div key={k as string}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="tabular-nums">
                    {v}
                    {sub && <span className="ml-1 text-xs text-muted">{sub}</span>}
                  </dd>
                </div>
              ))}
            </dl>
            {c.photos.length > 0 && (
              <div className="mt-3">
                <PhotoStrip
                  title={fmtDate(c.date)}
                  photos={(["front", "side", "back"] as const)
                    .flatMap((pose) => c.photos.filter((p) => p.pose === pose))
                    .map((p) => ({ id: p.id, fileKey: p.fileKey, label: p.pose }))}
                />
              </div>
            )}
            {c.notes && (
              <p className="mt-3 whitespace-pre-line text-sm">
                <span className="text-xs font-medium text-muted">Client notes: </span>
                {c.notes}
              </p>
            )}
            <div className="mt-3 border-t border-border pt-3">
              {viewer.role === "coach" ? (
                <FeedbackForm checkinId={c.id} feedback={c.coachFeedback} />
              ) : c.coachFeedback ? (
                <blockquote className="whitespace-pre-line rounded-xl bg-accent-soft p-3 text-sm">
                  <div className="mb-1 text-xs font-medium text-accent">Coach feedback</div>
                  {c.coachFeedback}
                </blockquote>
              ) : (
                <p className="text-sm text-muted">Waiting for coach feedback.</p>
              )}
            </div>
          </Card>
        );
      })}
    </>
  );
}
