"use client";

import { RoomEvent, Track, type LocalAudioTrack, type Room } from "livekit-client";
import { useEffect, useState, useSyncExternalStore } from "react";

const NARROW = "(max-width: 767px)";

/** Phone-sized screens get the portrait layout (PLAN §6). */
export function useNarrow() {
  return useSyncExternalStore(
    (on) => {
      const m = matchMedia(NARROW);
      m.addEventListener("change", on);
      return () => m.removeEventListener("change", on);
    },
    () => matchMedia(NARROW).matches,
    () => false,
  );
}

/** An element's size, kept up to date. Pass the returned setter as the element's `ref`. */
export function useBoxSize<T extends Element>() {
  const [el, setEl] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return [setEl, size] as const;
}

/** Ticks every `ms` milliseconds, for clocks and timers. */
export function useNow(ms = 15_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Keeps the screen on while the room is open (re-taken when the tab comes back). */
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const take = () => {
      if (document.visibilityState === "visible")
        navigator.wakeLock
          .request("screen")
          .then((l) => (lock = l))
          .catch(() => {});
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      document.removeEventListener("visibilitychange", take);
      lock?.release().catch(() => {});
    };
  }, []);
}

/**
 * Audio-only mode for weak networks: stops receiving everyone's camera and screen video
 * (and keeps it stopped for people who join later), while audio carries on.
 */
export function useAudioOnly(room: Room, on: boolean) {
  useEffect(() => {
    const apply = () => {
      for (const p of room.remoteParticipants.values())
        for (const pub of p.trackPublications.values())
          if (pub.kind === Track.Kind.Video) pub.setSubscribed(!on);
    };
    apply();
    room.on(RoomEvent.TrackPublished, apply);
    return () => {
      room.off(RoomEvent.TrackPublished, apply);
    };
  }, [room, on]);
}

/** The microphone's loudness (0–1), sampled about ten times a second. */
export function useMicLevel(track: LocalAudioTrack | undefined) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!track) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack])).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const id = setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
      setLevel(Math.min(1, peak * 2.5));
    }, 100);
    return () => {
      clearInterval(id);
      ctx.close().catch(() => {});
      setLevel(0);
    };
  }, [track]);
  return level;
}

/** A short, soft two-note chime through the chosen speaker, to test the sound. */
export async function playTestSound(sinkId?: string) {
  const ctx = new AudioContext();
  const withSink = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
  if (sinkId && withSink.setSinkId) await withSink.setSinkId(sinkId).catch(() => {});
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  [523.25, 659.25].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    osc.connect(gain);
    const start = ctx.currentTime + i * 0.35;
    gain.gain.setValueAtTime(0.2, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
    osc.start(start);
    osc.stop(start + 0.32);
  });
  setTimeout(() => ctx.close().catch(() => {}), 1200);
}

/**
 * Capture size in the screen's orientation. An upright phone gets 3:4, its sensor's own shape:
 * anything narrower (9:16) makes the browser crop the sides, which looks zoomed in.
 */
export const captureSize = (width: number, height: number) =>
  typeof matchMedia !== "undefined" && matchMedia("(orientation: portrait)").matches
    ? { width: height, height: Math.round((height * 4) / 3) }
    : { width, height };

/** A steady avatar colour per person, readable with white initials. */
const AVATAR = ["#0e7c7f", "#5b4bb0", "#c2417a", "#3f6fd8", "#a64916", "#1f7a4d"];
export const avatarColor = (id: string) =>
  AVATAR[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR.length];
