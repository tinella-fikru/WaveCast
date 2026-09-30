import { useEffect, useState } from "react";
import { useAccount } from "../context/Account";
import { usePlayer } from "../context/Player";
import { supabase } from "../lib/supabase";
import { elapsedListening } from "../lib/insights.js";

export default function ListeningTracker() {
  const { user } = useAccount();
  const { station, status } = usePlayer();
  const [error, setError] = useState(false);
  useEffect(() => {
    setError(false);
    if (!user || !station || status !== "playing" || !supabase) return;
    const client = supabase;
    const userId = user.id;
    let sessionId = crypto.randomUUID(),
      started = new Date().toISOString(),
      seconds = 0,
      last = performance.now(),
      saved = 0,
      nextFlush = 30,
      day = new Date().toISOString().slice(0, 10);
    async function flush() {
      const duration = Math.floor(seconds),
        id = sessionId,
        start = started;
      if (duration < 1 || duration <= saved) return;
      nextFlush = seconds + 30;
      try {
        const { data } = await client.auth.getSession();
        if (data.session?.user.id !== userId) return;
        const { error } = await client.rpc("record_listening_session", {
          p_id: id,
          p_station_uuid: station!.stationuuid,
          p_station_name: station!.name,
          p_country: station!.country,
          p_tags: station!.tags,
          p_started_at: start,
          p_seconds: duration,
        });
        if (error) setError(true);
        else {
          if (id === sessionId) saved = Math.max(saved, duration);
          setError(false);
        }
      } catch {
        setError(true);
      }
    }
    function tick() {
      const now = performance.now();
      seconds += elapsedListening(last, now);
      last = now;
    }
    const interval = window.setInterval(() => {
      tick();
      const today = new Date().toISOString().slice(0, 10);
      if (today !== day) {
        void flush();
        sessionId = crypto.randomUUID();
        started = new Date().toISOString();
        seconds = 0;
        saved = 0;
        nextFlush = 30;
        day = today;
      } else if (seconds >= nextFlush) void flush();
    }, 1000);
    const leaving = () => {
      tick();
      void flush();
    };
    window.addEventListener("pagehide", leaving);
    return () => {
      clearInterval(interval);
      window.removeEventListener("pagehide", leaving);
      tick();
      void flush();
    };
  }, [user?.id, station, status]);
  return error ? (
    <span className="tracking-notice" role="status">
      Listening stats could not be saved. Playback is unaffected.
    </span>
  ) : null;
}
