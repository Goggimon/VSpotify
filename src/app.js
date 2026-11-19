import { AudioEngine } from "./audio.js";
import { SpotifyBridge } from "./spotify.js";
import { VisualizerRenderer } from "./visualizers.js";
import { PerformanceGovernor } from "./viz-governor.js";
import { VISUALIZER_REGISTRY, SUPERSCOPE_EQUATIONS } from "./viz-legacy.js";
import { LyricsController } from "./lyrics.js";
import { LYRIC_STYLES, LYRIC_STYLE_MAP } from "./lyrics-layouts.js";

const APP_VERSION = "v3.0.0";

const audio = new AudioEngine();
const canvas = document.getElementById("viz-canvas");
const VIZ_BY_ID = new Map(VISUALIZER_REGISTRY.map((v) => [v.id, v]));

let fallbackFromViz = null;
let lastAppliedViz = null;

function handleVizFallback() {
  if (prefs.viz === "retro-audio-lab") return;
  const origViz = prefs.viz;
  const origMeta = VIZ_BY_ID.get(origViz);
  fallbackFromViz = origViz;
  prefs.viz = "retro-audio-lab";
  savePrefs();
  syncControlsFromPrefs();
  applyPrefs();
  renderVisualizerBrowser();
  showFallbackToast(origViz, origMeta ? origMeta.name : origViz);
}

const renderer = new VisualizerRenderer(canvas, { onFallback: handleVizFallback });

// Brand Pill v3.0.0 + Smoked Glass Prism Emblem & Favicon
const prismSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z" stroke="rgba(255,255,255,0.45)" stroke-width="1.4" fill="rgba(255,255,255,0.06)"/><path d="M4 7l8 4.5L20 7M12 11.5V21.5" stroke="rgba(255,255,255,0.25)" stroke-width="1.1"/><path d="M6.5 13h2l1.5-3.5 2 5.5 2-4.5 1.5 2.5h2" stroke="#1db954" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const brandNameEl = document.querySelector(".brand-name");
if (brandNameEl) {
  brandNameEl.innerHTML = `<span style="display:inline-flex;vertical-align:-3px;margin-right:6px">${prismSvg}</span>VSpotify <span style="opacity:0.5;font-weight:500;font-size:0.72rem;margin-left:4px">${APP_VERSION}</span>`;
}
let favicon = document.querySelector('link[rel="icon"]');
if (!favicon) {
  favicon = document.createElement("link");
  favicon.rel = "icon";
  document.head.appendChild(favicon);
}
favicon.href = `data:image/svg+xml,${encodeURIComponent(prismSvg)}`;

const SCENE_PREVIEWS = {
  "connected-zigzag": `<svg viewBox="0 0 48 28"><path d="M8 6 L36 14 L12 22" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="24" cy="10" r="2.2" fill="currentColor"/></svg>`,
  "constellation": `<svg viewBox="0 0 48 28"><path d="M10 18 L24 8 L38 16" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"/><circle cx="10" cy="18" r="2" fill="currentColor"/><circle cx="24" cy="8" r="2.5" fill="currentColor"/><circle cx="38" cy="16" r="2" fill="currentColor"/></svg>`,
  "editorial": `<svg viewBox="0 0 48 28"><rect x="6" y="6" width="22" height="3" rx="1.5" fill="currentColor" opacity="0.4"/><rect x="6" y="12" width="36" height="5" rx="2" fill="currentColor"/><rect x="6" y="20" width="26" height="3" rx="1.5" fill="currentColor" opacity="0.4"/></svg>`,
  "floating-cards": `<svg viewBox="0 0 48 28"><rect x="10" y="4" width="28" height="7" rx="3" fill="currentColor" opacity="0.25"/><rect x="6" y="11" width="36" height="8" rx="3" fill="currentColor" opacity="0.75"/><rect x="12" y="20" width="24" height="5" rx="2.5" fill="currentColor" opacity="0.25"/></svg>`,
  "orbital-type": `<svg viewBox="0 0 48 28"><circle cx="24" cy="14" r="5" fill="currentColor" opacity="0.35"/><path d="M10 8 Q24 2 38 8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 20 Q24 26 40 20" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  "kinetic-poster": `<svg viewBox="0 0 48 28"><rect x="8" y="9" width="32" height="10" rx="2.5" fill="currentColor"/></svg>`,
  "ribbon-flow": `<svg viewBox="0 0 48 28"><path d="M4 9 Q24 4 44 10" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.4"/><path d="M4 15 Q24 20 44 14" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M4 21 Q24 17 44 22" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.4"/></svg>`,
  "typewriter-drift": `<svg viewBox="0 0 48 28"><rect x="8" y="11" width="26" height="5" rx="1" fill="currentColor"/><rect x="36" y="10" width="2" height="7" fill="currentColor" opacity="0.7"/></svg>`,
  "subtitles-reimagined": `<svg viewBox="0 0 48 28"><rect x="8" y="15" width="32" height="4" rx="2" fill="currentColor"/><rect x="14" y="21" width="20" height="2.5" rx="1.2" fill="currentColor" opacity="0.45"/></svg>`,
  "lyric-wall": `<svg viewBox="0 0 48 28"><rect x="6" y="5" width="16" height="7" rx="2" fill="currentColor" opacity="0.3"/><rect x="26" y="5" width="16" height="7" rx="2" fill="currentColor" opacity="0.85"/><rect x="6" y="15" width="16" height="7" rx="2" fill="currentColor" opacity="0.3"/><rect x="26" y="15" width="16" height="7" rx="2" fill="currentColor" opacity="0.3"/></svg>`,
  "split-horizon": `<svg viewBox="0 0 48 28"><line x1="4" y1="14" x2="44" y2="14" stroke="currentColor" stroke-width="1" opacity="0.5"/><rect x="12" y="6" width="24" height="3" rx="1.5" fill="currentColor" opacity="0.35"/><rect x="8" y="18" width="32" height="4.5" rx="2" fill="currentColor"/></svg>`,
  "paper-cut": `<svg viewBox="0 0 48 28"><rect x="10" y="9" width="30" height="10" rx="2" fill="currentColor" opacity="0.25"/><rect x="8" y="7" width="30" height="10" rx="2" fill="currentColor"/></svg>`,
  "tunnel": `<svg viewBox="0 0 48 28"><rect x="17" y="5" width="14" height="2.5" rx="1" fill="currentColor" opacity="0.3"/><rect x="12" y="10" width="24" height="3.5" rx="1.5" fill="currentColor" opacity="0.55"/><rect x="6" y="17" width="36" height="5" rx="2" fill="currentColor"/></svg>`,
  "neon-thread": `<svg viewBox="0 0 48 28"><path d="M10 7 C24 7 24 14 36 14 C24 14 24 21 12 21" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`
};

// Curated Visualizer + Lyric Scene Combos
const CURATED_COMBOS = [
  {
    id: "Velvet Route",
    subtitle: "Aurora + Connected Zigzag",
    viz: "aurora",
    lyrics: { enabled: true, style: "connected-zigzag", bgMode: "album-aura", bgMotion: "medium", motionIntensity: 1.0, contrast: "balanced", fontTreatment: "sans" }
  },
  {
    id: "Neon Transit",
    subtitle: "Laser Cathedral + Neon Thread",
    viz: "laser-cathedral",
    lyrics: { enabled: true, style: "neon-thread", bgMode: "pulse-halo", bgMotion: "medium", motionIntensity: 1.0, contrast: "balanced", fontTreatment: "sans" }
  },
  {
    id: "Deep Space",
    subtitle: "Fractal Tunnel + Constellation",
    viz: "fractal-tunnel",
    lyrics: { enabled: true, style: "constellation", bgMode: "night-sky", bgMotion: "low", textWidth: 0.85, contrast: "balanced", fontTreatment: "sans" }
  },
  {
    id: "Gallery Night",
    subtitle: "Kaleidoscope + Editorial",
    viz: "kaleidoscope",
    lyrics: { enabled: true, style: "editorial", bgMode: "grain-vignette", bgMotion: "off", motionIntensity: 0.35, contrast: "crisp", fontTreatment: "serif" }
  },
  {
    id: "Analog Room",
    subtitle: "Retro Audio Lab + Subtitles",
    viz: "retro-audio-lab",
    lyrics: { enabled: true, style: "subtitles-reimagined", bgMode: "adaptive", bgMotion: "low", motionIntensity: 0.4, contrast: "crisp", fontTreatment: "sans" }
  }
];

const defaultLyricsPrefs = {
  enabled: true,
  style: "connected-zigzag",
  sourcePriority: "lrclib-first",
  bgMode: "adaptive",
  bgMotion: "medium",
  textScale: 1.0,
  textWidth: 1.0,
  contrast: "balanced",
  fontTreatment: "sans",
  placement: "adaptive",
  motionIntensity: 1.0,
  connectorStrength: 1.0,
  showAlbumArt: true,
  offsetMs: 0,
  followPlayback: true,
  reducedMotion: "system"
};

const defaultPrefs = {
  viz: "bars",
  hud: "cinema",
  perfMode: "balanced",
  scopeEquation: "infinity",
  surpriseRotate: false,
  favorites: ["bars", "aurora", "fractal-tunnel", "retro-audio-lab"],
  lyricFocus: false,
  vizIntensity: "balanced",
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
  eqTreble: 1.1,
  lyrics: { ...defaultLyricsPrefs }
};

const stored = JSON.parse(localStorage.getItem("vspotify_prefs") || "{}");
const prefs = {
  ...defaultPrefs,
  ...stored,
  favorites: Array.isArray(stored.favorites) ? stored.favorites : defaultPrefs.favorites,
  lyrics: { ...defaultLyricsPrefs, ...(stored.lyrics || {}) }
};
if (!VIZ_BY_ID.has(prefs.viz)) prefs.viz = "bars";
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
const sceneCapsuleText = document.getElementById("scene-capsule-text");
const activeVizBadge = document.getElementById("active-viz-badge");
const btnLyricFocus = document.getElementById("btn-lyric-focus");
const displayExitHint = document.getElementById("display-exit-hint");
const perfToast = document.getElementById("perf-toast");

let currentDurationMs = 0;
let idleTimer = null;
let exitHintTimer = null;
let perfToastTimer = null;
let lastTrackKey = null;

function showToast(msg) {
  if (!perfToast) return;
  perfToast.textContent = msg;
  perfToast.classList.add("visible");
  clearTimeout(perfToastTimer);
  perfToastTimer = setTimeout(() => perfToast.classList.remove("visible"), 4500);
}

function showFallbackToast(origId, origName) {
  if (!perfToast) return;
  perfToast.innerHTML = `<span>This visualizer is too demanding on this device. Switched to Retro Audio Lab.</span> <button type="button" id="btn-toast-switch-back" class="subtle-link-btn" style="color:var(--accent);margin-left:8px;font-weight:600">Switch back to ${origName}</button>`;
  perfToast.classList.add("visible");
  const btn = document.getElementById("btn-toast-switch-back");
  if (btn) {
    btn.onclick = () => {
      fallbackFromViz = null;
      prefs.viz = origId;
      savePrefs();
      syncControlsFromPrefs();
      applyPrefs();
      renderVisualizerBrowser();
      perfToast.classList.remove("visible");
    };
  }
  clearTimeout(perfToastTimer);
  perfToastTimer = setTimeout(() => perfToast.classList.remove("visible"), 7000);
}

// Performance Governor
const governor = new PerformanceGovernor({
  mode: prefs.perfMode,
  onQualityChange: (cfg) => renderer.setQuality(cfg),
  onFallback: handleVizFallback
});
renderer.setQuality(governor.getConfig());

// Lyrics Controller
const lyrics = new LyricsController({
  initialPrefs: prefs.lyrics,
  onStateChange: ({ state, source, timing }) => {
    const badge = document.getElementById("lyrics-quality-badge");
    if (badge) {
      if (state === "disabled") badge.textContent = "Disabled";
      else if (state === "loading") badge.textContent = "Searching…";
      else if (state === "imported") badge.textContent = timing === "line" ? "Imported LRC" : "Imported · Not timed";
      else if (state === "ready-timed") badge.textContent = `Timed lines · ${source}`;
      else if (state === "ready-static") badge.textContent = "Static lyrics · Not timed";
      else if (state === "empty" || state === "error") badge.textContent = "Unavailable";
      else badge.textContent = "Waiting for track";
    }
    const hasActiveLyrics = prefs.lyrics.enabled && (state === "ready-timed" || state === "ready-static" || state === "imported");
    document.body.classList.toggle("lyrics-hero-active", hasActiveLyrics);
    updateSceneCapsule();
  }
});

function updateSceneCapsule() {
  const vizMeta = VIZ_BY_ID.get(prefs.viz) || VISUALIZER_REGISTRY[0];
  if (activeVizBadge) {
    activeVizBadge.textContent = `${vizMeta.name} · ${vizMeta.category}`;
  }
  if (sceneCapsuleText) {
    if (!prefs.lyrics.enabled) {
      sceneCapsuleText.textContent = `${vizMeta.name} · Visual Only`;
    } else {
      const styleObj = LYRIC_STYLE_MAP.get(prefs.lyrics.style);
      sceneCapsuleText.textContent = `${vizMeta.name} · ${styleObj ? styleObj.name : "Lyrics"}`;
    }
  }
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
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
    const delta = bgLum < 128 ? 100 : -100;
    r = Math.max(0, Math.min(255, r + delta));
    g = Math.max(0, Math.min(255, g + delta));
    b = Math.max(0, Math.min(255, b + delta));
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
  lyrics.updateSceneContext({ palette: colors, bgColor: bgHex });
}

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
        const key = `${Math.round(r / 24) * 24},${Math.round(g / 24) * 24},${Math.round(b / 24) * 24}`;
        const entry = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0 };
        entry.r += r;
        entry.g += g;
        entry.b += b;
        entry.count++;
        buckets.set(key, entry);
      }

      const sorted = Array.from(buckets.values())
        .map((e) => ({ r: e.r / e.count, g: e.g / e.count, b: e.b / e.count, count: e.count }))
        .sort((a, b) => b.count - a.count);
      if (sorted.length === 0) return;

      const primary = sorted[0];
      const pLum = primary.r * 0.299 + primary.g * 0.587 + primary.b * 0.114;
      const bgScale = pLum > 140 ? 0.48 : pLum < 35 ? 1.5 : 0.78;
      const bgObj = {
        r: Math.min(255, primary.r * bgScale),
        g: Math.min(255, primary.g * bgScale),
        b: Math.min(255, primary.b * bgScale)
      };
      const bgHex = rgbToHex(bgObj.r, bgObj.g, bgObj.b);

      const vizCandidates = [];
      for (const col of sorted.slice(1)) {
        if (col.count < 32) continue;
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
    } catch {
      // Ignore CORS taint
    }
  };
  probe.src = url;
}

let cornerDock = document.getElementById("idle-corner-dock");
if (!cornerDock) {
  cornerDock = document.createElement("div");
  cornerDock.id = "idle-corner-dock";
  cornerDock.className = "idle-corner-dock";
  cornerDock.innerHTML = `<img id="idle-art" alt="Art" /><div class="idle-meta"><div id="idle-title"></div><div id="idle-artist"></div></div>`;
  document.body.appendChild(cornerDock);
}

function updateSmartArtPlacement() {
  const isIdle = document.body.classList.contains("hud-idle");
  const isIdleOrFull = isIdle || Boolean(document.fullscreenElement);

  const centeredViz = renderer.isCenteredArtMode();
  const showCenter = Boolean(
    prefs.smartIdleArt &&
    isIdleOrFull &&
    centeredViz &&
    (!prefs.lyrics.enabled || prefs.lyrics.showAlbumArt) &&
    !prefs.lyricFocus
  );
  renderer.showCenterArt = showCenter;

  const showCorner = Boolean(prefs.smartIdleArt && isIdleOrFull && !centeredViz && prefs.hud !== "hidden");
  cornerDock.classList.toggle("visible", showCorner);

  lyrics.updateSceneContext({
    hudMode: prefs.hud,
    isIdle,
    centerArtActive: showCenter,
    artScale: Number(prefs.artScale) || 1,
    drawerOpen: !document.getElementById("custom-drawer")?.classList.contains("hidden")
  });
}

function maybeShowDisplayExitHint() {
  if (!displayExitHint || prefs.hud !== "hidden") return;
  if (localStorage.getItem("vspotify_exit_hint_shown")) return;
  localStorage.setItem("vspotify_exit_hint_shown", "1");
  displayExitHint.classList.add("visible");
  clearTimeout(exitHintTimer);
  exitHintTimer = setTimeout(() => displayExitHint.classList.remove("visible"), 4000);
}

function getVizPreviewSvg(v) {
  if (v.tech === "WebGL") {
    return `<svg viewBox="0 0 64 24" aria-hidden="true"><circle cx="32" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.7"/><circle cx="32" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.45"/><circle cx="32" cy="12" r="2" fill="currentColor"/></svg>`;
  }
  if (v.category === "Legacy FX") {
    return `<svg viewBox="0 0 64 24" aria-hidden="true"><path d="M4 16 Q16 4 28 14 T52 10 L60 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4 18 Q20 22 36 12 T60 18" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4"/></svg>`;
  }
  if (v.category === "Technical") {
    return `<svg viewBox="0 0 64 24" aria-hidden="true"><rect x="6" y="10" width="5" height="10" rx="1" fill="currentColor" opacity="0.5"/><rect x="14" y="6" width="5" height="14" rx="1" fill="currentColor" opacity="0.85"/><rect x="22" y="12" width="5" height="8" rx="1" fill="currentColor" opacity="0.45"/><path d="M34 15 L40 9 L46 16 L52 7 L58 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }
  if (v.category === "Spatial") {
    return `<svg viewBox="0 0 64 24" aria-hidden="true"><circle cx="20" cy="12" r="2" fill="currentColor"/><circle cx="32" cy="7" r="2.5" fill="currentColor" opacity="0.8"/><circle cx="44" cy="15" r="1.8" fill="currentColor" opacity="0.6"/><path d="M12 18 C24 10 40 14 54 6" fill="none" stroke="currentColor" stroke-width="1.1" opacity="0.45"/></svg>`;
  }
  return `<svg viewBox="0 0 64 24" aria-hidden="true"><rect x="10" y="11" width="4" height="9" rx="1.5" fill="currentColor" opacity="0.5"/><rect x="18" y="6" width="4" height="14" rx="1.5" fill="currentColor" opacity="0.8"/><rect x="26" y="3" width="4" height="17" rx="1.5" fill="currentColor"/><rect x="34" y="8" width="4" height="12" rx="1.5" fill="currentColor" opacity="0.8"/><rect x="42" y="12" width="4" height="8" rx="1.5" fill="currentColor" opacity="0.5"/><rect x="50" y="9" width="4" height="11" rx="1.5" fill="currentColor" opacity="0.65"/></svg>`;
}

// Categorized Visualizer Browser
let activeBrowserCat = "All";
function renderVisualizerBrowser() {
  const grid = document.getElementById("viz-browser-grid");
  if (!grid) return;
  const list = activeBrowserCat === "All"
    ? VISUALIZER_REGISTRY
    : activeBrowserCat === "Favorites"
      ? VISUALIZER_REGISTRY.filter((v) => prefs.favorites.includes(v.id))
      : VISUALIZER_REGISTRY.filter((v) => v.category === activeBrowserCat);

  grid.innerHTML = list.map((v) => {
    const isFav = prefs.favorites.includes(v.id);
    const isActive = prefs.viz === v.id;
    return `
      <div class="viz-item-card ${isActive ? "active" : ""}" data-viz-id="${v.id}">
        <div class="viz-browser-top">
          <span class="viz-browser-cat">${v.category} · ${v.tech}</span>
          <button type="button" class="viz-fav-btn ${isFav ? "is-fav" : ""}" data-fav-id="${v.id}" aria-label="Toggle favorite ${v.name}">${isFav ? "★" : "☆"}</button>
        </div>
        <div class="viz-item-preview">${getVizPreviewSvg(v)}</div>
        <div class="viz-browser-name">${v.name}</div>
        <div class="viz-browser-desc">${v.desc}</div>
      </div>
    `;
  }).join("") || `<p class="hint-text">No favorites saved yet. Click ☆ on any visualizer.</p>`;

  grid.querySelectorAll(".viz-item-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".viz-fav-btn")) return;
      prefs.viz = card.dataset.vizId;
      savePrefs();
      syncControlsFromPrefs();
      applyPrefs();
      renderVisualizerBrowser();
    });
  });

  grid.querySelectorAll(".viz-fav-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.favId;
      if (prefs.favorites.includes(id)) {
        prefs.favorites = prefs.favorites.filter((f) => f !== id);
      } else {
        prefs.favorites.push(id);
      }
      savePrefs();
      renderVisualizerBrowser();
    });
  });
}

function triggerSurpriseMe() {
  const pool = prefs.favorites.length >= 3
    ? VISUALIZER_REGISTRY.filter((v) => prefs.favorites.includes(v.id) && v.id !== prefs.viz)
    : VISUALIZER_REGISTRY.filter((v) => v.id !== prefs.viz);
  const pick = pool[Math.floor(Math.random() * pool.length)] || VISUALIZER_REGISTRY[0];
  prefs.viz = pick.id;
  savePrefs();
  syncControlsFromPrefs();
  applyPrefs();
  renderVisualizerBrowser();
}

// Build 4-Section Progressive Customization Drawer
function buildDrawerUI() {
  const body = document.getElementById("drawer-body");
  if (!body) return;

  const vizOptions = VISUALIZER_REGISTRY.map((v) => `<option value="${v.id}">${v.name} (${v.category})</option>`).join("");
  const eqOptions = SUPERSCOPE_EQUATIONS.map((eq) => `<option value="${eq}">${eq[0].toUpperCase() + eq.slice(1)}</option>`).join("");

  const styleCardsHtml = LYRIC_STYLES.map((s) => `
    <button type="button" class="scene-card" data-scene-id="${s.id}">
      <div class="scene-thumb">${SCENE_PREVIEWS[s.id] || ""}</div>
      <div class="scene-card-meta">
        <div class="scene-card-title">${s.name}</div>
        <div class="scene-card-desc">${s.description}</div>
      </div>
    </button>
  `).join("");

  const comboCardsHtml = CURATED_COMBOS.map((c) => `
    <button type="button" class="mood-card" data-combo="${c.id}">
      <div class="mood-card-title">${c.id}</div>
      <div class="mood-card-sub">${c.subtitle}</div>
    </button>
  `).join("");

  body.innerHTML = `
    <section class="control-group">
      <h3>Scene</h3>
      <label class="toggle-row"><span>Enable Lyrics</span><input type="checkbox" class="switch" id="lyr-enabled" /></label>
      <div class="mood-grid" id="mood-grid">${comboCardsHtml}</div>
      <details class="progressive-details">
        <summary>Browse all 14 lyric scenes</summary>
        <div class="scene-grid" id="scene-grid">${styleCardsHtml}</div>
      </details>
      <label class="select-row" style="margin-top:10px">
        <span>Placement</span>
        <select id="lyr-placement">
          <option value="adaptive">Adaptive</option>
          <option value="center">Center</option>
          <option value="upper">Upper</option>
          <option value="lower">Lower</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </label>
    </section>

    <section class="control-group">
      <h3>Atmosphere</h3>
      <label class="select-row">
        <span>Performance Profile</span>
        <select id="opt-perf-mode">
          <option value="cinematic">Cinematic</option>
          <option value="balanced">Balanced</option>
          <option value="battery-saver">Battery Saver</option>
        </select>
      </label>
      <label class="select-row">
        <span>Background Mode</span>
        <select id="lyr-bg-mode">
          <option value="adaptive">Adaptive</option>
          <option value="album-blur">Album Blur</option>
          <option value="album-aura">Album Aura</option>
          <option value="liquid-glass">Liquid Glass</option>
          <option value="pulse-halo">Pulse Halo</option>
          <option value="grain-vignette">Grain + Vignette</option>
          <option value="night-sky">Night Sky</option>
        </select>
      </label>
      <label class="select-row">
        <span>Background Motion</span>
        <select id="lyr-bg-motion">
          <option value="off">Off</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <label class="select-row">
        <span>Visualizer Intensity</span>
        <select id="opt-viz-intensity">
          <option value="subtle">Subtle</option>
          <option value="balanced">Balanced</option>
          <option value="vivid">Vivid</option>
        </select>
      </label>
      <details class="progressive-details">
        <summary>Audio visualizer &amp; HUD</summary>
        <div class="details-inner">
          <label class="select-row"><span>Audio Visualizer</span><select id="opt-viz-select">${vizOptions}</select></label>
          <label class="select-row"><span>SuperScope Equation</span><select id="opt-scope-eq">${eqOptions}</select></label>
          <label class="toggle-row"><span>Surprise Me on Track Change</span><input type="checkbox" class="switch" id="opt-surprise-rotate" /></label>
          <div class="segmented-row" id="hud-selector" style="margin-bottom:10px">
            <button type="button" class="seg-btn" data-hud="cinema">Cinema</button>
            <button type="button" class="seg-btn" data-hud="minimal">Minimal</button>
            <button type="button" class="seg-btn" data-hud="centered">Centered</button>
            <button type="button" class="seg-btn" data-hud="hidden">Hidden</button>
          </div>
          <label class="select-row"><span>Surface Finish</span><select id="opt-theme-mode"><option value="obsidian">Obsidian Glass</option><option value="warm">Warm Espresso</option></select></label>
          <label class="toggle-row"><span>Auto-match Album Art</span><input type="checkbox" class="switch" id="opt-auto-color" /></label>
          <label class="slider-row"><span>Manual Accent</span><input type="color" id="opt-accent-color" /></label>
        </div>
      </details>
    </section>

    <section class="control-group">
      <h3>Typography</h3>
      <label class="slider-row"><span>Text Scale</span><input type="range" id="lyr-scale" min="0.75" max="1.55" step="0.05" /></label>
      <label class="slider-row"><span>Text Width</span><input type="range" id="lyr-width" min="0.65" max="1.2" step="0.05" /></label>
      <label class="select-row"><span>Contrast</span><select id="lyr-contrast"><option value="soft">Soft</option><option value="balanced">Balanced</option><option value="crisp">Crisp Backplate</option></select></label>
      <label class="select-row"><span>Font Treatment</span><select id="lyr-font"><option value="sans">Modern Sans</option><option value="serif">Editorial Serif</option><option value="mono">Technical Mono</option></select></label>
    </section>

    <section class="control-group">
      <h3>Playback &amp; Lyrics</h3>
      <div class="drawer-status-row"><span>Source status</span><strong id="lyrics-quality-badge">Idle</strong></div>
      <label class="select-row"><span>Lyric Source</span><select id="lyr-source"><option value="lrclib-first">LRCLIB Public API</option><option value="imported-first">Imported First</option><option value="imported-only">Local Imported Only</option></select></label>
      <label class="toggle-row"><span>Follow Playback</span><input type="checkbox" class="switch" id="lyr-follow" /></label>
      <label class="slider-row"><span>Timing Offset (ms)</span><input type="range" id="lyr-offset" min="-5000" max="5000" step="100" /></label>
      <div class="btn-row">
        <label class="glass-pill action-pill file-label">Import Lyrics<input type="file" id="lyr-import-file" accept=".lrc,.txt,.json" hidden /></label>
        <button type="button" id="lyr-retry" class="glass-pill action-pill">Retry</button>
        <button type="button" id="lyr-reset-offset" class="glass-pill action-pill">Reset Offset</button>
        <button type="button" id="lyr-clear-cache" class="glass-pill action-pill">Clear Cache</button>
      </div>
      <details class="progressive-details" style="margin-top:10px">
        <summary>Advanced motion, audio &amp; diagnostics</summary>
        <div class="details-inner">
          <div id="perf-diagnostics" class="drawer-status-row" style="font-family:ui-monospace,monospace;font-size:0.72rem">
            <span>FPS: -- · DPR: --</span><strong id="diag-tier">--</strong>
          </div>
          <div class="btn-row" style="margin-bottom:10px">
            <button type="button" id="lyr-prev-line" class="glass-pill action-pill">Prev Line</button>
            <button type="button" id="lyr-next-line" class="glass-pill action-pill">Next Line</button>
            <button type="button" id="btn-demo-synth" class="glass-pill action-pill">Demo Scene</button>
            <label class="glass-pill action-pill file-label">Local Audio<input type="file" id="input-local-audio" accept="audio/*" hidden /></label>
          </div>
          <label class="toggle-row"><span>Show Center Art in Scenes</span><input type="checkbox" class="switch" id="lyr-show-art" /></label>
          <label class="toggle-row"><span>Smart Fullscreen Art</span><input type="checkbox" class="switch" id="opt-smart-art" /></label>
          <label class="select-row"><span>Reduced Motion</span><select id="lyr-reduced-motion"><option value="system">System</option><option value="reduce">Reduce</option><option value="full">Full</option></select></label>
          <label class="slider-row"><span>Motion Intensity</span><input type="range" id="lyr-motion" min="0" max="1.5" step="0.1" /></label>
          <label class="slider-row"><span>Connector Glow</span><input type="range" id="lyr-connector" min="0.2" max="2" step="0.1" /></label>
          <label class="slider-row"><span>Visualizer Sensitivity</span><input type="range" id="opt-sensitivity" min="0.4" max="2.5" step="0.05" /></label>
          <label class="slider-row"><span>Visualizer Smoothing</span><input type="range" id="opt-smoothing" min="0.1" max="0.95" step="0.05" /></label>
          <label class="slider-row"><span>Visualizer Density</span><input type="range" id="opt-density" min="24" max="128" step="8" /></label>
          <label class="slider-row"><span>Glow</span><input type="range" id="opt-glow" min="0" max="40" /></label>
          <label class="select-row"><span>Auto-Hide HUD</span><select id="opt-autohide"><option value="0">Never</option><option value="3000">3 seconds</option><option value="5000">5 seconds</option><option value="10000">10 seconds</option></select></label>
        </div>
      </details>
    </section>
  `;
}

function syncControlsFromPrefs() {
  const map = {
    "opt-auto-color": ["autoColor", true],
    "opt-smart-art": ["smartIdleArt", true],
    "opt-surprise-rotate": ["surpriseRotate", true],
    "opt-accent-color": ["accent", false],
    "opt-theme-mode": ["themeMode", false],
    "opt-perf-mode": ["perfMode", false],
    "opt-viz-intensity": ["vizIntensity", false],
    "opt-viz-select": ["viz", false],
    "opt-scope-eq": ["scopeEquation", false],
    "opt-glow": ["glow", false],
    "opt-autohide": ["autohideMs", false],
    "opt-sensitivity": ["sensitivity", false],
    "opt-smoothing": ["smoothing", false],
    "opt-density": ["density", false]
  };
  for (const [id, [key, isCheck]] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el[isCheck ? "checked" : "value"] = prefs[key];
  }

  const lyrMap = {
    "lyr-enabled": ["enabled", true],
    "lyr-source": ["sourcePriority", false],
    "lyr-bg-mode": ["bgMode", false],
    "lyr-bg-motion": ["bgMotion", false],
    "lyr-scale": ["textScale", false],
    "lyr-width": ["textWidth", false],
    "lyr-contrast": ["contrast", false],
    "lyr-font": ["fontTreatment", false],
    "lyr-placement": ["placement", false],
    "lyr-motion": ["motionIntensity", false],
    "lyr-connector": ["connectorStrength", false],
    "lyr-show-art": ["showAlbumArt", true],
    "lyr-offset": ["offsetMs", false],
    "lyr-follow": ["followPlayback", true],
    "lyr-reduced-motion": ["reducedMotion", false]
  };
  for (const [id, [key, isCheck]] of Object.entries(lyrMap)) {
    const el = document.getElementById(id);
    if (el) el[isCheck ? "checked" : "value"] = prefs.lyrics[key];
  }

  document.querySelectorAll(".scene-card").forEach((el) => {
    el.classList.toggle("active", el.dataset.sceneId === prefs.lyrics.style);
  });
}

function applyPrefs() {
  governor.setMode(prefs.perfMode);
  if (lastAppliedViz !== prefs.viz) {
    lastAppliedViz = prefs.viz;
    if (prefs.viz !== "retro-audio-lab") fallbackFromViz = null;
    governor.resetForVisualizer();
  }
  renderer.setMode(prefs.viz);
  renderer.legacy.scopeEquation = prefs.scopeEquation || "infinity";
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
  setPalette(prefs.bgColor || "#08080a", colors);

  const idleKeep = document.body.classList.contains("hud-idle") ? " hud-idle" : "";
  const heroKeep = document.body.classList.contains("lyrics-hero-active") ? " lyrics-hero-active" : "";
  const focusKeep = prefs.lyricFocus ? " lyric-focus" : "";
  document.body.className = `hud-${prefs.hud} bg-${prefs.bgStyle} theme-${prefs.themeMode} viz-int-${prefs.vizIntensity}${idleKeep}${heroKeep}${focusKeep}`;

  if (btnLyricFocus) {
    btnLyricFocus.setAttribute("aria-pressed", String(Boolean(prefs.lyricFocus)));
    btnLyricFocus.classList.toggle("active", Boolean(prefs.lyricFocus));
  }

  document.querySelectorAll(".seg-btn").forEach((el) => {
    el.classList.toggle("active", el.dataset.hud === prefs.hud);
  });

  lyrics.applyPrefs(prefs.lyrics);
  updateSceneCapsule();
  updateSmartArtPlacement();
  maybeShowDisplayExitHint();
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

    if (track.trackKey && track.trackKey !== lastTrackKey) {
      lastTrackKey = track.trackKey;
      if (prefs.surpriseRotate) triggerSurpriseMe();
    }

    if (track.artUrl && trackArt.src !== track.artUrl) {
      trackArt.src = track.artUrl;
      document.getElementById("idle-art").src = track.artUrl;
      bgLayer.style.backgroundImage = `url("${track.artUrl}")`;
      bgLayer.classList.add("has-art");
      analyzeAlbumArtUrl(track.artUrl);
    }
  },
  onPlaybackSnapshot: (snapshot) => {
    lyrics.onPlaybackSnapshot(snapshot);
  }
});

// Idle & Auto-hide
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

["mousemove", "mousedown", "keydown"].forEach((evt) => window.addEventListener(evt, resetIdleTimer));
document.addEventListener("fullscreenchange", updateSmartArtPlacement);
window.addEventListener("resize", () => renderer.resize(window.innerWidth, window.innerHeight, governor.getConfig().dpr));

// Build Drawer & Wire Controls
buildDrawerUI();

const drawer = document.getElementById("custom-drawer");
const toggleDrawer = (force) => {
  const open = typeof force === "boolean" ? force : drawer.classList.contains("hidden");
  drawer.classList.toggle("hidden", !open);
  setTimeout(() => updateSmartArtPlacement(), 50);
};

document.getElementById("btn-toggle-drawer").onclick = () => toggleDrawer();
document.getElementById("btn-close-drawer").onclick = () => toggleDrawer(false);
document.getElementById("btn-reset-scene").onclick = () => {
  prefs.lyrics = { ...defaultLyricsPrefs };
  prefs.vizIntensity = "balanced";
  savePrefs();
  syncControlsFromPrefs();
  applyPrefs();
};

if (btnLyricFocus) {
  btnLyricFocus.onclick = () => {
    prefs.lyricFocus = !prefs.lyricFocus;
    savePrefs();
    applyPrefs();
  };
}

document.getElementById("btn-surprise").onclick = triggerSurpriseMe;

const vizBrowserModal = document.getElementById("viz-browser-modal");
document.getElementById("btn-viz-browser").onclick = () => {
  renderVisualizerBrowser();
  vizBrowserModal.classList.toggle("hidden");
};
document.getElementById("btn-close-viz-browser").onclick = () => vizBrowserModal.classList.add("hidden");
document.getElementById("btn-browser-surprise").onclick = triggerSurpriseMe;
document.querySelectorAll(".viz-tab").forEach((tab) => {
  tab.onclick = () => {
    activeBrowserCat = tab.dataset.cat;
    document.querySelectorAll(".viz-tab").forEach((t) => t.classList.toggle("active", t === tab));
    renderVisualizerBrowser();
  };
});

document.getElementById("btn-fullscreen").onclick = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
};

const captureBtn = document.getElementById("btn-capture-audio");
if (captureBtn) {
  captureBtn.onclick = async () => {
    try {
      await audio.startTabCapture();
      deviceStatus.textContent = "Tab Audio Live";
    } catch (err) {
      alert(err.message);
    }
  };
}

const topActions = document.querySelector(".top-actions");
if (topActions && !document.getElementById("btn-play-here")) {
  const playHereBtn = document.createElement("button");
  playHereBtn.id = "btn-play-here";
  playHereBtn.className = "glass-pill action-pill";
  playHereBtn.style.display = "none";
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

document.querySelectorAll(".seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    prefs.hud = btn.dataset.hud;
    savePrefs();
    applyPrefs();
  });
});

// Curated Combos & 14-Scene Cards
document.querySelectorAll(".mood-card").forEach((card) => {
  card.addEventListener("click", () => {
    const combo = CURATED_COMBOS.find((c) => c.id === card.dataset.combo);
    if (!combo) return;
    prefs.viz = combo.viz;
    Object.assign(prefs.lyrics, combo.lyrics);
    savePrefs();
    syncControlsFromPrefs();
    applyPrefs();
  });
});

document.querySelectorAll(".scene-card").forEach((card) => {
  card.addEventListener("click", () => {
    prefs.lyrics.style = card.dataset.sceneId;
    prefs.lyrics.enabled = true;
    savePrefs();
    syncControlsFromPrefs();
    applyPrefs();
  });
});

document.getElementById("lyr-prev-line").onclick = () => lyrics.stepStatic(-1);
document.getElementById("lyr-next-line").onclick = () => lyrics.stepStatic(1);
document.getElementById("lyr-reset-offset").onclick = () => {
  prefs.lyrics.offsetMs = 0;
  savePrefs();
  syncControlsFromPrefs();
  applyPrefs();
};
document.getElementById("lyr-retry").onclick = () => lyrics.retry();
document.getElementById("lyr-clear-cache").onclick = () => {
  lyrics.clearCache();
  lyrics.retry();
};
document.getElementById("lyr-import-file").onchange = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    await lyrics.importLocalFile(file);
  } catch (err) {
    alert(err.message);
  }
};

function startDemoScene() {
  const active = audio.toggleDemoSynth((meta) => {
    trackTitle.textContent = meta.title;
    trackArtist.textContent = meta.artist;
    btnPlay.dataset.playing = "true";
    lyrics.onPlaybackSnapshot({
      trackKey: "demo:synth",
      name: meta.title,
      artists: meta.artist,
      duration: 28000,
      position: 0,
      paused: false,
      observedAt: performance.now(),
      source: "sdk"
    });
  });
  if (!active) {
    btnPlay.dataset.playing = "false";
    lyrics.onPlaybackSnapshot({ trackKey: "demo:synth", paused: true, position: 0, observedAt: performance.now(), source: "sdk" });
  }
}

document.getElementById("btn-demo-synth").onclick = startDemoScene;
document.getElementById("input-local-audio").onchange = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  audio.loadLocalFile(file, (meta) => {
    trackTitle.textContent = meta.title;
    trackArtist.textContent = meta.artist;
    btnPlay.dataset.playing = "true";
    lyrics.onPlaybackSnapshot({
      trackKey: `local:${file.name}`,
      name: meta.title,
      artists: meta.artist,
      duration: 0,
      position: 0,
      paused: false,
      observedAt: performance.now(),
      source: "sdk"
    });
  });
};

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

document.getElementById("btn-play").onclick = () => spotify.togglePlay();
document.getElementById("btn-next").onclick = () => spotify.nextTrack();
document.getElementById("btn-prev").onclick = () => spotify.previousTrack();
seekBar.onchange = () => {
  if (currentDurationMs) spotify.seek((seekBar.value / 100) * currentDurationMs);
};

const bindInput = (id, key, isCheck = false, targetObj = prefs) => {
  const el = document.getElementById(id);
  if (!el) return;
  el[isCheck ? "checked" : "value"] = targetObj[key];
  el.addEventListener("input", () => {
    targetObj[key] = isCheck ? el.checked : el.value;
    savePrefs();
    syncControlsFromPrefs();
    applyPrefs();
  });
};

[
  ["opt-auto-color", "autoColor", true],
  ["opt-smart-art", "smartIdleArt", true],
  ["opt-surprise-rotate", "surpriseRotate", true],
  ["opt-accent-color", "accent", false],
  ["opt-theme-mode", "themeMode", false],
  ["opt-perf-mode", "perfMode", false],
  ["opt-viz-intensity", "vizIntensity", false],
  ["opt-viz-select", "viz", false],
  ["opt-scope-eq", "scopeEquation", false],
  ["opt-glow", "glow", false],
  ["opt-autohide", "autohideMs", false],
  ["opt-sensitivity", "sensitivity", false],
  ["opt-smoothing", "smoothing", false],
  ["opt-density", "density", false]
].forEach(([id, key, isCheck]) => bindInput(id, key, isCheck, prefs));

[
  ["lyr-enabled", "enabled", true],
  ["lyr-source", "sourcePriority", false],
  ["lyr-bg-mode", "bgMode", false],
  ["lyr-bg-motion", "bgMotion", false],
  ["lyr-scale", "textScale", false],
  ["lyr-width", "textWidth", false],
  ["lyr-contrast", "contrast", false],
  ["lyr-font", "fontTreatment", false],
  ["lyr-placement", "placement", false],
  ["lyr-motion", "motionIntensity", false],
  ["lyr-connector", "connectorStrength", false],
  ["lyr-show-art", "showAlbumArt", true],
  ["lyr-offset", "offsetMs", false],
  ["lyr-follow", "followPlayback", true],
  ["lyr-reduced-motion", "reducedMotion", false]
].forEach(([id, key, isCheck]) => bindInput(id, key, isCheck, prefs.lyrics));

// Shortcuts & Onboarding
const shortcutsModal = document.getElementById("shortcuts-modal");
document.getElementById("btn-shortcuts").onclick = () => shortcutsModal.classList.toggle("hidden");
document.getElementById("btn-close-shortcuts").onclick = () => shortcutsModal.classList.add("hidden");

const onboardModal = document.getElementById("onboarding-modal");
let onboardStep = 0;

function renderOnboardStep() {
  const stepLabel = document.getElementById("onboard-step-label");
  const body = document.getElementById("onboard-body");
  const backBtn = document.getElementById("btn-onboard-back");
  const nextBtn = document.getElementById("btn-onboard-next");
  if (!stepLabel || !body) return;

  stepLabel.textContent = `Step ${onboardStep + 1} of 4`;
  backBtn.style.visibility = onboardStep === 0 ? "hidden" : "visible";
  nextBtn.textContent = onboardStep === 3 ? "Enter VSpotify" : "Continue";

  if (onboardStep === 0) {
    body.innerHTML = `<h2 id="onboard-title">Welcome to VSpotify</h2><p class="hint-text">A calm, fullscreen visual instrument for your music. Connect your Spotify account to follow playback and animate lyrics.</p><div class="btn-row"><button type="button" id="onboard-connect-btn" class="glass-pill action-pill accent-pill">Connect Spotify</button></div>`;
    document.getElementById("onboard-connect-btn").onclick = () => {
      onboardModal.classList.add("hidden");
      modal.classList.remove("hidden");
    };
  } else if (onboardStep === 1) {
    body.innerHTML = `<h2 id="onboard-title">Choose Playback Mode</h2><p class="hint-text">You can switch anytime from the top bar.</p><div class="onboard-choices"><div class="onboard-choice"><strong>Follow another device</strong><span>Keep playing on your Mac, phone, or speaker—VSpotify syncs track info and lyrics automatically.</span></div><div class="onboard-choice"><strong>Play here for live reactivity</strong><span>Click <em>Play Here</em> + <em>Tab Audio</em> in Chrome for zero-delay 60fps audio reactivity.</span></div></div>`;
  } else if (onboardStep === 2) {
    body.innerHTML = `<h2 id="onboard-title">Pick a Curated Scene</h2><p class="hint-text">Pairs an audio visualizer with a matching lyric mood.</p><div class="mood-grid">${CURATED_COMBOS.slice(0, 4).map((c) => `<button type="button" class="mood-card onboard-mood" data-combo="${c.id}"><div class="mood-card-title">${c.id}</div><div class="mood-card-sub">${c.subtitle}</div></button>`).join("")}</div>`;
    body.querySelectorAll(".onboard-mood").forEach((btn) => {
      btn.onclick = () => {
        const combo = CURATED_COMBOS.find((c) => c.id === btn.dataset.combo);
        if (combo) {
          prefs.viz = combo.viz;
          Object.assign(prefs.lyrics, combo.lyrics);
          savePrefs();
          syncControlsFromPrefs();
          applyPrefs();
        }
        body.querySelectorAll(".onboard-mood").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      };
    });
  } else {
    body.innerHTML = `<h2 id="onboard-title">Lyrics &amp; Local Imports</h2><p class="hint-text">Lyrics are fetched from public sources when available. If a track has no match, import any local <code>.lrc</code> or <code>.txt</code> file inside Customize → Playback &amp; Lyrics.</p><div class="btn-row"><button type="button" id="onboard-demo-btn" class="glass-pill action-pill">Try Demo Scene (No Spotify)</button></div>`;
    document.getElementById("onboard-demo-btn").onclick = () => {
      localStorage.setItem("vspotify_onboarded_v1", "1");
      onboardModal.classList.add("hidden");
      startDemoScene();
    };
  }
}

function finishOnboarding() {
  localStorage.setItem("vspotify_onboarded_v1", "1");
  onboardModal?.classList.add("hidden");
}

if (onboardModal) {
  document.getElementById("btn-onboard-skip").onclick = finishOnboarding;
  document.getElementById("btn-onboard-back").onclick = () => { onboardStep = Math.max(0, onboardStep - 1); renderOnboardStep(); };
  document.getElementById("btn-onboard-next").onclick = () => { if (onboardStep < 3) { onboardStep++; renderOnboardStep(); } else finishOnboarding(); };
  if (!localStorage.getItem("vspotify_onboarded_v1") && !window.location.search.includes("code=")) {
    renderOnboardStep();
    onboardModal.classList.remove("hidden");
  }
}

window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  const vizMap = {
    "1": "bars", "2": "radial", "3": "waveform", "4": "particles",
    "5": "horizon", "6": "matrix", "7": "milkdrop", "8": "plasma",
    "9": "mirror", "0": "vinyl"
  };
  if (e.key === "?") {
    e.preventDefault();
    shortcutsModal.classList.toggle("hidden");
  } else if (e.key === "Escape") {
    shortcutsModal.classList.add("hidden");
    vizBrowserModal.classList.add("hidden");
    modal.classList.add("hidden");
    toggleDrawer(false);
    if (prefs.hud === "hidden") {
      prefs.hud = "cinema";
      savePrefs();
      applyPrefs();
    }
  } else if (vizMap[e.key]) {
    prefs.viz = vizMap[e.key];
    savePrefs();
    syncControlsFromPrefs();
    applyPrefs();
  } else if (e.key.toLowerCase() === "b") {
    renderVisualizerBrowser();
    vizBrowserModal.classList.toggle("hidden");
  } else if (e.key.toLowerCase() === "r") {
    triggerSurpriseMe();
  } else if (e.key.toLowerCase() === "f") {
    document.getElementById("btn-fullscreen").click();
  } else if (e.key.toLowerCase() === "c") {
    toggleDrawer();
  } else if (e.key.toLowerCase() === "l") {
    prefs.lyrics.enabled = !prefs.lyrics.enabled;
    savePrefs();
    syncControlsFromPrefs();
    applyPrefs();
  } else if (e.key.toLowerCase() === "v") {
    prefs.lyricFocus = !prefs.lyricFocus;
    savePrefs();
    applyPrefs();
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

// Single Central Animation Loop (paused when hidden or obscured by setup/onboarding)
let lastDiagAt = 0;
function loop(now = performance.now()) {
  const obscured = !modal.classList.contains("hidden") || !onboardModal.classList.contains("hidden");
  const isPaused = document.hidden || obscured;

  governor.recordFrame(now, isPaused);

  if (!isPaused) {
    const sample = audio.sample();
    renderer.render(sample);
    lyrics.feedAudioBands(sample.bands);
  }

  if (now - lastDiagAt > 600 && !drawer.classList.contains("hidden")) {
    lastDiagAt = now;
    const diagEl = document.getElementById("perf-diagnostics");
    if (diagEl) {
      const d = governor.getDiagnostics();
      diagEl.firstElementChild.textContent = `FPS: ${d.fps} · DPR: ${d.dpr} · Drop: ${d.droppedFrames}`;
      diagEl.lastElementChild.textContent = `${d.tierName} (${d.mode})`;
    }
  }

  requestAnimationFrame(loop);
}

// Init
syncControlsFromPrefs();
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
requestAnimationFrame(loop);
