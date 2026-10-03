"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { signOut } from "@/lib/auth";
import { clearSavedPlans } from "@/lib/savedPlans";

/** The signed-in teacher: who they are, and "Sign out". Shown where SignInCard was. */
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
      className="mt-8 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-card p-4 sm:p-5"
    >
      <span
        aria-hidden
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-semibold text-accent-contrast"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">Signed in as</p>
        <p className="truncate font-semibold" title={email}>
          {email || "Teacher"}
        </p>
        <p className="mt-0.5 text-sm text-muted">
          Your saved lesson plans are kept in this account.
        </p>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={busy}
        className="rounded-lg border-2 border-accent px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-contrast disabled:opacity-60"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </section>
  );
}
