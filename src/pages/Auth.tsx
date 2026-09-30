import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  AudioLines,
  Eye,
  EyeOff,
  Headphones,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { useAccount } from "../context/Account";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const { user, ready } = useAccount();
  const [params, setParams] = useSearchParams();
  const signup = params.get("mode") === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (ready && user) return <Navigate to="/favorites" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!supabase) {
      setError(
        "Account services are not connected yet. You can still listen as a guest.",
      );
      return;
    }
    setBusy(true);
    try {
      const response = signup
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          })
        : await supabase.auth.signInWithPassword({ email, password });
      if (response.error) throw response.error;
      if (signup && !response.data.session)
        setMessage("Check your inbox to confirm your email, then sign in.");
    } catch (reason) {
      setError(
        (reason as Error).message || "Could not connect. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-visual">
        <AudioLines size={40} />
        <span className="eyebrow">YOUR WORLD. YOUR SOUND.</span>
        <h2>
          Good radio
          <br />
          finds a home.
        </h2>
        <p>
          Keep your favorite frequencies close.
          <br />
          Let the rest of the world surprise you.
        </p>
        <span className="auth-live">
          <span /> ALWAYS SOMETHING ON AIR
        </span>
      </div>
      <div className="auth-form-container">
        <span className="auth-icon">
          <Headphones size={27} />
        </span>
        <h1>{signup ? "Find your people." : "Welcome back."}</h1>
        <p>
          {signup
            ? "Your own little corner of the airwaves."
            : "Your favorite sounds are waiting."}
        </p>
        <div className="auth-tabs">
          <button
            className={!signup ? "active" : ""}
            onClick={() => {
              setParams({});
              setError("");
              setMessage("");
            }}
          >
            Sign in
          </button>
          <button
            className={signup ? "active" : ""}
            onClick={() => {
              setParams({ mode: "signup" });
              setError("");
              setMessage("");
            }}
          >
            Create account
          </button>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <div className="auth-input">
            <Mail size={18} />
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <label htmlFor="password">Password</label>
          <div className="auth-input">
            <LockKeyhole size={18} />
            <input
              id="password"
              type={visible ? "text" : "password"}
              autoComplete={signup ? "new-password" : "current-password"}
              required
              minLength={signup ? 8 : 1}
              placeholder={signup ? "At least 8 characters" : "Your password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="icon-button"
              aria-label={visible ? "Hide password" : "Show password"}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && (
            <p className="auth-message error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="auth-message success" role="status">
              {message}
            </p>
          )}
          <button
            type="submit"
            className="button primary auth-submit"
            disabled={busy}
          >
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <>
                {signup ? "Create account" : "Sign in"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
        <div className="auth-divider">
          <span />
          or just tune in
          <span />
        </div>
        <Link to="/" className="button secondary guest-button">
          Continue as guest <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
