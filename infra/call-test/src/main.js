// M0 call test client: joins the test room, shows everyone's video and which network path each
// person's connection uses (UDP, TCP, TURN/UDP, TURN/TLS), and reports it to the server.
import { Room, RoomEvent, Track, VideoPresets } from "livekit-client";

// Every peer connection LiveKit opens goes through here, so we can read which ICE path won and,
// in "Force TURN/TLS" mode, offer only the TURN/TLS server (port 443) and relayed candidates.
const peerConnections = new Set();
let forceTls = false;
const NativePeerConnection = window.RTCPeerConnection;
window.RTCPeerConnection = class extends NativePeerConnection {
  constructor(config = {}, ...rest) {
    if (forceTls) {
      const iceServers = (config.iceServers ?? [])
        .map((s) => ({ ...s, urls: [s.urls].flat().filter((u) => u.startsWith("turns:")) }))
        .filter((s) => s.urls.length > 0);
      config = { ...config, iceServers, iceTransportPolicy: "relay" };
    }
    super(config, ...rest);
    peerConnections.add(this);
    this.addEventListener("connectionstatechange", () => {
      if (this.connectionState === "closed") peerConnections.delete(this);
    });
  }
};

/** The network path ICE selected, e.g. { path: "TURN/TLS", rttMs: 84 }, or null. */
async function selectedPath() {
  for (const pc of peerConnections) {
    const stats = await pc.getStats();
    let pair;
    stats.forEach((r) => {
      if (r.type === "transport" && r.selectedCandidatePairId) pair = stats.get(r.selectedCandidatePairId);
    });
    if (!pair)
      stats.forEach((r) => {
        if (r.type === "candidate-pair" && r.nominated && r.state === "succeeded") pair = r;
      });
    const local = pair && stats.get(pair.localCandidateId);
    if (!local) continue;
    const path =
      local.candidateType === "relay"
        ? `TURN/${(local.relayProtocol ?? "?").toUpperCase()}`
        : (local.protocol ?? "?").toUpperCase();
    const rttMs = pair.currentRoundTripTime ? Math.round(pair.currentRoundTripTime * 1000) : null;
    return { path, rttMs };
  }
  return null;
}

const $ = (id) => document.getElementById(id);
const form = $("join-form");
const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: just don't remember */
    }
  },
};
form.elements.name.value = store.get("call-test-name") ?? "";
form.elements.network.value = store.get("call-test-network") ?? "";

let room;
let tester;
let joinedAt = 0;
let reconnects = 0;
let lastPath = null;
let statsTimer;

function report(event, extra = {}) {
  const body = JSON.stringify({
    event,
    ...tester,
    path: lastPath?.path ?? "",
    rttMs: lastPath?.rttMs ?? null,
    seconds: joinedAt ? Math.round((Date.now() - joinedAt) / 1000) : null,
    reconnects,
    ...extra,
  });
  // sendBeacon survives the page closing; fetch is the fallback.
  if (!navigator.sendBeacon?.("api/report", new Blob([body], { type: "application/json" })))
    fetch("api/report", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
}

function showError(message) {
  $("join-error").textContent = message;
  $("join-error").hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  $("join-error").hidden = true;
  const f = form.elements;
  if (f.name.value.trim().length < 2) return showError("Enter your name.");
  if (!f.network.value) return showError("Choose your network.");
  tester = {
    name: f.name.value.trim(),
    network: f.network.value,
    vpn: f.vpn.checked,
    mode: f.mode.value,
    audioOnly: f.audioOnly.checked,
  };
  store.set("call-test-name", tester.name);
  store.set("call-test-network", tester.network);
  forceTls = tester.mode === "tls";
  form.querySelector("button").disabled = true;

  try {
    const res = await fetch("api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tester.name, password: f.password.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not get a token.");
    await join(data);
  } catch (error) {
    report("failed", { error: String(error?.message ?? error) });
    showError(`Could not join: ${error?.message ?? error}`);
    form.querySelector("button").disabled = false;
    await room?.disconnect();
  }
});

async function join({ url, token }) {
  room = new Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: { resolution: VideoPresets.h360.resolution },
    publishDefaults: { simulcast: true },
  });
  room
    .on(RoomEvent.ParticipantConnected, render)
    .on(RoomEvent.ParticipantDisconnected, render)
    .on(RoomEvent.TrackSubscribed, onTrack)
    .on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((el) => el.remove());
      render();
    })
    .on(RoomEvent.TrackMuted, render)
    .on(RoomEvent.TrackUnmuted, render)
    .on(RoomEvent.LocalTrackPublished, render)
    .on(RoomEvent.ParticipantAttributesChanged, render)
    .on(RoomEvent.Reconnecting, () => {
      reconnects++;
      setStatus("Reconnecting…");
      report("reconnecting");
    })
    .on(RoomEvent.Reconnected, () => report("reconnected"))
    .on(RoomEvent.Disconnected, (reason) => {
      clearInterval(statsTimer);
      if (joinedAt) report("disconnected", { error: String(reason ?? "") });
    });

  $("join-view").hidden = true;
  $("call-view").hidden = false;
  await room.connect(url, token);
  await room.startAudio(); // inside the tap's gesture chain, so iOS lets audio play
  joinedAt = Date.now();
  await room.localParticipant.setMicrophoneEnabled(true);
  if (!tester.audioOnly) await room.localParticipant.setCameraEnabled(true);
  $("cam").hidden = tester.audioOnly;
  render();

  let reported = false;
  const tick = async () => {
    const found = await selectedPath();
    if (found && (found.path !== lastPath?.path || !reported)) {
      lastPath = found;
      await room.localParticipant.setAttributes({ path: found.path, network: tester.network });
      if (!reported) report("joined");
      reported = true;
    }
    if (found) lastPath = found;
    setStatus(
      lastPath
        ? `Connected · ${lastPath.path}${lastPath.rttMs != null ? ` · ${lastPath.rttMs} ms` : ""}${reconnects ? ` · ${reconnects} reconnects` : ""}`
        : "Connected · finding path…",
    );
    if (!reported && Date.now() - joinedAt > 15_000) {
      report("joined", { error: "no selected ICE path after 15 s" });
      reported = true;
    }
  };
  statsTimer = setInterval(tick, 3000);
  tick();
}

function onTrack(track) {
  if (track.kind === Track.Kind.Audio) document.body.append(track.attach());
  render();
}

function setStatus(text) {
  $("status").textContent = text;
}

/** Redraws every participant's tile: video (or initial), name, network and path. */
function render() {
  if (!room) return;
  const people = [room.localParticipant, ...room.remoteParticipants.values()];
  const tiles = $("tiles");
  const ids = new Set(people.map((p) => p.identity));
  for (const el of [...tiles.children]) if (!ids.has(el.dataset.id)) el.remove();
  for (const p of people) {
    let tile = tiles.querySelector(`[data-id="${CSS.escape(p.identity)}"]`);
    if (!tile) {
      tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.id = p.identity;
      tile.innerHTML = '<div class="initial"></div><video autoplay playsinline muted></video><div class="label"></div>';
      tiles.append(tile);
    }
    const video = tile.querySelector("video");
    const cam = p.getTrackPublication(Track.Source.Camera);
    const showVideo = cam?.track && !cam.isMuted;
    if (showVideo && video.dataset.track !== cam.trackSid) {
      cam.track.attach(video);
      video.dataset.track = cam.trackSid;
    }
    video.hidden = !showVideo;
    tile.querySelector(".initial").textContent = (p.name || p.identity).slice(0, 1).toUpperCase();
    const mic = p.getTrackPublication(Track.Source.Microphone);
    const a = p.attributes ?? {};
    const label = tile.querySelector(".label");
    label.textContent = "";
    const line1 = document.createElement("strong");
    line1.textContent = `${p.name || p.identity}${p === room.localParticipant ? " (you)" : ""}${!mic || mic.isMuted ? " · muted" : ""}`;
    const line2 = document.createElement("div");
    line2.textContent = [a.network, a.path].filter(Boolean).join(" · ") || "…";
    label.append(line1, line2);
  }
}

$("mic").addEventListener("click", async (e) => {
  const on = !room.localParticipant.isMicrophoneEnabled;
  await room.localParticipant.setMicrophoneEnabled(on);
  e.currentTarget.setAttribute("aria-pressed", String(on));
  e.currentTarget.textContent = on ? "Mic on" : "Mic off";
  render();
});

$("cam").addEventListener("click", async (e) => {
  const on = !room.localParticipant.isCameraEnabled;
  await room.localParticipant.setCameraEnabled(on);
  e.currentTarget.setAttribute("aria-pressed", String(on));
  e.currentTarget.textContent = on ? "Camera on" : "Camera off";
  render();
});

$("leave").addEventListener("click", async () => {
  report("left");
  joinedAt = 0;
  await room.disconnect();
  location.reload();
});

window.addEventListener("pagehide", () => {
  if (joinedAt) report("closed");
});
