"use client";

import { useState, useSyncExternalStore } from "react";

// Chrome and Edge (Android and desktop) fire `beforeinstallprompt` when the app
// can be installed. It isn't in the TypeScript DOM types yet.
type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallState = "available" | "ios" | "installed" | "unsupported";

// The event can fire before React mounts, so listen from module load instead of
// from an effect.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let justInstalled = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // show our button instead of Chrome's mini-infobar
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    justInstalled = true;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getState(): InstallState {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (justInstalled || standalone) return "installed";
  if (deferredPrompt) return "available";
  // Safari on iPhone and iPad has no install prompt; the teacher adds it by hand.
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return "ios";
  return "unsupported";
}

const BUTTON =
  "shrink-0 rounded-lg border-2 border-accent px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-contrast";

/** "Install app" button. Hidden when the app is already installed or the browser can't install it. */
export default function InstallButton() {
  const state = useSyncExternalStore(subscribe, getState, () => "unsupported" as const);
  const [showIosSteps, setShowIosSteps] = useState(false);

  async function install() {
    const prompt = deferredPrompt;
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    // A prompt event can only be used once. Chrome fires a new one if the teacher dismissed it.
    deferredPrompt = null;
    notify();
  }

  if (state === "available") {
    return (
      <button type="button" onClick={install} className={BUTTON}>
        Install app
      </button>
    );
  }

  if (state === "ios") {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowIosSteps((v) => !v)}
          aria-expanded={showIosSteps}
          className={BUTTON}
        >
          Install app
        </button>
        {showIosSteps && (
          <p className="absolute right-0 z-10 mt-2 w-60 rounded-lg border border-line bg-card p-3 text-sm shadow-lg">
            In Safari, tap the <strong>Share</strong> button, then{" "}
            <strong>Add to Home Screen</strong>.
          </p>
        )}
      </div>
    );
  }

  return null;
}
