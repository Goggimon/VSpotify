import { AudioEngine } from "./audio.js";
import { SpotifyBridge } from "./spotify.js";
import { VisualizerRenderer } from "./visualizers.js";

const APP_VERSION = "v2.0.0";

const audio = new AudioEngine();
const canvas = document.getElementById("viz-canvas");
const renderer = new VisualizerRenderer(canvas);

// Brand Pill v2.0.0 + Smoked Glass Prism Emblem & Favicon
const prismSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z" stroke="rgba(255,255,255,0.45)" stroke-width="1.4" fill="rgba(255,255,255,0.06)"/><path d="M4 7l8 4.5L20 7M12 11.5V21.5" stroke="rgba(255,255,255,0.25)" stroke-width="1.1"/><path d="M6.5 13h2l1.5-3.5 2 5.5 2-4.5 1.5 2.5h2" stroke="#1db954" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const brandNameEl = document.querySelector(".brand-name");
if (brandNameEl) {
  brandNameEl.innerHTML = `<span style="display:inline-flex;vertical-align:-3px;margin-right:6px">${prismSvg}</span>VSpotify <span style="opacity:0.55;font-weight:500;font-size:0.72rem;margin-left:4px">${APP_VERSION}</span>`;
}
let favicon = document.querySelector('link[rel="icon"]');
if (!favicon) {
  favicon = document.createElement("link");
  favicon.rel = "icon";
  document.head.appendChild(favicon);
}
favicon.href = `data:image/svg+xml,${encodeURIComponent(prismSvg)}`;

// State & Saved Preferences (Default: Oud & Amber Luxury)
const defaultPrefs = {
  viz: "bars",
  hud: "cinema",
  autoColor: true,
  smartIdleArt: true,
  themeMode: "obsidian",
  accent: "#e4e4e7",
  palette: ["#e4e4e7", "#a1a1aa"],
  bgColor: "#08080a",
  bgStyle: "album-blur",
  glow: 18,
  hudOpacity: 0.94,
  autohideMs: 3000,
  sensitivity: 1.2,
  smoothing: 0.78,
  density: 64,
  thickness: 2.6,
  speed: 1.0,
  artScale: 1.0,
  eqBass: 1.2,
  eqMids: 1.0,
  eqTreble: 1.1
};

const prefs = { ...defaultPrefs, ...JSON.parse(localStorage.getItem("vspotify_prefs") || "{}") };
if (prefs.viz === "lasers") prefs.viz = "bars";
const savePrefs = () => localStorage.setItem("vspotify_prefs", JSON.stringify(prefs));

const builtInPresets = {
  "Late Night": { viz: "vinyl", hud: "minimal", bgStyle: "album-blur", glow: 16, sensitivity: 1.05, smoothing: 0.85, density: 48, thickness: 2.4, speed: 0.9 },
  "Concert Hall": { viz: "mirror", hud: "cinema", bgStyle: "pure-black", glow: 28, sensitivity: 1.6, smoothing: 0.65, density: 80, thickness: 3.0, speed: 1.2 },
  "Deep Space": { viz: "spiral", hud: "centered", bgStyle: "gradient", glow: 24, sensitivity: 1.3, smoothing: 0.78, density: 72, thickness: 2.6, speed: 1.05 },
  "Retro Dusk": { viz: "synthwave", hud: "cinema", bgStyle: "gradient", glow: 22, sensitivity: 1.3, smoothing: 0.75, density: 64, thickness: 2.8, speed: 1.1 }
};

function getSavedPresets() {
  return { ...builtInPresets, ...JSON.parse(localStorage.getItem("vspotify_presets") || "{}") };
}

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
  if (lum < 125) {
    const boost = 165 / Math.max(25, lum);
    r = Math.min(255, r * boost);
    g = Math.min(255, g * boost);
    b = Math.min(255, b * boost);
  }
  const adjusted = { r, g, b };
  if (colorDist(adjusted, bg) < 115) {
    const bgLum = bg.r * 0.299 + bg.g * 0.587 + bg.b * 0.114;
    if (bgLum < 128) {
      r = Math.min(255, r + 100);
      g = Math.min(255, g + 100);
      b = Math.min(255, b + 100);
    } else {
      r = Math.max(0, r - 100);
      g = Math.max(0, g - 100);
      b = Math.max(0, b - 100);
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

// Reliable CORS-safe image loader for album art palette + canvas drawing
function analyzeAlbumArtUrl(url) {
  const probe = new Image();
  probe.crossOrigin = "anonymous";
  probe.onload = () => {
    renderer.setArtImage(probe);
    if (!prefs.autoColor) return;
    try {
      const c = document.createElement("canvas");
      c.width = 40;
      c.height = 40;
      const x = c.getContext("2d");
      x.drawImage(probe, 0, 0, 40, 40);
      const data = x.getImageData(0, 0, 40, 40).data;

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

      const totalPixels = 40 * 40;
      const sorted = Array.from(buckets.values())
        .map((e) => ({
          r: e.r / e.count,
          g: e.g / e.count,
          b: e.b / e.count,
          count: e.count
        }))
        .sort((a, b) => b.count - a.count);

      if (sorted.length === 0) return;

      // #1 most present color -> visible rich background hue (not crushed to black)
      const primary = sorted[0];
      const pLum = primary.r * 0.299 + primary.g * 0.587 + primary.b * 0.114;
      const bgScale = pLum > 140 ? 0.48 : pLum < 35 ? 1.5 : 0.78;
      const bgObj = {
        r: Math.min(255, primary.r * bgScale),
        g: Math.min(255, primary.g * bgScale),
        b: Math.min(255, primary.b * bgScale)
      };
      const bgHex = rgbToHex(bgObj.r, bgObj.g, bgObj.b);

      // #2 & #3 distinct colors -> alternating visualizer colors
      const vizCandidates = [];
      for (const col of sorted.slice(1)) {
        if (col.count < totalPixels * 0.02) continue;
        if (colorDist(col, primary) < 105 || colorDist(col, bgObj) < 110) continue;
        if (vizCandidates.some((picked) => colorDist(col, picked) < 90)) continue;
        vizCandidates.push(col);
        if (vizCandidates.length === 3) break;
      }

      const vizHexList = vizCandidates.length > 0
        ? vizCandidates.map((col) => ensureVisibleAgainstBg(col, bgObj))
        : [ensureVisibleAgainstBg(sorted[1] || primary, bgObj)];

      prefs.bgColor = bgHex;
      prefs.accent = vizHexList[0];
      prefs.palette = vizHexList;

      const accentInput = document.getElementById("opt-accent-color");
      if (accentInput) accentInput.value = vizHexList[0];

      setPalette(bgHex, vizHexList);
    } catch (err) {
      console.warn("Album color extraction skipped:", err);
    }
  };
  probe.src = url;
}

// Create floating corner mini-art badge for non-centered visualizers when HUD hides
let cornerDock = document.getElementById("idle-corner-dock");
if (!cornerDock) {
  cornerDock = document.createElement("div");
  cornerDock.id = "idle-corner-dock";
  cornerDock.className = "idle-corner-dock";
  cornerDock.innerHTML = `<img id="idle-art" alt="Art" /><div class="idle-meta"><div id="idle-title"></div><div id="idle-artist"></div></div>`;
  document.body.appendChild(cornerDock);
}

function updateSmartArtPlacement() {
  const isIdleOrFull =
    document.body.classList.contains("hud-idle") || Boolean(document.fullscreenElement);

  const centeredViz = renderer.isCenteredArtMode();
  renderer.showCenterArt = Boolean(prefs.smartIdleArt && isIdleOrFull && centeredViz);

  // For non-centered visualizers (bars, wave, plasma, etc.), show sleek corner dock when HUD hides
  const showCorner = Boolean(prefs.smartIdleArt && isIdleOrFull && !centeredViz && prefs.hud !== "hidden");
  cornerDock.classList.toggle("visible", showCorner);
}

function syncControlsFromPrefs() {
  const map = {
    "opt-auto-color": ["autoColor", true],
    "opt-smart-art": ["smartIdleArt", true],
    "opt-accent-color": ["accent", false],
    "opt-bg-style": ["bgStyle", false],
    "opt-theme-mode": ["themeMode", false],
    "opt-glow": ["glow", false],
    "opt-hud-opacity": ["hudOpacity", false],
    "opt-autohide": ["autohideMs", false],
    "opt-sensitivity": ["sensitivity", false],
    "opt-smoothing": ["smoothing", false],
    "opt-density": ["density", false],
    "opt-thickness": ["thickness", false],
    "opt-speed": ["speed", false],
    "opt-art-scale": ["artScale", false],
    "eq-bass": ["eqBass", false],
    "eq-mids": ["eqMids", false],
    "eq-treble": ["eqTreble", false]
  };
  for (const [id, [key, isCheck]] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el[isCheck ? "checked" : "value"] = prefs[key];
  }
}

function applyPrefs() {
  renderer.mode = prefs.viz;
  renderer.glow = Number(prefs.glow);
  renderer.density = Number(prefs.density);
  renderer.sensitivity = Number(prefs.sensitivity);
  renderer.thickness = Number(prefs.thickness);
  renderer.speed = Number(prefs.speed);
  renderer.artScale = Number(prefs.artScale);

  audio.setSensitivity(Number(prefs.sensitivity));
  audio.setSmoothing(Number(prefs.smoothing));
  audio.setEqGains(Number(prefs.eqBass), Number(prefs.eqMids), Number(prefs.eqTreble));

  document.documentElement.style.setProperty("--glow", `${prefs.glow}px`);
  document.documentElement.style.setProperty("--hud-opacity", prefs.hudOpacity);
  const colors = prefs.autoColor && Array.isArray(prefs.palette) ? prefs.palette : [prefs.accent];
  setPalette(prefs.bgColor || "#140e0a", colors);

  const idleKeep = document.body.classList.contains("hud-idle") ? " hud-idle" : "";
  document.body.className = `hud-${prefs.hud} bg-${prefs.bgStyle} theme-${prefs.themeMode}${idleKeep}`;

  document.querySelectorAll(".viz-chip").forEach((el) => {
    el.classList.toggle("active", el.dataset.viz === prefs.viz);
  });
  document.querySelectorAll(".seg-btn").forEach((el) => {
    el.classList.toggle("active", el.dataset.hud === prefs.hud);
  });

  updateSmartArtPlacement();
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
    document.getElementById("idle-title").textContent = track.name;
    document.getElementById("idle-artist").textContent = track.artists;

    btnPlay.dataset.playing = track.paused ? "false" : "true";
    currentDurationMs = track.duration;
    timeTotal.textContent = formatTime(track.duration);
    timeCurrent.textContent = formatTime(track.position);
    seekBar.value = track.duration ? (track.position / track.duration) * 100 : 0;

    if (track.artUrl && trackArt.src !== track.artUrl) {
      trackArt.src = track.artUrl;
      document.getElementById("idle-art").src = track.artUrl;
      bgLayer.style.backgroundImage = `url("${track.artUrl}")`;
      bgLayer.classList.add("has-art");
      analyzeAlbumArtUrl(track.artUrl);
    }
  }
});

// Auto-hide HUD on idle
function resetIdleTimer() {
  document.body.classList.remove("hud-idle");
  updateSmartArtPlacement();
  clearTimeout(idleTimer);
  const ms = Number(prefs.autohideMs);
  if (ms > 0) {
    idleTimer = setTimeout(() => {
      document.body.classList.add("hud-idle");
      updateSmartArtPlacement();
    }, ms);
  }
}

["mousemove", "mousedown", "keydown"].forEach((evt) => {
  window.addEventListener(evt, resetIdleTimer);
});
document.addEventListener("fullscreenchange", updateSmartArtPlacement);

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

const captureBtn = document.getElementById("btn-capture-audio");
if (captureBtn) {
  captureBtn.onclick = async () => {
    try {
      await audio.startTabCapture();
      deviceStatus.textContent = "Tab Audio Live (60fps FFT)";
    } catch (err) {
      alert(err.message);
    }
  };
}

document.querySelector('[data-viz="lasers"]')?.remove();
document.getElementById("btn-mic-audio")?.remove();

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

// Inject all 17 visualizers cleanly into quick bar
const vizQuickBar = document.getElementById("viz-quick-bar");
[
  ["milkdrop", "Milkdrop"],
  ["plasma", "Plasma"],
  ["mirror", "Concert"],
  ["vinyl", "Vinyl"],
  ["warp", "Warp"],
  ["spiral", "Spiral"],
  ["synthwave", "Synthwave"],
  ["dna", "DNA"],
  ["mandala", "Mandala"],
  ["aurora", "Aurora"],
  ["orbit", "Orbit"]
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

// Inject Presets & Extra Customization Controls into Drawer
const drawerBody = document.querySelector(".drawer-body");
if (drawerBody && !document.getElementById("preset-section")) {
  const sec = document.createElement("section");
  sec.id = "preset-section";
  sec.className = "control-group";
  sec.innerHTML = `<h3>Visual Presets</h3><div class="btn-row" id="preset-list"></div><div class="btn-row" style="margin-top:8px"><button id="btn-save-preset" class="glass-pill action-pill">+ Save Current</button></div>`;
  drawerBody.prepend(sec);

  const renderPresets = () => {
    const list = document.getElementById("preset-list");
    list.innerHTML = "";
    const all = getSavedPresets();
    Object.keys(all).forEach((name) => {
      const btn = document.createElement("button");
      btn.className = "glass-pill action-pill";
      btn.textContent = name;
      btn.onclick = () => {
        Object.assign(prefs, all[name]);
        savePrefs();
        syncControlsFromPrefs();
        applyPrefs();
      };
      list.appendChild(btn);
    });
  };

  document.getElementById("btn-save-preset").onclick = () => {
    const name = prompt("Name this preset (e.g. Late Night Oud):")?.trim();
    if (!name) return;
    const custom = JSON.parse(localStorage.getItem("vspotify_presets") || "{}");
    custom[name] = {
      viz: prefs.viz,
      hud: prefs.hud,
      bgStyle: prefs.bgStyle,
      glow: prefs.glow,
      sensitivity: prefs.sensitivity,
      smoothing: prefs.smoothing,
      density: prefs.density,
      thickness: prefs.thickness,
      speed: prefs.speed
    };
    localStorage.setItem("vspotify_presets", JSON.stringify(custom));
    renderPresets();
  };

  renderPresets();

  // Add Extra Customization Controls dynamically
  const extraGroup = document.createElement("section");
  extraGroup.className = "control-group";
  extraGroup.innerHTML = `
    <h3>Fine Tuning &amp; Atmosphere</h3>
    <label class="toggle-row">
      <span>Smart Fullscreen Art Placement</span>
      <input type="checkbox" class="switch" id="opt-smart-art" checked />
    </label>
    <label class="select-row">
      <span>Luxury Surface</span>
      <select id="opt-theme-mode">
        <option value="obsidian">Obsidian Glass</option>
        <option value="warm">Warm Espresso</option>
      </select>
    </label>
    <label class="slider-row">
      <span>Line / Bar Thickness</span>
      <input type="range" id="opt-thickness" min="1" max="6" step="0.2" value="2.6" />
    </label>
    <label class="slider-row">
      <span>Motion Speed</span>
      <input type="range" id="opt-speed" min="0.4" max="2.2" step="0.1" value="1.0" />
    </label>
    <label class="slider-row">
      <span>Center Art Size</span>
      <input type="range" id="opt-art-scale" min="0.6" max="1.5" step="0.05" value="1.0" />
    </label>
  `;
  drawerBody.insertBefore(extraGroup, drawerBody.children[3]);
}

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

// Bind all inputs
const bindInput = (id, key, isCheck = false) => {
  const el = document.getElementById(id);
  if (!el) return;
  el[isCheck ? "checked" : "value"] = prefs[key];
  el.addEventListener("input", () => {
    prefs[key] = isCheck ? el.checked : el.value;
    savePrefs();
    applyPrefs();
  });
};

[
  ["opt-auto-color", "autoColor", true],
  ["opt-smart-art", "smartIdleArt", true],
  ["opt-accent-color", "accent", false],
  ["opt-bg-style", "bgStyle", false],
  ["opt-theme-mode", "themeMode", false],
  ["opt-glow", "glow", false],
  ["opt-hud-opacity", "hudOpacity", false],
  ["opt-autohide", "autohideMs", false],
  ["opt-sensitivity", "sensitivity", false],
  ["opt-smoothing", "smoothing", false],
  ["opt-density", "density", false],
  ["opt-thickness", "thickness", false],
  ["opt-speed", "speed", false],
  ["opt-art-scale", "artScale", false],
  ["eq-bass", "eqBass", false],
  ["eq-mids", "eqMids", false],
  ["eq-treble", "eqTreble", false]
].forEach(([id, key, isCheck]) => bindInput(id, key, isCheck));

// Keyboard Shortcuts
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  const vizMap = {
    "1": "bars", "2": "radial", "3": "waveform", "4": "particles",
    "5": "horizon", "6": "matrix", "7": "milkdrop", "8": "plasma",
    "9": "mirror", "0": "vinyl"
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
