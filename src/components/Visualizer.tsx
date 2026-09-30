import { useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";
import { usePlayer } from "../context/Player";
import { Equalizer } from "./Stations";

export default function Visualizer() {
  const player = usePlayer();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const context = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (
      !enabled ||
      player.status !== "playing" ||
      !player.station ||
      !canvas.current ||
      !context.current
    ) {
      setAnalysing(false);
      return;
    }
    const audioContext = context.current;
    const element = new Audio();
    element.crossOrigin = "anonymous";
    element.src = player.station.url_resolved;
    const source = audioContext.createMediaElementSource(element);
    const analyser = audioContext.createAnalyser();
    const gain = audioContext.createGain();
    analyser.fftSize = 128;
    gain.gain.value = 0;
    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(audioContext.destination);
    const values = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    let alive = true;
    const stopAnalysis = () => {
      if (!alive) return;
      setAnalysing(false);
      element.pause();
      element.removeAttribute("src");
      element.load();
      cancelAnimationFrame(frame);
    };
    const timeout = window.setTimeout(() => {
      if (element.readyState < 3) stopAnalysis();
    }, 10000);
    element.onerror = stopAnalysis;
    void element.play().catch(stopAnalysis);
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    function draw() {
      if (!alive) return;
      analyser.getByteFrequencyData(values);
      const hasSignal = values.some((value) => value > 0);
      setAnalysing(hasSignal);
      const drawing = canvas.current?.getContext("2d");
      if (drawing) {
        drawing.clearRect(0, 0, 160, 48);
        drawing.fillStyle = getComputedStyle(
          document.documentElement,
        ).getPropertyValue("--accent");
        for (let index = 0; index < 20; index++) {
          const height = reduced
            ? 8
            : Math.max(2, (values[index * 2] / 255) * 44);
          drawing.fillRect(index * 8, 48 - height, 5, height);
        }
      }
      frame = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      alive = false;
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
      element.onerror = null;
      element.pause();
      element.removeAttribute("src");
      element.load();
      source.disconnect();
      analyser.disconnect();
      gain.disconnect();
      setAnalysing(false);
    };
  }, [enabled, player.status, player.station]);
  useEffect(
    () => () => {
      void context.current?.close();
    },
    [],
  );
  return (
    <div className="visualizer">
      <button
        className={`icon-button ${enabled ? "visualizer-on" : ""}`}
        aria-label="Audio visualizer"
        title="Toggle audio visualizer"
        aria-pressed={enabled}
        onClick={() => {
          if (!enabled) {
            try {
              context.current ||= new AudioContext();
              void context.current.resume().catch(() => undefined);
            } catch {
              return;
            }
          }
          setEnabled(!enabled);
        }}
      >
        <Activity size={18} />
      </button>
      <div className="visualizer-display">
        <canvas
          ref={canvas}
          width="160"
          height="48"
          aria-label="Live audio spectrum"
          hidden={!analysing}
        />
        {!analysing && player.status === "playing" && <Equalizer />}
      </div>
    </div>
  );
}
