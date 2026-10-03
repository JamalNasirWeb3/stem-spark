"use client";

import { useState } from "react";
import { type AuthState, signOut } from "@/lib/auth";
import { clearSavedPlans } from "@/lib/savedPlans";

const BUTTON =
  "shrink-0 rounded-lg border-2 border-accent px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-contrast disabled:opacity-60";

/** Header control: "Sign in", or the teacher's email with "Sign out". */
export default function AccountButton({
  auth,
  onSignIn,
}: {
  auth: AuthState;
  /** Shows the sign-in card. */
  onSignIn: () => void;
}) {
  const [busy, setBusy] = useState(false);

  if (auth.status === "loading") return null;

  if (auth.status === "signed_out") {
    return (
      <button type="button" onClick={onSignIn} className={BUTTON}>
        Sign in
      </button>
    );
  }

  const email = auth.session.user.email ?? "Signed in";
  return (
    <div className="flex flex-col items-end gap-1 text-sm">
      <span className="max-w-48 truncate text-muted" title={email}>
        {email}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await signOut();
          // Saved plans stay in the account; remove this device's copy.
          clearSavedPlans();
          setBusy(false);
        }}
        className="underline underline-offset-4 disabled:opacity-60"
      >
        Sign out
      </button>
    </div>
  );
}
