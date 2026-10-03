"use client";

import { useState } from "react";
import { sendSignInEmail, verifySignInCode } from "@/lib/auth";

const FIELD =
  "w-full rounded-lg border border-line bg-card px-4 py-3 text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
const PRIMARY =
  "rounded-lg border-2 border-accent bg-accent px-5 py-3 font-medium text-accent-contrast disabled:border-line disabled:bg-transparent disabled:text-muted";

/** Email sign-in: send a link and code, then accept either. */
export default function SignInCard() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function attempt(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(navigator.onLine ? (err as Error).message : "You're offline. Connect to sign in.");
    } finally {
      setBusy(false);
    }
  }

  function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    attempt(async () => {
      await sendSignInEmail(address);
      setSentTo(address);
      setCode("");
    });
  }

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    // Signing in updates the auth store; the page then swaps this card out.
    attempt(() => verifySignInCode(sentTo!, code.replace(/\s/g, "")));
  }

  return (
    <section id="sign-in" className="mt-8 rounded-xl border border-line bg-card p-5 sm:p-7">
      <h2 className="text-xl font-semibold sm:text-2xl">Sign in to create lesson plans</h2>

      {sentTo === null ? (
        <form onSubmit={sendEmail}>
          <p className="mt-1 text-muted">
            Enter your email. We&apos;ll send you a sign-in link and code, with no password needed.
            New teachers get an account automatically.
          </p>
          <label htmlFor="sign-in-email" className="mt-5 block font-medium">
            Email
          </label>
          <input
            id="sign-in-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.org"
            className={`${FIELD} mt-2`}
            required
          />
          <button disabled={busy || !email.trim()} className={`${PRIMARY} mt-4`}>
            {busy ? "Sending…" : "Email me a sign-in code"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode}>
          <p className="mt-1 text-muted">
            We sent an email to <strong className="text-foreground">{sentTo}</strong>. Click the
            link in it, or type the code here. Check your spam folder if it hasn&apos;t arrived.
          </p>
          <label htmlFor="sign-in-code" className="mt-5 block font-medium">
            Code from the email
          </label>
          <input
            id="sign-in-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            maxLength={12}
            className={`${FIELD} mt-2 text-lg tracking-widest`}
            required
          />
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button disabled={busy || code.replace(/\s/g, "").length < 6} className={PRIMARY}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setSentTo(null)}
              className="text-sm underline underline-offset-4"
            >
              Use a different email or resend
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-danger-bg p-3 text-sm text-danger-fg" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
