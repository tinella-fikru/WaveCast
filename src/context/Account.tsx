import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { fromSaved, type SavedStation, type Station } from "../types";

type AccountState = {
  user: User | null;
  ready: boolean;
  favorites: Station[];
  recent: Station[];
  libraryLoading: boolean;
  libraryError: string;
  refreshLibrary: () => Promise<void>;
  toggleFavorite: (station: Station) => Promise<void>;
  recordRecent: (station: Station) => Promise<void>;
  signOut: () => Promise<void>;
};

const AccountContext = createContext<AccountState | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [favorites, setFavorites] = useState<Station[]>([]);
  const [recent, setRecent] = useState<Station[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const currentUser = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) {
        currentUser.current = session?.user.id;
        setUser(session?.user ?? null);
        setReady(true);
      }
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (alive && !error) {
          currentUser.current = data.session?.user.id;
          setUser(data.session?.user ?? null);
        }
        if (alive) setReady(true);
      })
      .catch(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  async function refreshLibrary() {
    if (!supabase || !user) return;
    const userId = user.id;
    setLibraryLoading(true);
    setLibraryError("");
    try {
      const [saved, history] = await Promise.all([
        supabase
          .from("favorites")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("recently_played")
          .select("*")
          .eq("user_id", userId)
          .order("played_at", { ascending: false })
          .limit(20),
      ]);
      if (saved.error || history.error) throw saved.error ?? history.error;
      if (currentUser.current !== userId) return;
      setFavorites(
        (saved.data as SavedStation[])
          .map(fromSaved)
          .filter((station) => station.url_resolved.startsWith("https://")),
      );
      setRecent(
        (history.data as SavedStation[])
          .map(fromSaved)
          .filter((station) => station.url_resolved.startsWith("https://")),
      );
    } catch {
      if (currentUser.current === userId)
        setLibraryError("Your library could not be loaded. Please try again.");
    } finally {
      if (currentUser.current === userId) setLibraryLoading(false);
    }
  }

  useEffect(() => {
    setFavorites([]);
    setRecent([]);
    setLibraryError("");
    setLibraryLoading(false);
    void refreshLibrary();
  }, [user?.id]);

  async function toggleFavorite(station: Station) {
    if (!supabase || !user)
      throw new Error("Sign in to save your favorite stations.");
    const userId = user.id;
    const exists = favorites.some(
      (item) => item.stationuuid === station.stationuuid,
    );
    const { error } = exists
      ? await supabase
          .from("favorites")
          .delete()
          .eq("user_id", userId)
          .eq("station_uuid", station.stationuuid)
      : await supabase
          .from("favorites")
          .upsert(
            {
              user_id: userId,
              station_uuid: station.stationuuid,
              station_name: station.name,
              station_favicon: station.favicon,
              station_url: station.url_resolved,
            },
            { onConflict: "user_id,station_uuid" },
          );
    if (error)
      throw new Error("Could not update your favorites. Please try again.");
    if (currentUser.current === userId)
      setFavorites((previous) =>
        exists
          ? previous.filter((item) => item.stationuuid !== station.stationuuid)
          : [
              station,
              ...previous.filter(
                (item) => item.stationuuid !== station.stationuuid,
              ),
            ],
      );
  }

  async function recordRecent(station: Station) {
    if (!supabase || !user) return;
    const userId = user.id;
    const { error } = await supabase.rpc("record_recent_station", {
      p_station_uuid: station.stationuuid,
      p_station_name: station.name,
      p_station_favicon: station.favicon,
      p_station_url: station.url_resolved,
    });
    if (currentUser.current !== userId) return;
    if (error) {
      setLibraryError(
        "Listening history could not be saved. Please try again later.",
      );
      return;
    }
    setRecent((previous) =>
      [
        station,
        ...previous.filter((item) => item.stationuuid !== station.stationuuid),
      ].slice(0, 20),
    );
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error("Could not sign out. Please try again.");
  }

  return (
    <AccountContext.Provider
      value={{
        user,
        ready,
        favorites,
        recent,
        libraryLoading,
        libraryError,
        refreshLibrary,
        toggleFavorite,
        recordRecent,
        signOut,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("AccountProvider is required");
  return context;
}
