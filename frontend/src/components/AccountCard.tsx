"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { signOut } from "@/lib/auth";
import { clearSavedPlans } from "@/lib/savedPlans";

/** The signed-in teacher: who they are, and "Sign out". Compact, for the header's top right corner. */
export default function AccountCard({ session }: { session: Session }) {
  const [busy, setBusy] = useState(false);
  const email = session.user.email ?? "";
  const initial = (email.trim()[0] ?? "T").toUpperCase();

  async function handleSignOut() {
    setBusy(true);
    await signOut();
    // Saved plans stay in the account; remove this device's copy.
    clearSavedPlans();
    setBusy(false);
  }

  return (
    <section
      aria-label="Your account"
      className="flex w-36 flex-col items-center gap-1.5 rounded-xl border border-line bg-card p-3 text-center sm:w-52"
    >
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-full bg-accent text-lg font-semibold text-accent-contrast"
      >
        {initial}
      </span>
      <p className="text-xs text-muted">Signed in as</p>
      <p className="w-full truncate text-sm font-semibold" title={email}>
        {email || "Teacher"}
      </p>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={busy}
        className="mt-1 w-full rounded-lg border-2 border-accent px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-contrast disabled:opacity-60"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </section>
  );
}
