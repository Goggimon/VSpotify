import { AudioEngine } from "./audio.js";
import { SpotifyBridge } from "./spotify.js";
import { VisualizerRenderer } from "./visualizers.js";

const APP_VERSION = "v1.0";

const audio = new AudioEngine();
const canvas = document.getElementById("viz-canvas");
const renderer = new VisualizerRenderer(canvas);

// Version Counter in Brand Pill
const brandNameEl = document.querySelector(".brand-name");
if (brandNameEl) {
  brandNameEl.innerHTML = `VSpotify <span style="opacity:0.55;font-weight:500;font-size:0.74rem;margin-left:4px">${APP_VERSION}</span>`;
}

// State & Saved Preferences
const defaultPrefs = {
  viz: "bars",
  hud: "cinema",
  autoColor: true,
  accent: "#1db954",
  palette: ["#1db954"],
  bgColor: "#050507",
  bgStyle: "album-blur",
  glow: 18,
  hudOpacity: 0.9,
  autohideMs: 3000,
  sensitivity: 1.2,
  smoothing: 0.78,
  density: 64,
  eqBass: 1.2,
  eqMids: 1.0,
  eqTreble: 1.1
};

const prefs = { ...defaultPrefs, ...JSON.parse(localStorage.getItem("vspotify_prefs") || "{}") };
if (prefs.viz === "lasers") prefs.viz = "bars";
const savePrefs = () => localStorage.setItem("vspotify_prefs", JSON.stringify(prefs));

// DOM References
const bgLayer = document.getElementById("bg-layer");
const trackArt = document.getElementById("track-art");
const trackTitle = document.getElementById("track-title");
const trackArtist = document.getElementById("track-artist");
const btnPlay = document.getElementById("btn-play");
const seekBar = document.getElementById("seek-bar");
const timeCurrent = document.getElementById("time-current");
const timeTotal = document.getElementById("time-total");
const deviceDot = document.getElementById("device-dot");
const deviceStatus = document.getElementById("device-status");

let currentDurationMs = 0;
let idleTimer = null;

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

function rgbToHex(r, g, b) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${clamp(r)}${clamp(g)}${clamp(b)}`;
}

function colorDist(c1, c2) {
  return Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b);
}

function ensureVisibleAgainstBg(col, bg) {
  let { r, g, b } = col;
  const lum = r * 0.299 + g * 0.587 + b * 0.114;
  if (lum < 120) {
    const boost = 155 / Math.max(25, lum);
    r = Math.min(255, r * boost);
    g = Math.min(255, g * boost);
    b = Math.min(255, b * boost);
  }
  const adjusted = { r, g, b };
  if (colorDist(adjusted, bg) < 110) {
    // Push away from background lightness so it never blends in
    const bgLum = bg.r * 0.299 + bg.g * 0.587 + bg.b * 0.114;
    if (bgLum < 128) {
      r = Math.min(255, r + 95);
      g = Math.min(255, g + 95);
      b = Math.min(255, b + 95);
    } else {
      r = Math.max(0, r - 95);
      g = Math.max(0, g - 95);
      b = Math.max(0, b - 95);
    }
  }
  return rgbToHex(r, g, b);
}

function setPalette(bgHex, vizColors) {
  const colors = Array.isArray(vizColors) && vizColors.length > 0 ? vizColors : [prefs.accent];
  const primaryAccent = colors[0];

  document.documentElement.style.setProperty("--bg-primary", bgHex);
  document.documentElement.style.setProperty("--accent", primaryAccent);

  const r = parseInt(primaryAccent.slice(1, 3), 16);
  const g = parseInt(primaryAccent.slice(3, 5), 16);
  const b = parseInt(primaryAccent.slice(5, 7), 16);
  document.documentElement.style.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);

  const br = parseInt(bgHex.slice(1, 3), 16);
  const bg = parseInt(bgHex.slice(3, 5), 16);
  const bb = parseInt(bgHex.slice(5, 7), 16);
  document.documentElement.style.setProperty("--bg-primary-rgb", `${br}, ${bg}, ${bb}`);

  renderer.setPalette(colors);
}

// Extract #1 color as fixed background; #2 (and #3 if present) as alternating visualizer colors
function extractPaletteFromArt(img) {
  if (!prefs.autoColor) return;
  try {
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 32;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0, 32, 32);
    const data = x.getImageData(0, 0, 32, 32).data;

    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const qr = Math.round(r / 24) * 24;
      const qg = Math.round(g / 24) * 24;
      const qb = Math.round(b / 24) * 24;
      const key = `${qr},${qg},${qb}`;
      const entry = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0 };
      entry.r += r;
      entry.g += g;
      entry.b += b;
      entry.count++;
      buckets.set(key, entry);
    }

    const totalPixels = 32 * 32;
    const sorted = Array.from(buckets.values())
      .map((e) => ({
        r: e.r / e.count,
        g: e.g / e.count,
        b: e.b / e.count,
        count: e.count
      }))
      .sort((a, b) => b.count - a.count);

    if (sorted.length === 0) return;

    // #1 most present color -> fixed background (never alternated)
    const primary = sorted[0];
    const bgScale = (primary.r + primary.g + primary.b) > 380 ? 0.38 : 0.65;
    const bgObj = {
      r: primary.r * bgScale,
      g: primary.g * bgScale,
      b: primary.b * bgScale
    };
    const bgHex = rgbToHex(bgObj.r, bgObj.g, bgObj.b);

    // Pick distinct non-background colors for visualizer lines/bars/waves
    const vizCandidates = [];
    for (const col of sorted.slice(1)) {
      if (col.count < totalPixels * 0.025) continue; // skip tiny noise specks
      if (colorDist(col, primary) < 110 || colorDist(col, bgObj) < 110) continue;
      if (vizCandidates.some((picked) => colorDist(col, picked) < 95)) continue;
      vizCandidates.push(col);
      if (vizCandidates.length === 3) break;
    }

    // If album art only has 2 colors (bg + 1 accent), keep that single color; otherwise alternate
    const vizHexList = vizCandidates.length > 0
      ? vizCandidates.map((col) => ensureVisibleAgainstBg(col, bgObj))
      : [ensureVisibleAgainstBg(sorted[1] || primary, bgObj)];

    prefs.bgColor = bgHex;
    prefs.accent = vizHexList[0];
    prefs.palette = vizHexList;

    const accentInput = document.getElementById("opt-accent-color");
    if (accentInput) accentInput.value = vizHexList[0];

    setPalette(bgHex, vizHexList);
  } catch {
    // Ignore CORS taint if image blocks pixel read
  }
}

function applyPrefs() {
  renderer.mode = prefs.viz;
  renderer.glow = Number(prefs.glow);
  renderer.density = Number(prefs.density);
  renderer.sensitivity = Number(prefs.sensitivity);

  audio.setSensitivity(Number(prefs.sensitivity));
  audio.setSmoothing(Number(prefs.smoothing));
  audio.setEqGains(Number(prefs.eqBass), Number(prefs.eqMids), Number(prefs.eqTreble));

  document.documentElement.style.setProperty("--glow", `${prefs.glow}px`);
  document.documentElement.style.setProperty("--hud-opacity", prefs.hudOpacity);
  const colors = prefs.autoColor && Array.isArray(prefs.palette) ? prefs.palette : [prefs.accent];
  setPalette(prefs.bgColor || "#050507", colors);

  document.body.className = `hud-${prefs.hud} bg-${prefs.bgStyle}`;

  document.querySelectorAll(".viz-chip").forEach((el) => {
    el.classList.toggle("active", el.dataset.viz === prefs.viz);
  });
  document.querySelectorAll(".seg-btn").forEach((el) => {
    el.classList.toggle("active", el.dataset.hud === prefs.hud);
  });
}

// Spotify Bridge
const spotify = new SpotifyBridge({
  onReady: (id, name) => {
    deviceDot.classList.add("online");
    deviceStatus.textContent = `${name} Ready`;
    const playHereBtn = document.getElementById("btn-play-here");
    if (playHereBtn) playHereBtn.style.display = "inline-flex";
  },
  onStatus: (label, online) => {
    deviceDot.classList.toggle("online", online);
    deviceStatus.textContent = label;
  },
  onPlayingChange: (playing) => {
    audio.setRemotePlaying(playing);
  },
  onTrackUpdate: (track) => {
    trackTitle.textContent = track.name;
    trackArtist.textContent = track.artists;
    btnPlay.dataset.playing = track.paused ? "false" : "true";
    currentDurationMs = track.duration;
    timeTotal.textContent = formatTime(track.duration);
    timeCurrent.textContent = formatTime(track.position);
    seekBar.value = track.duration ? (track.position / track.duration) * 100 : 0;

    if (track.artUrl && trackArt.src !== track.artUrl) {
      trackArt.src = track.artUrl;
      bgLayer.style.backgroundImage = `url("${track.artUrl}")`;
      bgLayer.classList.add("has-art");
      trackArt.onload = () => extractPaletteFromArt(trackArt);
    }
  }
});

// Auto-hide HUD on idle
function resetIdleTimer() {
  document.body.classList.remove("hud-idle");
  clearTimeout(idleTimer);
  const ms = Number(prefs.autohideMs);
  if (ms > 0) {
    idleTimer = setTimeout(() => document.body.classList.add("hud-idle"), ms);
  }
}

["mousemove", "mousedown", "keydown"].forEach((evt) => {
  window.addEventListener(evt, resetIdleTimer);
});

// UI Wiring
window.addEventListener("resize", () => renderer.resize());

document.querySelectorAll(".viz-chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    prefs.viz = btn.dataset.viz;
    savePrefs();
    applyPrefs();
  });
});

document.querySelectorAll(".seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    prefs.hud = btn.dataset.hud;
    savePrefs();
    applyPrefs();
  });
});

const drawer = document.getElementById("custom-drawer");
document.getElementById("btn-toggle-drawer").onclick = () => drawer.classList.toggle("hidden");
document.getElementById("btn-close-drawer").onclick = () => drawer.classList.add("hidden");

document.getElementById("btn-fullscreen").onclick = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
};

// Remove Tab Audio button per preference
const captureBtn = document.getElementById("btn-capture-audio");
if (captureBtn) captureBtn.remove();

// Remove Lasers chip if present in HTML
document.querySelector('[data-viz="lasers"]')?.remove();

// Add "Play Here" button when browser SDK registers
const topActions = document.querySelector(".top-actions");
if (topActions && !document.getElementById("btn-play-here")) {
  const playHereBtn = document.createElement("button");
  playHereBtn.id = "btn-play-here";
  playHereBtn.className = "glass-pill action-pill";
  playHereBtn.style.display = "none";
  playHereBtn.title = "Transfer Spotify playback to this browser tab";
  playHereBtn.innerHTML = "<span>Play Here</span>";
  playHereBtn.onclick = async () => {
    try {
      await spotify.transferHere();
    } catch (err) {
      alert(err.message);
    }
  };
  topActions.prepend(playHereBtn);
}

// Inject Milkdrop, Plasma, and Concert visualizers into quick bar
const vizQuickBar = document.getElementById("viz-quick-bar");
[
  ["milkdrop", "Milkdrop"],
  ["plasma", "Plasma"],
  ["mirror", "Concert"]
].forEach(([key, label]) => {
  if (!vizQuickBar.querySelector(`[data-viz="${key}"]`)) {
    const chip = document.createElement("button");
    chip.className = "viz-chip";
    chip.dataset.viz = key;
    chip.textContent = label;
    chip.addEventListener("click", () => {
      prefs.viz = key;
      savePrefs();
      applyPrefs();
    });
    vizQuickBar.appendChild(chip);
  }
});

// Setup Modal
const modal = document.getElementById("setup-modal");
document.getElementById("redirect-uri-display").textContent = spotify.getRedirectUri();
document.getElementById("input-client-id").value = localStorage.getItem("vspotify_client_id") || "";
document.getElementById("btn-connect-spotify").onclick = () => modal.classList.remove("hidden");
document.getElementById("btn-close-modal").onclick = () => modal.classList.add("hidden");
document.getElementById("btn-start-auth").onclick = () => {
  const clientId = document.getElementById("input-client-id").value.trim();
  const deviceName = document.getElementById("input-device-name").value.trim();
  if (!clientId) return alert("Please enter your Spotify Client ID.");
  spotify.startAuth(clientId, deviceName);
};

// Transport
document.getElementById("btn-play").onclick = () => spotify.togglePlay();
document.getElementById("btn-next").onclick = () => spotify.nextTrack();
document.getElementById("btn-prev").onclick = () => spotify.previousTrack();
seekBar.onchange = () => {
  if (currentDurationMs) spotify.seek((seekBar.value / 100) * currentDurationMs);
};

// Demo / Local Audio
document.getElementById("btn-demo-synth").onclick = () => {
  const active = audio.toggleDemoSynth((meta) => {
    trackTitle.textContent = meta.title;
    trackArtist.textContent = meta.artist;
    btnPlay.dataset.playing = "true";
  });
  if (!active) btnPlay.dataset.playing = "false";
};

document.getElementById("input-local-audio").onchange = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  audio.loadLocalFile(file, (meta) => {
    trackTitle.textContent = meta.title;
    trackArtist.textContent = meta.artist;
    btnPlay.dataset.playing = "true";
  });
};

// Customization Inputs
const bindInput = (id, key, isCheck = false) => {
  const el = document.getElementById(id);
  el[isCheck ? "checked" : "value"] = prefs[key];
  el.addEventListener("input", () => {
    prefs[key] = isCheck ? el.checked : el.value;
    savePrefs();
    applyPrefs();
  });
};

bindInput("opt-auto-color", "autoColor", true);
bindInput("opt-accent-color", "accent");
bindInput("opt-bg-style", "bgStyle");
bindInput("opt-glow", "glow");
bindInput("opt-hud-opacity", "hudOpacity");
bindInput("opt-autohide", "autohideMs");
bindInput("opt-sensitivity", "sensitivity");
bindInput("opt-smoothing", "smoothing");
bindInput("opt-density", "density");
bindInput("eq-bass", "eqBass");
bindInput("eq-mids", "eqMids");
bindInput("eq-treble", "eqTreble");

// Keyboard Shortcuts
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  const vizMap = {
    "1": "bars",
    "2": "radial",
    "3": "waveform",
    "4": "particles",
    "5": "horizon",
    "6": "matrix",
    "7": "milkdrop",
    "8": "plasma",
    "9": "mirror"
  };
  if (vizMap[e.key]) {
    prefs.viz = vizMap[e.key];
    savePrefs();
    applyPrefs();
  } else if (e.key.toLowerCase() === "f") {
    document.getElementById("btn-fullscreen").click();
  } else if (e.key.toLowerCase() === "c") {
    drawer.classList.toggle("hidden");
  } else if (e.key.toLowerCase() === "h") {
    const order = ["cinema", "minimal", "centered", "hidden"];
    prefs.hud = order[(order.indexOf(prefs.hud) + 1) % order.length];
    savePrefs();
    applyPrefs();
  } else if (e.code === "Space") {
    e.preventDefault();
    spotify.togglePlay();
  }
});

// Animation Loop
function loop() {
  renderer.render(audio.sample());
  requestAnimationFrame(loop);
}

// Init
applyPrefs();
resetIdleTimer();
spotify.handleCallbackIfPresent()
  .then((authed) => {
    if (authed) spotify.initPlayer();
  })
  .catch((err) => {
    deviceDot.classList.remove("online");
    deviceStatus.textContent = err.message;
    console.error(err);
  });
loop();
