import { useEffect, useState } from "react";
import { Download, WifiOff } from "lucide-react";

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const available = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const installed = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  if (!prompt) return null;
  return (
    <button
      className="icon-button"
      title="Install WaveCast"
      aria-label="Install WaveCast"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await prompt.prompt();
          await prompt.userChoice;
        } catch {
          setPrompt(null);
        } finally {
          setPrompt(null);
          setBusy(false);
        }
      }}
    >
      <Download size={19} />
    </button>
  );
}

export function OfflineNotice() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline ? (
    <div className="inline-error" role="status">
      <WifiOff size={18} /> You're offline, reconnect to keep listening
    </div>
  ) : null;
}
