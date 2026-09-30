import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Clock3, Flame, CalendarDays } from "lucide-react";
import { useAccount } from "../context/Account";
import { supabase } from "../lib/supabase";
import { summarizeSessions } from "../lib/insights.js";
type Session = {
  seconds: number;
  country: string;
  tags: string;
  started_at: string;
};
function ListeningChart({
  title,
  data,
}: {
  title: string;
  data: Array<{ name: string; minutes: number }>;
}) {
  return (
    <section className="insight-chart">
      <h2>{title}</h2>
      <div className="chart-frame" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 0, right: 24 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              type="number"
              unit="m"
              tick={{ fill: "var(--muted)", fontSize: 11 }}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={100}
              tick={{ fill: "var(--text)", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            />
            <Bar
              dataKey="minutes"
              name="Minutes"
              fill="var(--accent)"
              radius={[0, 3, 3, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="insight-table">
        <caption className="sr-only">{title} in minutes</caption>
        <thead>
          <tr>
            <th scope="col">{title}</th>
            <th scope="col">Minutes</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.name}>
              <th scope="row">{row.name}</th>
              <td>{row.minutes.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
export default function Insights() {
  const { user, ready } = useAccount();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setSessions([]);
    if (!user || !supabase) return;
    let alive = true;
    setLoading(true);
    setError("");
    const client = supabase;
    void (async () => {
      try {
        const rows: Session[] = [];
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await client
            .from("listening_sessions")
            .select("seconds,country,tags,started_at")
            .eq("user_id", user.id)
            .order("started_at", { ascending: false })
            .order("id")
            .range(offset, offset + 999);
          if (error) throw error;
          if (!alive) return;
          rows.push(...(data || []));
          if (!data || data.length < 1000) break;
        }
        setSessions(rows);
      } catch {
        if (alive)
          setError(
            "Listening insights could not be loaded. Apply the database migration and try again.",
          );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id, retry]);
  if (!ready) return <div className="empty-state">Loading account...</div>;
  if (!user)
    return (
      <div className="empty-state">
        <h1>Your listening story</h1>
        <p>
          Sign in to track listening time, favorite sounds, and your streak.
        </p>
        <Link className="button primary" to="/login">
          Sign in
        </Link>
      </div>
    );
  const summary = summarizeSessions(sessions);
  return (
    <>
      <section className="page-heading">
        <span className="eyebrow">YOUR PERSONAL AIRWAVES</span>
        <h1>Listening insights</h1>
        <p>All-time listening. Streaks use UTC calendar days.</p>
      </section>
      <button
        className="button secondary"
        disabled={loading}
        onClick={() => setRetry((value) => value + 1)}
      >
        Refresh insights
      </button>
      {loading ? (
        <div className="empty-state" role="status">
          Loading insights...
        </div>
      ) : error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : !sessions.length ? (
        <div className="empty-state">
          <h2>Your story starts with a station</h2>
          <p>
            Listening time appears after at least 30 seconds of playback or when
            you pause.
          </p>
          <Link to="/browse" className="button primary">
            Explore stations
          </Link>
        </div>
      ) : (
        <>
          <div className="insight-totals">
            <div>
              <Clock3 />
              <strong>
                {Math.floor(summary.seconds / 3600)}h{" "}
                {Math.floor((summary.seconds % 3600) / 60)}m
              </strong>
              <span>Total listening</span>
            </div>
            <div>
              <Flame />
              <strong>{summary.streak}</strong>
              <span>Day streak</span>
            </div>
            <div>
              <CalendarDays />
              <strong>{summary.days}</strong>
              <span>Days tuned in</span>
            </div>
          </div>
          <div className="insight-charts">
            <ListeningChart title="Top genres" data={summary.genres} />
            <ListeningChart title="Top countries" data={summary.countries} />
          </div>
        </>
      )}
    </>
  );
}
