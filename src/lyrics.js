// LyricsController: manages lyric fetch lifecycle, clock, placement, dynamic backgrounds, and scene rendering
import { PlaybackClock, findActiveLineIndex } from "./lyrics-clock.js";
import { LyricsProviderManager, parseImportedFile } from "./lyrics-provider.js";
import { LyricsPlacementEngine } from "./lyrics-placement.js";
import { LYRIC_STYLE_MAP, LYRIC_STYLES } from "./lyrics-layouts.js";

export class LyricsController {
  constructor(options = {}) {
    this.stageEl = document.getElementById("lyrics-stage");
    this.atmoEl = this.stageEl?.querySelector(".lyrics-atmosphere");
    this.svgEl = document.getElementById("lyrics-connector-layer");
    this.contentEl = document.getElementById("lyrics-content");
    this.statusEl = document.getElementById("lyrics-status");

    this.clock = new PlaybackClock();
    this.provider = new LyricsProviderManager();
    this.placement = new LyricsPlacementEngine();

    this.state = "idle"; // disabled | idle | loading | ready-timed | ready-static | empty | error | imported
    this.doc = null;
    this.activeTrack = null;
    this.abortController = null;
    this.rafId = null;
    this.fadeTimer = null;
    this.latestBands = { bass: 0, mids: 0, treble: 0, energy: 0 };
    this.staticIndex = 0;
    this.lastStaticStepAt = performance.now();

    this.sceneCtx = {
      hudMode: "cinema",
      isIdle: false,
      centerArtActive: false,
      artScale: 1.0,
      palette: ["#e4e4e7", "#a1a1aa"],
      bgColor: "#08080a",
      drawerOpen: false
    };

    this.prefs = {
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
      reducedMotion: "system",
      ...options.initialPrefs
    };

    this.onStateChange = options.onStateChange || null;
    this.activeStyle = null;
    this.layoutCtx = null;
    this.currentRect = null;
    this.resizeTimer = null;

    this.bindObservers();
    this.applyPrefs(this.prefs);
  }

  isReducedMotion() {
    if (this.prefs.reducedMotion === "reduce") return true;
    if (this.prefs.reducedMotion === "full") return false;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  }

  bindObservers() {
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => this.recalculatePlacement(), 80);
      });
      this.ro.observe(document.body);
    }
    window.addEventListener("resize", () => this.recalculatePlacement());
    document.addEventListener("fullscreenchange", () => this.recalculatePlacement());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stopLoop();
      else this.syncLoop();
    });
  }

  setState(nextState, detailText = "") {
    this.state = nextState;
    if (this.stageEl) {
      this.stageEl.dataset.state = nextState;
    }
    if (this.statusEl) {
      if (nextState === "empty") {
        this.statusEl.textContent = "Lyrics unavailable for this track";
      } else if (nextState === "error") {
        this.statusEl.textContent = detailText ? `Lyrics unavailable · ${detailText}` : "Lyrics unavailable";
      } else {
        this.statusEl.textContent = "";
      }
    }
    this.onStateChange?.({
      state: nextState,
      source: this.doc?.source || null,
      timing: this.doc?.timing || null,
      detail: detailText
    });
  }

  applyPrefs(nextPrefs) {
    this.prefs = { ...this.prefs, ...nextPrefs };
    if (!this.stageEl) return;

    this.stageEl.classList.toggle("is-disabled", !this.prefs.enabled);
    this.stageEl.style.setProperty("--lyrics-scale", String(this.prefs.textScale));
    this.stageEl.dataset.bgMotion = this.isReducedMotion() ? "off" : this.prefs.bgMotion;
    this.stageEl.dataset.contrast = this.prefs.contrast || "balanced";
    this.stageEl.dataset.font = this.prefs.fontTreatment || "sans";

    const effectiveStyleId = this.isReducedMotion() && this.prefs.style === "connected-zigzag"
      ? "subtitles-reimagined"
      : this.prefs.style;

    this.switchStyle(effectiveStyleId);
    this.updateAtmosphere();
    this.recalculatePlacement();

    if (!this.prefs.enabled) {
      this.setState("disabled");
      this.stopLoop();
    } else if (this.doc) {
      this.setState(this.doc.source === "imported" ? "imported" : this.doc.timing === "line" ? "ready-timed" : "ready-static");
      this.syncLoop();
    }
  }

  switchStyle(styleId) {
    const next = LYRIC_STYLE_MAP.get(styleId) || LYRIC_STYLES[0];
    if (this.activeStyle?.id === next.id) return;

    if (this.activeStyle && this.layoutCtx) {
      this.activeStyle.destroy?.(this.layoutCtx);
    }
    this.contentEl?.replaceChildren();
    this.svgEl?.replaceChildren();

    this.activeStyle = next;
    this.layoutCtx = {
      contentEl: this.contentEl,
      svgEl: this.svgEl,
      state: {}
    };
    this.activeStyle.mount?.(this.layoutCtx);
    if (this.stageEl) {
      this.stageEl.dataset.style = next.id;
    }
  }

  updateSceneContext(ctx) {
    this.sceneCtx = { ...this.sceneCtx, ...ctx };
    if (this.stageEl) {
      this.stageEl.classList.toggle("drawer-open", Boolean(this.sceneCtx.drawerOpen));
    }
    this.updateAtmosphere();
    this.recalculatePlacement();
  }

  updateAtmosphere() {
    if (!this.stageEl || !this.atmoEl) return;
    let mode = this.prefs.bgMode;
    if (mode === "adaptive") {
      const sid = this.activeStyle?.id;
      mode = sid === "constellation" ? "night-sky"
        : sid === "connected-zigzag" || sid === "ribbon-flow" ? "album-aura"
        : sid === "paper-cut" ? "grain-vignette"
        : "liquid-glass";
    }
    this.stageEl.dataset.bgMode = mode;

    const bg = this.sceneCtx.bgColor || "#08080a";
    const r = parseInt(bg.slice(1, 3), 16) || 8;
    const g = parseInt(bg.slice(3, 5), 16) || 8;
    const b = parseInt(bg.slice(5, 7), 16) || 10;
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    this.stageEl.style.setProperty("--lyrics-ink", lum > 160 ? "#141210" : "#f7f5f0");
    this.stageEl.style.setProperty("--lyrics-ink-muted", lum > 160 ? "rgba(20,18,16,0.62)" : "rgba(247,245,240,0.56)");
  }

  recalculatePlacement() {
    if (!this.contentEl || !this.svgEl) return;
    const rect = this.placement.getPreferredLyricsRect({
      stylePreferred: this.activeStyle?.preferredAnchor || "center",
      placementMode: this.prefs.placement,
      hudMode: this.sceneCtx.hudMode,
      isIdle: this.sceneCtx.isIdle,
      centerArtActive: this.sceneCtx.centerArtActive,
      artScale: this.sceneCtx.artScale,
      densityWidth: this.prefs.textWidth
    });
    this.currentRect = rect;

    this.contentEl.style.left = `${Math.round(rect.x)}px`;
    this.contentEl.style.top = `${Math.round(rect.y)}px`;
    this.contentEl.style.width = `${Math.round(rect.width)}px`;
    this.contentEl.style.height = `${Math.round(rect.height)}px`;
  }

  // Quiet anticipation state while fetching (no harsh skeleton bars)
  renderAnticipationState() {
    if (!this.contentEl) return;
    this.svgEl?.replaceChildren();
    this.contentEl.replaceChildren();
    const wrap = document.createElement("div");
    wrap.className = "lyrics-anticipation";
    const dot = document.createElement("span");
    dot.className = "lyrics-anticipation-dot";
    const line = document.createElement("span");
    line.className = "lyrics-anticipation-line";
    wrap.appendChild(dot);
    wrap.appendChild(line);
    this.contentEl.appendChild(wrap);
  }

  async onPlaybackSnapshot(snapshot) {
    if (!snapshot) return;
    const trackKey = snapshot.trackKey || snapshot.uri || snapshot.trackId || `title:${snapshot.name}`;
    const prevKey = this.activeTrack?.trackKey;

    this.clock.update({ ...snapshot, trackKey });

    if (trackKey !== prevKey) {
      this.activeTrack = {
        trackKey,
        trackId: snapshot.trackId || null,
        title: snapshot.name || "",
        artists: snapshot.artists || "",
        album: snapshot.album || "",
        durationMs: snapshot.duration || 0
      };
      this.staticIndex = 0;
      this.lastStaticStepAt = performance.now();
      this.doc = null;
      this.stopLoop();

      // Smooth crossfade out of previous scene before loading next
      if (this.contentEl) this.contentEl.classList.add("is-transitioning");
      if (this.svgEl) this.svgEl.classList.add("is-transitioning");

      clearTimeout(this.fadeTimer);
      this.fadeTimer = setTimeout(() => {
        this.contentEl?.replaceChildren();
        this.svgEl?.replaceChildren();
        this.contentEl?.classList.remove("is-transitioning");
        this.svgEl?.classList.remove("is-transitioning");

        if (this.prefs.enabled && this.activeTrack?.trackKey === trackKey && this.activeTrack.title) {
          this.loadLyricsForActiveTrack(false);
        }
      }, this.isReducedMotion() ? 40 : 180);
    } else {
      this.syncLoop();
    }
  }

  async loadLyricsForActiveTrack(skipCache = false) {
    if (!this.activeTrack || !this.prefs.enabled) return;

    if (this.abortController) this.abortController.abort();
    this.abortController = new AbortController();
    const targetKey = this.activeTrack.trackKey;

    this.setState("loading");
    this.renderAnticipationState();

    try {
      const doc = await this.provider.fetchLyrics({
        trackKey: targetKey,
        title: this.activeTrack.title,
        artists: this.activeTrack.artists,
        album: this.activeTrack.album,
        durationMs: this.activeTrack.durationMs,
        priority: this.prefs.sourcePriority,
        signal: this.abortController.signal,
        skipCache
      });

      if (!this.activeTrack || this.activeTrack.trackKey !== targetKey) return;

      if (!doc) {
        this.doc = null;
        this.contentEl?.replaceChildren();
        this.svgEl?.replaceChildren();
        this.setState("empty");
        this.stopLoop();
        return;
      }

      this.doc = doc;
      this.contentEl?.replaceChildren();
      this.svgEl?.replaceChildren();
      this.activeStyle?.mount?.(this.layoutCtx);
      this.setState(doc.source === "imported" ? "imported" : doc.timing === "line" ? "ready-timed" : "ready-static");
      this.renderFrame();
      this.syncLoop();
    } catch (err) {
      if (err.name === "AbortError") return;
      if (!this.activeTrack || this.activeTrack.trackKey !== targetKey) return;
      this.doc = null;
      this.contentEl?.replaceChildren();
      this.svgEl?.replaceChildren();
      this.setState("error", err.message);
      this.stopLoop();
    }
  }

  async importLocalFile(file) {
    if (!file) return null;
    const content = await file.text();
    const trackKey = this.activeTrack?.trackKey || `local:${file.name}`;
    const doc = parseImportedFile(file.name, content, trackKey);
    if (!doc) throw new Error("Could not parse lyric lines from that file.");

    this.provider.saveImported(trackKey, doc);
    this.doc = doc;
    this.staticIndex = 0;
    this.contentEl?.replaceChildren();
    this.svgEl?.replaceChildren();
    this.activeStyle?.mount?.(this.layoutCtx);
    this.setState("imported");
    this.renderFrame();
    this.syncLoop();
    return doc;
  }

  clearCache() {
    this.provider.clearCache();
  }

  retry() {
    if (this.activeTrack && this.prefs.enabled) {
      this.loadLyricsForActiveTrack(true);
    }
  }

  stepStatic(delta) {
    if (!this.doc || this.doc.lines.length === 0) return;
    this.staticIndex = Math.max(0, Math.min(this.doc.lines.length - 1, this.staticIndex + delta));
    this.renderFrame();
  }

  feedAudioBands(bands) {
    if (bands) this.latestBands = bands;
  }

  syncLoop() {
    const shouldRun =
      this.prefs.enabled &&
      !document.hidden &&
      Boolean(this.doc) &&
      (!this.clock.paused || this.doc.timing === "static");

    if (shouldRun && !this.rafId) {
      const tick = () => {
        this.renderFrame();
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    } else if (!shouldRun) {
      this.stopLoop();
      if (this.doc && this.prefs.enabled) this.renderFrame();
    }
  }

  stopLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  renderFrame() {
    if (!this.doc || !this.activeStyle || !this.prefs.enabled) return;

    const posMs = this.clock.getPositionMs(this.prefs.offsetMs);
    let activeIdx = -1;

    if (this.doc.timing === "line") {
      activeIdx = this.prefs.followPlayback ? findActiveLineIndex(this.doc.lines, posMs) : this.staticIndex;
    } else if (this.prefs.followPlayback && !this.clock.paused && !this.isReducedMotion()) {
      const now = performance.now();
      if (now - this.lastStaticStepAt > 4800) {
        this.staticIndex = (this.staticIndex + 1) % this.doc.lines.length;
        this.lastStaticStepAt = now;
      }
    }

    const effectiveMotion = this.sceneCtx.drawerOpen
      ? Math.min(0.25, Number(this.prefs.motionIntensity) || 0)
      : (Number(this.prefs.motionIntensity) || 1);

    if (this.atmoEl && !this.isReducedMotion() && this.prefs.bgMotion !== "off" && !this.sceneCtx.drawerOpen) {
      const pulse = 1 + (this.latestBands.energy || 0) * 0.06;
      this.atmoEl.style.transform = `scale(${pulse.toFixed(3)})`;
    }

    this.activeStyle.update({
      ...this.layoutCtx,
      doc: this.doc,
      activeIdx,
      staticIndex: this.staticIndex,
      posMs,
      rect: this.currentRect || this.placement.getPreferredLyricsRect({}),
      bands: this.latestBands,
      reducedMotion: this.isReducedMotion(),
      motionLevel: effectiveMotion,
      connectorStrength: Number(this.prefs.connectorStrength) || 1
    });
  }
}
