import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Play, Trash2, Plus, Pencil } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAccount } from "../context/Account";
import { usePlayer } from "../context/Player";
import Dialog from "../components/Dialog";
import { StationLogo } from "../components/Stations";
import type { Station } from "../types";
type Collection = { id: string; name: string };
type Entry = { id: string; station_data: Station; position: number };
export default function Collections() {
  const { user, ready } = useAccount();
  const player = usePlayer();
  const [params, setParams] = useSearchParams();
  const selected = params.get("id");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [edit, setEdit] = useState<Collection | null>(null);
  const [remove, setRemove] = useState<Collection | null>(null);
  useEffect(() => {
    setCollections([]);
    setEntries([]);
    if (!user || !supabase) return;
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([
      supabase
        .from("collections")
        .select("id,name")
        .eq("user_id", user.id)
        .order("created_at"),
      selected
        ? supabase
            .from("collection_stations")
            .select("*")
            .eq("user_id", user.id)
            .eq("collection_id", selected)
            .order("position")
            .order("id")
        : Promise.resolve({ data: [], error: null }),
    ]).then(([groups, items]) => {
      if (!alive) return;
      if (groups.error || items.error)
        setError(
          "Your collections could not be loaded. Apply the database migration and try again.",
        );
      else {
        setCollections(groups.data || []);
        setEntries((items.data || []) as Entry[]);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [user?.id, selected, revision]);
  async function perform(action: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setError("");
    try {
      const { error } = await action();
      if (error) throw error;
      setRevision((value) => value + 1);
      return true;
    } catch {
      setError("Could not save your change. Refresh and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (!user || !supabase || !name.trim()) return;
    const ok = await perform(() =>
      supabase!
        .from("collections")
        .insert({ user_id: user.id, name: name.trim() }),
    );
    if (ok) setName("");
  }
  async function reorder(index: number, direction: number) {
    if (!supabase || !selected) return;
    const next = [...entries];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    await perform(() =>
      supabase!.rpc("reorder_collection", {
        p_collection: selected,
        p_ids: next.map((item) => item.id),
      }),
    );
  }
  if (!ready) return <div className="empty-state">Loading account...</div>;
  if (!user)
    return (
      <div className="empty-state">
        <h1>Your collections</h1>
        <p>Sign in to create a home for your favorite stations.</p>
        <Link className="button primary" to="/login">
          Sign in
        </Link>
      </div>
    );
  const current = collections.find((item) => item.id === selected);
  return (
    <>
      <section className="page-heading">
        <span className="eyebrow">YOUR STATIONS, YOUR ORDER</span>
        <h1>Collections</h1>
      </section>
      <form className="collection-create" onSubmit={create}>
        <label>
          New collection
          <input
            className="text-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
            placeholder="Morning news"
          />
        </label>
        <button className="button primary" disabled={busy || !name.trim()}>
          <Plus size={18} />
          Create
        </button>
      </form>
      {error && (
        <p className="inline-error" role="alert">
          {error}
          <button onClick={() => setRevision((value) => value + 1)}>
            Refresh
          </button>
        </p>
      )}
      <div className="collections-layout">
        <nav aria-label="Collections">
          {collections.map((collection) => (
            <button
              key={collection.id}
              className={`collection-nav ${selected === collection.id ? "active" : ""}`}
              onClick={() => setParams({ id: collection.id })}
            >
              {collection.name}
            </button>
          ))}
          {!loading && !collections.length && <p>No collections yet.</p>}
        </nav>
        <section>
          {loading ? (
            <p role="status">Loading collections...</p>
          ) : current ? (
            <>
              <div className="section-heading">
                <h2>{current.name}</h2>
                <div>
                  <button
                    className="icon-button"
                    title="Rename collection"
                    aria-label="Rename collection"
                    onClick={() => setEdit(current)}
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    className="icon-button"
                    title="Delete collection"
                    aria-label="Delete collection"
                    onClick={() => setRemove(current)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              {entries.map((entry, index) => (
                <div className="collection-entry" key={entry.id}>
                  <StationLogo station={entry.station_data} />
                  <Link to={`/station/${entry.station_data.stationuuid}`}>
                    {entry.station_data.name}
                  </Link>
                  <div className="entry-controls">
                    <button
                      className="icon-button"
                      title="Play station"
                      aria-label={`Play ${entry.station_data.name}`}
                      onClick={() => player.playStation(entry.station_data)}
                    >
                      <Play size={17} />
                    </button>
                    <button
                      className="icon-button"
                      title="Move up"
                      aria-label={`Move ${entry.station_data.name} up`}
                      disabled={busy || index === 0}
                      onClick={() => void reorder(index, -1)}
                    >
                      <ArrowUp size={17} />
                    </button>
                    <button
                      className="icon-button"
                      title="Move down"
                      aria-label={`Move ${entry.station_data.name} down`}
                      disabled={busy || index === entries.length - 1}
                      onClick={() => void reorder(index, 1)}
                    >
                      <ArrowDown size={17} />
                    </button>
                    <button
                      className="icon-button"
                      title="Remove station"
                      aria-label={`Remove ${entry.station_data.name}`}
                      disabled={busy}
                      onClick={() =>
                        void perform(() =>
                          supabase!
                            .from("collection_stations")
                            .delete()
                            .eq("id", entry.id)
                            .eq("user_id", user.id),
                        )
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              ))}
              {!entries.length && (
                <div className="empty-state">
                  <p>
                    This collection is empty. Add stations from their station
                    pages.
                  </p>
                  <Link className="button secondary" to="/browse">
                    Browse stations
                  </Link>
                </div>
              )}
            </>
          ) : (
            <p>Select a collection to see its stations.</p>
          )}
        </section>
      </div>
      {edit && (
        <Dialog title="Rename collection" onClose={() => setEdit(null)}>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                await perform(() =>
                  supabase!
                    .from("collections")
                    .update({ name: edit.name.trim() })
                    .eq("id", edit.id)
                    .eq("user_id", user.id),
                )
              )
                setEdit(null);
            }}
          >
            <label>
              Collection name
              <input
                className="text-input"
                value={edit.name}
                required
                maxLength={80}
                onChange={(event) =>
                  setEdit({ ...edit, name: event.target.value })
                }
              />
            </label>
            <button
              className="button primary"
              disabled={busy || !edit.name.trim()}
            >
              Save name
            </button>
          </form>
        </Dialog>
      )}
      {remove && (
        <Dialog title="Delete collection?" onClose={() => setRemove(null)}>
          <p>{remove.name} and its station list will be removed.</p>
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() => setRemove(null)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (
                  await perform(() =>
                    supabase!
                      .from("collections")
                      .delete()
                      .eq("id", remove.id)
                      .eq("user_id", user.id),
                  )
                ) {
                  setRemove(null);
                  setParams({});
                }
              }}
            >
              Delete collection
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
