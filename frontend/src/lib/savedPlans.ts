// Generated lesson plans are kept in localStorage so they stay viewable offline.
// When a teacher is signed in, plans are also saved to their Supabase account
// and synced, so they follow the teacher across devices. localStorage then acts
// as the offline copy of the account's plans.
// Exposed as an external store for useSyncExternalStore.

import type { LessonPlan } from "./api";
import { getAuthState, supabase } from "./auth";

const KEY = "stem-spark:plans";
const MAX_PLANS = 50;
const EMPTY: SavedPlan[] = [];

export type SavedPlan = { savedAt: string; plan: LessonPlan };

let cache: SavedPlan[] | null = null;
const listeners = new Set<() => void>();

function read(): SavedPlan[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as SavedPlan[];
  } catch {
    return EMPTY;
  }
}

function write(plans: SavedPlan[]) {
  cache = plans;
  try {
    localStorage.setItem(KEY, JSON.stringify(plans));
  } catch {
    // Storage full or unavailable; the plans are still kept for this session.
  }
  listeners.forEach((l) => l());
}

export function getSavedPlans(): SavedPlan[] {
  return (cache ??= read());
}

export function getServerSavedPlans(): SavedPlan[] {
  return EMPTY;
}

export function subscribeSavedPlans(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function signedIn(): boolean {
  return Boolean(supabase) && getAuthState().status === "signed_in";
}

export function savePlan(plan: LessonPlan) {
  const saved = { savedAt: new Date().toISOString(), plan };
  write([saved, ...getSavedPlans()].slice(0, MAX_PLANS));
  if (signedIn()) {
    // If this fails (e.g. offline), the next sync uploads it.
    void supabase!
      .from("plans")
      .insert({ saved_at: saved.savedAt, plan })
      .then(({ error }) => error && console.warn("Couldn't save the plan online", error));
  }
}

/** Removes this device's copy, e.g. on sign-out so the next person can't see them. */
export function clearSavedPlans() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
  cache = EMPTY;
  listeners.forEach((l) => l());
}

// Postgres and JavaScript format the same instant differently; compare instants.
const instant = (iso: string) => new Date(iso).toISOString();

/**
 * Uploads plans that are only on this device, then replaces the local copy with
 * the account's latest plans. Plans made before signing in join the account.
 */
export async function syncPlans(): Promise<void> {
  if (!signedIn()) return;
  const { data, error } = await supabase!
    .from("plans")
    .select("saved_at, plan")
    .order("saved_at", { ascending: false })
    .limit(MAX_PLANS);
  if (error || !data) return;

  const online: SavedPlan[] = data.map((row) => ({
    savedAt: instant(row.saved_at as string),
    plan: row.plan as LessonPlan,
  }));
  const onlineKeys = new Set(online.map((p) => p.savedAt));
  const localOnly = getSavedPlans().filter((p) => !onlineKeys.has(instant(p.savedAt)));

  if (localOnly.length) {
    const { error: uploadError } = await supabase!.from("plans").upsert(
      localOnly.map((p) => ({ saved_at: p.savedAt, plan: p.plan })),
      { onConflict: "user_id,saved_at", ignoreDuplicates: true },
    );
    // Keep unsent plans on the device so they aren't lost; they upload next time.
    if (uploadError) console.warn("Couldn't upload saved plans", uploadError);
  }

  const merged = [...online, ...localOnly]
    .sort((a, b) => instant(b.savedAt).localeCompare(instant(a.savedAt)))
    .slice(0, MAX_PLANS);
  write(merged);
}
