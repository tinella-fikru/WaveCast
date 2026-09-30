import { useEffect, useRef } from "react";
import { driver, type Driver } from "driver.js";
import { useLocation } from "react-router-dom";
import { useAccount } from "../context/Account";
import { readPreference, writePreference } from "../lib/storage";
import { supabase } from "../lib/supabase";

export default function Tour({ replay }: { replay: number }) {
  const { user, ready } = useAccount();
  const location = useLocation();
  const tour = useRef<Driver | null>(null);
  const lastReplay = useRef(replay);

  useEffect(() => {
    if (!ready || location.pathname !== "/") return;
    const key = `wavecast-tour-${user?.id ?? "guest"}`;
    const requested = replay !== lastReplay.current;
    lastReplay.current = replay;
    if (
      !requested &&
      (readPreference(key) === "done" || user?.user_metadata.wavecast_onboarded)
    )
      return;
    const timeout = window.setTimeout(
      () => {
        tour.current = driver({
          showProgress: true,
          animate: !window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches,
          overlayColor: "#050b09",
          overlayOpacity: 0.72,
          stagePadding: 6,
          stageRadius: 8,
          popoverClass: "wavecast-tour",
          nextBtnText: "Next",
          prevBtnText: "Back",
          doneBtnText: "Start listening",
          steps: [
            {
              element: '[data-tour="search"]',
              popover: {
                title: "Find your frequency",
                description:
                  "Search for a station, a city, or a sound you love.",
                side: "bottom",
              },
            },
            {
              element: '[data-tour="filters"]',
              popover: {
                title: "Follow your mood",
                description:
                  "Start with a genre. Browse has country and language filters, too.",
                side: "bottom",
              },
            },
            {
              element: '[data-tour="favorite"]',
              popover: {
                title: "Keep the good ones",
                description:
                  "Tap a heart to save a station. Sign in to keep your favorites with you.",
                side: "bottom",
              },
            },
            {
              element: '[data-tour="player"]',
              popover: {
                title: "Stay tuned",
                description:
                  "Your station keeps playing as you explore. Adjust the volume or set a sleep timer here.",
                side: "top",
              },
            },
          ],
          onDestroyed: () => {
            writePreference(key, "done");
            if (user && supabase)
              void supabase.auth.updateUser({
                data: { wavecast_onboarded: true },
              });
          },
        });
        tour.current.drive();
      },
      requested ? 150 : 1600,
    );
    return () => {
      window.clearTimeout(timeout);
      tour.current?.destroy();
      tour.current = null;
    };
  }, [ready, user?.id, replay, location.pathname]);
  return null;
}
