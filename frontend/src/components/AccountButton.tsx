"use client";

import { useState } from "react";
import { type AuthState, signOut } from "@/lib/auth";
import { clearSavedPlans } from "@/lib/savedPlans";

/** Header control for a signed-in teacher: their email and "Sign out". Signing in happens in SignInCard. */
export default function AccountButton({ auth }: { auth: AuthState }) {
  const [busy, setBusy] = useState(false);

  if (auth.status !== "signed_in") return null;

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
