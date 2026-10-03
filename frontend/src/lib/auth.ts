// Teacher sign-in by email through Supabase Auth. The email carries a sign-in
// link and a one-time code; the code also works when the email is opened on
// another device or the link opens outside the installed app.
// Exposed as an external store for useSyncExternalStore.
//
// Sign-in is on when NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
// are set at build time. The anon key is public by design: row-level security
// in supabase/schema.sql decides what each teacher can read and write.

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

const url = projectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const authEnabled = Boolean(url && anonKey);

// Keeps only https://<project>.supabase.co, so a pasted callback or dashboard
// URL (".../auth/v1/callback") still works.
function projectUrl(raw: string | undefined): string | undefined {
  const value = raw?.trim().replace(/^["']|["']$/g, "");
  if (!value) return undefined;
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).origin;
  } catch {
    return undefined;
  }
}

export const supabase: SupabaseClient | null =
  authEnabled && typeof window !== "undefined"
    ? createClient(url!, anonKey!, {
        // Implicit flow: the emailed link signs the teacher in on whichever device
        // opens it (PKCE links only work in the browser that requested them).
        auth: { flowType: "implicit", persistSession: true, detectSessionInUrl: true },
      })
    : null;

export type AuthState =
  { status: "loading" } | { status: "signed_out" } | { status: "signed_in"; session: Session };

const LOADING: AuthState = { status: "loading" };
const SIGNED_OUT: AuthState = { status: "signed_out" };

let state: AuthState = authEnabled ? LOADING : SIGNED_OUT;
const listeners = new Set<() => void>();

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    state = session ? { status: "signed_in", session } : SIGNED_OUT;
    listeners.forEach((l) => l());
    // Drop sign-in tokens from the address bar after an emailed link brings the teacher back.
    if (session && /access_token|error_description/.test(window.location.hash)) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  });
}

export function getAuthState(): AuthState {
  return state;
}

export function getServerAuthState(): AuthState {
  return authEnabled ? LOADING : SIGNED_OUT;
}

export function subscribeAuth(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Turns Supabase errors into something a teacher can act on. */
function friendly(error: { message: string; status?: number }): string {
  if (error.status === 429 || /rate limit|too many/i.test(error.message)) {
    return "Too many sign-in emails were sent. Please wait a few minutes and try again.";
  }
  if (/expired|invalid/i.test(error.message)) {
    return "That code is wrong or has expired. Check the latest email, or send a new one.";
  }
  return error.message;
}

/** Emails a sign-in link and code. New teachers get an account automatically. */
export async function sendSignInEmail(email: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/`, shouldCreateUser: true },
  });
  if (error) throw new Error(friendly(error));
}

/** Signs in with the one-time code from the email. */
export async function verifySignInCode(email: string, code: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) throw new Error(friendly(error));
}

export async function signOut() {
  await supabase?.auth.signOut();
}

/** The current session's access token, refreshed if it has expired. */
export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
