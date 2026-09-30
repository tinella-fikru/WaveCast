import { lazy, Suspense, useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowUpRight,
  AudioLines,
  Compass,
  Globe2,
  Heart,
  HelpCircle,
  History,
  Home,
  LogOut,
  Moon,
  Radio,
  Sun,
} from "lucide-react";
import Discover from "./pages/Discover";
import Library from "./pages/Library";
import Auth from "./pages/Auth";
import PlayerBar from "./components/PlayerBar";
import Tour from "./components/Tour";
import { useAccount } from "./context/Account";
import { readPreference, writePreference } from "./lib/storage";

const Countries = lazy(() => import("./pages/Countries"));

export default function App() {
  const { user, signOut } = useAccount();
  const [light, setLight] = useState(
    () => readPreference("wavecast-theme", "dark") === "light",
  );
  const [tourReplay, setTourReplay] = useState(0);
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const title = location.pathname.startsWith("/countries")
    ? "Explore by Country"
    : location.pathname === "/browse"
      ? "Browse stations"
      : location.pathname === "/favorites"
        ? "Your favorites"
        : location.pathname === "/recent"
          ? "Recently played"
          : location.pathname === "/login"
            ? "Your account"
            : "Discover";

  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
    writePreference("wavecast-theme", light ? "light" : "dark");
  }, [light]);
  useEffect(() => {
    document.title = `${title} - WaveCast`;
    window.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [location.pathname, title]);

  async function logout() {
    try {
      await signOut();
      navigate("/");
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand" aria-label="WaveCast home">
          <span className="brand-mark">
            <AudioLines size={26} />
          </span>
          WaveCast<span className="brand-dot">.</span>
        </Link>
        <span className="nav-caption">YOUR DAILY DISCOVERY</span>
        <nav className="main-nav" aria-label="Main navigation">
          <NavLink to="/" end>
            <Home size={19} />
            <span>Discover</span>
          </NavLink>
          <NavLink
            to="/browse"
            aria-label="Browse stations"
            title="Browse stations"
          >
            <Compass size={19} />
            <span>Browse stations</span>
          </NavLink>
          <NavLink
            to="/countries"
            aria-label="Explore by Country"
            title="Explore by Country"
          >
            <Globe2 size={19} />
            <span>Explore by Country</span>
          </NavLink>
          <span className="nav-caption library-caption">YOUR LIBRARY</span>
          <NavLink to="/favorites">
            <Heart size={19} />
            <span>Favorites</span>
          </NavLink>
          <NavLink to="/recent" aria-label="Recently played">
            <History size={19} />
            <span>Recently played</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-message">
            <span className="tiny-wave">
              <AudioLines size={28} />
            </span>
            <strong>A world worth listening to.</strong>
            <p>
              Turn down the noise.
              <br />
              Turn up the world.
            </p>
            <Link to="/browse">
              Let's explore <ArrowUpRight size={15} />
            </Link>
          </div>
          <button
            className="tour-button"
            onClick={() => {
              navigate("/");
              setTourReplay((value) => value + 1);
            }}
          >
            <HelpCircle size={17} /> Take a quick tour
          </button>
          <div className="sidebar-status">
            <span /> ALL EARS, ALL HOURS
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="page-breadcrumb">
            <span className="mobile-brand">
              <AudioLines size={23} /> WaveCast
            </span>
            <span className="desktop-title">{title}</span>
          </div>
          <div className="header-actions">
            <span className="global-live">
              <Globe2 size={15} /> A whole world, live
            </span>
            <span className="header-divider" />
            <button
              className="icon-button theme-toggle"
              onClick={() => setLight(!light)}
              title={light ? "Switch to dark mode" : "Switch to light mode"}
              aria-label={
                light ? "Switch to dark mode" : "Switch to light mode"
              }
            >
              {light ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            {user ? (
              <>
                <span className="user-name" title={user.email}>
                  {user.email?.split("@")[0]}
                </span>
                <button
                  className="icon-button"
                  onClick={logout}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link className="header-signin" to="/login">
                Sign in <ArrowUpRight size={15} />
              </Link>
            )}
          </div>
        </header>
        {error && (
          <div className="inline-error" role="alert">
            {error}
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<Discover />} />
            <Route path="/browse" element={<Discover browse />} />
            <Route
              path="/countries"
              element={
                <Suspense
                  fallback={
                    <div className="empty-state" role="status">
                      Loading country explorer...
                    </div>
                  }
                >
                  <Countries />
                </Suspense>
              }
            />
            <Route
              path="/countries/:countryName"
              element={<Discover browse />}
            />
            <Route path="/favorites" element={<Library />} />
            <Route path="/recent" element={<Library recent />} />
            <Route path="/login" element={<Auth />} />
            <Route
              path="*"
              element={
                <div className="empty-state">
                  <Radio size={36} />
                  <h1>Off the dial</h1>
                  <p>This page could not be found.</p>
                  <Link className="button primary" to="/">
                    Back to Discover
                  </Link>
                </div>
              }
            />
          </Routes>
        </main>
        <footer className="site-footer">
          <span className="footer-brand">
            <AudioLines size={18} /> WaveCast
          </span>
          <p>
            Streams are provided by the stations. Station data from{" "}
            <a
              href="https://www.radio-browser.info/"
              target="_blank"
              rel="noreferrer"
            >
              Radio Browser
            </a>
            .
          </p>
          <span>Made for curious ears.</span>
        </footer>
      </div>
      <PlayerBar />
      <Tour replay={tourReplay} />
    </div>
  );
}
