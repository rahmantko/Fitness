import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getCheckins, getDailyLogs } from "@/lib/queries";
import { today } from "@/lib/format";
import { Card } from "@/components/ui";
import { CheckinForm } from "@/components/forms";

export default async function NewCheckin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireUser();
  if (viewer.role !== "client" || viewer.id !== id) notFound();
  const [logs, checkins] = await Promise.all([getDailyLogs(id, 7), getCheckins(id)]);
  const lastWeight = [...logs].reverse().find((l) => l.weightKg != null)?.weightKg ?? checkins[0]?.weightKg ?? null;
  return (
    <Card title="New check-in">
      <CheckinForm date={today()} lastWeight={lastWeight} />
    </Card>
  );
}
