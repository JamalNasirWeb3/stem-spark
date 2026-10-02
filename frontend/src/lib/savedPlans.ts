// Generated lesson plans are kept in localStorage so they stay viewable offline.
// Exposed as an external store for useSyncExternalStore.

import type { LessonPlan } from "./api";

const KEY = "stem-spark:plans";
const MAX_PLANS = 20;
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

export function savePlan(plan: LessonPlan) {
  cache = [{ savedAt: new Date().toISOString(), plan }, ...getSavedPlans()].slice(0, MAX_PLANS);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage full or unavailable; the plan is still kept for this session.
  }
  listeners.forEach((l) => l());
}
