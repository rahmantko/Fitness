import "server-only";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  bloodMarkers,
  bloodTests,
  checkinComments,
  checkins,
  dailyLogs,
  photos,
  targets,
  users,
  workoutSets,
  workouts,
} from "@/db/schema";
import { daysAgo } from "./format";

export async function getTargets(clientId: string) {
  const db = await getDb();
  const [t] = await db.select().from(targets).where(eq(targets.clientId, clientId));
  return t ?? null;
}

export async function getDailyLogs(clientId: string, days = 30) {
  const db = await getDb();
  return db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.clientId, clientId), gte(dailyLogs.date, daysAgo(days - 1))))
    .orderBy(asc(dailyLogs.date));
}

/** Fills missing days with nulls so bar charts show gaps honestly. */
export function fillDays<T extends { date: string }>(rows: T[], days: number) {
  const map = new Map(rows.map((r) => [r.date, r]));
  return Array.from({ length: days }, (_, i) => {
    const date = daysAgo(days - 1 - i);
    return { date, row: map.get(date) ?? null };
  });
}

export async function getCheckins(clientId: string) {
  const db = await getDb();
  const list = await db
    .select()
    .from(checkins)
    .where(eq(checkins.clientId, clientId))
    .orderBy(desc(checkins.date), desc(checkins.createdAt));
  const ph = list.length
    ? await db.select().from(photos).where(inArray(photos.checkinId, list.map((c) => c.id)))
    : [];
  const cm = list.length
    ? await db
        .select({ id: checkinComments.id, checkinId: checkinComments.checkinId, body: checkinComments.body, createdAt: checkinComments.createdAt, authorId: users.id, authorName: users.name, authorRole: users.role, authorAvatar: users.avatarKey })
        .from(checkinComments)
        .innerJoin(users, eq(checkinComments.authorId, users.id))
        .where(inArray(checkinComments.checkinId, list.map((c) => c.id)))
        .orderBy(asc(checkinComments.createdAt))
    : [];
  return list.map((c) => ({
    ...c,
    photos: ph.filter((p) => p.checkinId === c.id),
    comments: cm.filter((m) => m.checkinId === c.id),
  }));
}

export async function getWorkouts(clientId: string, limit = 20) {
  const db = await getDb();
  const list = await db
    .select()
    .from(workouts)
    .where(eq(workouts.clientId, clientId))
    .orderBy(desc(workouts.date))
    .limit(limit);
  const sets = list.length
    ? await db
        .select()
        .from(workoutSets)
        .where(inArray(workoutSets.workoutId, list.map((w) => w.id)))
        .orderBy(asc(workoutSets.exercise), asc(workoutSets.setNumber))
    : [];
  return list.map((w) => ({ ...w, sets: sets.filter((s) => s.workoutId === w.id) }));
}

export async function getBloodTests(clientId: string) {
  const db = await getDb();
  const tests = await db
    .select()
    .from(bloodTests)
    .where(eq(bloodTests.clientId, clientId))
    .orderBy(desc(bloodTests.date));
  const markers = tests.length
    ? await db.select().from(bloodMarkers).where(inArray(bloodMarkers.testId, tests.map((t) => t.id)))
    : [];
  return tests.map((t) => ({ ...t, markers: markers.filter((m) => m.testId === t.id) }));
}

export async function getRoster(coachId: string) {
  const db = await getDb();
  const clients = await db
    .select()
    .from(users)
    .where(and(eq(users.coachId, coachId), eq(users.role, "client")))
    .orderBy(asc(users.name));
  return Promise.all(
    clients.map(async (c) => {
      const recent = await db
        .select()
        .from(checkins)
        .where(eq(checkins.clientId, c.id))
        .orderBy(desc(checkins.date), desc(checkins.createdAt))
        .limit(2);
      const last = recent[0];
      const logs = await getDailyLogs(c.id, 7);
      // The client asked something and the coach hasn't replied yet.
      const [lastComment] = await db
        .select({ authorId: checkinComments.authorId })
        .from(checkinComments)
        .innerJoin(checkins, eq(checkinComments.checkinId, checkins.id))
        .where(eq(checkins.clientId, c.id))
        .orderBy(desc(checkinComments.createdAt))
        .limit(1);
      const stepDays = logs.filter((l) => l.steps != null);
      return {
        client: c,
        lastCheckin: last ?? null,
        weightChange:
          recent.length === 2 && recent[0].weightKg != null && recent[1].weightKg != null
            ? recent[0].weightKg - recent[1].weightKg
            : null,
        newReply: lastComment?.authorId === c.id,
        needsFeedback: !!last && !last.coachFeedback && !last.feedbackAudioKey && !last.feedbackVideoUrl,
        avgSteps: stepDays.length
          ? Math.round(stepDays.reduce((a, l) => a + (l.steps ?? 0), 0) / stepDays.length)
          : null,
        daysLogged: logs.length,
      };
    }),
  );
}
