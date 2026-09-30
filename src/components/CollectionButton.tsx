import { useEffect, useState } from "react";
import { FolderPlus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAccount } from "../context/Account";
import { supabase } from "../lib/supabase";
import type { Station } from "../types";
import Dialog from "./Dialog";
export default function CollectionButton({ station }: { station: Station }) {
  const { user } = useAccount();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open || !user || !supabase) return;
    let alive = true;
    setLoading(true);
    setError("");
    supabase
      .from("collections")
      .select("id,name")
      .eq("user_id", user.id)
      .order("created_at")
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setError("Collections could not be loaded.");
        else setCollections(data || []);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, user?.id, retry]);
  async function add(id: string) {
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.rpc("add_collection_station", {
        p_collection: id,
        p_station: station,
      });
      if (error) throw error;
      setOpen(false);
    } catch {
      setError("Could not add this station. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="icon-button"
        title="Add to collection"
        aria-label={`Add ${station.name} to collection`}
        onClick={() => (user ? setOpen(true) : navigate("/login"))}
      >
        <FolderPlus size={18} />
      </button>
      {open && (
        <Dialog title="Add to collection" onClose={() => setOpen(false)}>
          {loading ? (
            <p role="status">Loading collections...</p>
          ) : (
            collections.map((collection) => (
              <button
                className="similar-row"
                key={collection.id}
                disabled={busy}
                onClick={() => void add(collection.id)}
              >
                {collection.name}
              </button>
            ))
          )}
          {!loading && !collections.length && !error && (
            <p>No collections yet.</p>
          )}
          {error && (
            <p role="alert">
              {error}
              <button
                className="text-button"
                onClick={() => setRetry((value) => value + 1)}
              >
                Retry
              </button>
            </p>
          )}
          <Link
            className="button secondary"
            to="/collections"
            onClick={() => setOpen(false)}
          >
            Manage collections
          </Link>
        </Dialog>
      )}
    </>
  );
}
