import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveStatus } from "@/components/AutoSaveIndicator";

type Saver<T> = (value: T) => Promise<void> | void;

interface Options {
  /** Debounce delay in ms. Default 1500. */
  delay?: number;
  /** Warn the user via beforeunload while a save is pending. Default true. */
  warnOnUnload?: boolean;
  /** Force a flush when the tab is hidden. Default true. */
  flushOnHide?: boolean;
}

/**
 * Robust autosave primitive used across Creative Studio + Content Library.
 *
 * Why it exists:
 *   - The previous Creative Studio autosave cleared its pending timer in the
 *     effect cleanup, so navigating away within the 1.5s debounce window
 *     silently dropped the most recent edits ("disappear overnight"). This
 *     hook flushes pending writes on unmount, on tab hide, AND warns the user
 *     before navigation if a save is still in flight.
 *   - Content Library editing had no autosave at all — closing the dialog
 *     or hitting refresh threw away anything not explicitly saved.
 *
 * Usage:
 *   const { status, schedule, flush } = useAutosave(saver, { delay: 1500 });
 *   onChange={(v) => { setLocal(v); schedule(v); }}
 *   // Optional: await flush() before closing a dialog.
 */
export function useAutosave<T>(saver: Saver<T>, options: Options = {}) {
  const { delay = 1500, warnOnUnload = true, flushOnHide = true } = options;

  const [status, setStatus] = useState<SaveStatus>("idle");
  const saverRef = useRef(saver);
  saverRef.current = saver;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<T | null>(null);
  const hasPendingRef = useRef(false);
  const inFlightRef = useRef(false);
  const idleResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSave = useCallback(async () => {
    if (!hasPendingRef.current) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const value = pendingValueRef.current as T;
    hasPendingRef.current = false;
    inFlightRef.current = true;
    setStatus("saving");
    try {
      await saverRef.current(value);
      // If new edits arrived while saving, leave the new pending value alone;
      // status will be flipped back to "saving" by the next scheduled run.
      setStatus("saved");
      if (idleResetRef.current) clearTimeout(idleResetRef.current);
      idleResetRef.current = setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      // Re-queue the failed write so the next flush retries it.
      console.error("[useAutosave] save failed:", err);
      hasPendingRef.current = true;
      setStatus("error");
      if (idleResetRef.current) clearTimeout(idleResetRef.current);
      idleResetRef.current = setTimeout(() => setStatus("idle"), 4000);
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pendingValueRef.current = value;
      hasPendingRef.current = true;
      setStatus("saving");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void runSave();
      }, delay);
    },
    [delay, runSave],
  );

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (hasPendingRef.current) await runSave();
  }, [runSave]);

  // Flush on unmount so dropping the page (route change, modal close) never
  // discards a pending write.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (idleResetRef.current) clearTimeout(idleResetRef.current);
      if (hasPendingRef.current) {
        // Fire-and-forget; the React tree is already tearing down so we can't
        // await. The Supabase fetch will still be in-flight to the network.
        void runSave();
      }
    };
  }, [runSave]);

  // beforeunload + visibilitychange so closing the tab is safe.
  useEffect(() => {
    if (!warnOnUnload && !flushOnHide) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!warnOnUnload) return;
      if (hasPendingRef.current || inFlightRef.current) {
        // Try to flush synchronously; browsers no longer wait but the fetch
        // is dispatched and most often completes.
        void runSave();
        e.preventDefault();
        // Required for Chrome to actually show the prompt.
        e.returnValue = "";
      }
    };

    const onVisibility = () => {
      if (!flushOnHide) return;
      if (document.visibilityState === "hidden" && hasPendingRef.current) {
        void runSave();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [warnOnUnload, flushOnHide, runSave]);

  return { status, schedule, flush };
}

/**
 * Change-driven autosave: give it a value and a saver, and every user edit is
 * persisted automatically (debounced). The first render after a record loads
 * establishes the baseline, so hydrating a form never triggers a write.
 *
 * Pass `key` (e.g. the record id) so switching records re-baselines instead of
 * saving the newly-loaded record's values over the previous one.
 */
export function useAutosaveOnChange<T>(
  value: T,
  saver: Saver<T>,
  options: Options & { enabled?: boolean; key?: string | null } = {},
) {
  const { enabled = true, key = null, ...rest } = options;
  const { status, schedule, flush } = useAutosave<T>(saver, rest);

  const primedRef = useRef(false);
  const baselineRef = useRef<string>("");
  const keyRef = useRef<string | null>(key);

  // Re-baseline when the edited record changes.
  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key;
      primedRef.current = false;
    }
  }, [key]);

  const serialized = JSON.stringify(value ?? null);

  useEffect(() => {
    if (!enabled) return;
    if (!primedRef.current) {
      primedRef.current = true;
      baselineRef.current = serialized;
      return;
    }
    if (serialized === baselineRef.current) return;
    baselineRef.current = serialized;
    schedule(value);
    // `value` intentionally tracked through its serialization
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, enabled, schedule]);

  return { status, flush };
}

