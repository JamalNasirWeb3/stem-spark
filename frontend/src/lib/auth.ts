// Teacher sign-in with Google through Supabase Auth.
// Exposed as an external store for useSyncExternalStore.
//
// Sign-in is on when NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
// are set at build time. The anon key is public by design: row-level security
// in supabase/schema.sql decides what each teacher can read and write.

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const authEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null =
  authEnabled && typeof window !== "undefined"
    ? createClient(url!, anonKey!, {
        auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true },
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
    // Drop the one-time ?code= from the address bar after Google sends the teacher back.
    if (session && new URLSearchParams(window.location.search).has("code")) {
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

export async function signInWithGoogle() {
  await supabase?.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/` },
  });
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
