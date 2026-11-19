// PerformanceGovernor: rolling frame-time monitor with hysteresis (2s down, 10s up) and safe fallback

export const QUALITY_PROFILES = {
  cinematic: {
    label: "Cinematic",
    maxDpr: 2.0,
    baseTier: 2,
    targetFps: 60
  },
  balanced: {
    label: "Balanced",
    maxDpr: 1.5,
    baseTier: 2,
    targetFps: 60
  },
  "battery-saver": {
    label: "Battery Saver",
    maxDpr: 1.0,
    baseTier: 0,
    targetFps: 30
  }
};

export const TIER_CONFIGS = [
  // Tier 0: Low / Battery Saver
  { tier: 0, name: "Low", dprCap: 1.0, particleRatio: 0.35, segments: 28, glowScale: 0.3, shaderSteps: 6, secondaryLayers: false },
  // Tier 1: Medium
  { tier: 1, name: "Medium", dprCap: 1.25, particleRatio: 0.68, segments: 48, glowScale: 0.65, shaderSteps: 10, secondaryLayers: true },
  // Tier 2: High
  { tier: 2, name: "High", dprCap: 1.5, particleRatio: 1.0, segments: 72, glowScale: 1.0, shaderSteps: 14, secondaryLayers: true }
];

export class PerformanceGovernor {
  constructor(options = {}) {
    this.mode = options.mode || "balanced";
    this.onQualityChange = options.onQualityChange || null;
    this.onFallback = options.onFallback || null;

    const profile = QUALITY_PROFILES[this.mode] || QUALITY_PROFILES.balanced;
    this.tier = profile.baseTier;
    this.frameTimes = new Float32Array(30);
    this.frameIdx = 0;
    this.frameCount = 0;
    this.droppedFrames = 0;
    this.lastTimestamp = performance.now();

    this.slowSince = 0;
    this.stableSince = 0;
    this.extremeLagSince = 0;
    this.lastAdjustAt = 0;
    this.fallbackTriggered = false;
  }

  resetForVisualizer() {
    const profile = QUALITY_PROFILES[this.mode] || QUALITY_PROFILES.balanced;
    this.tier = profile.baseTier;
    this.slowSince = 0;
    this.stableSince = 0;
    this.extremeLagSince = 0;
    this.lastAdjustAt = performance.now();
    this.fallbackTriggered = false;
    this.onQualityChange?.(this.getConfig());
  }

  setMode(mode) {
    if (!QUALITY_PROFILES[mode]) return;
    if (this.mode === mode) return;
    this.mode = mode;
    this.resetForVisualizer();
  }

  getConfig() {
    const base = TIER_CONFIGS[this.tier] || TIER_CONFIGS[1];
    const profile = QUALITY_PROFILES[this.mode] || QUALITY_PROFILES.balanced;
    const dpr = Math.min(window.devicePixelRatio || 1, profile.maxDpr, base.dprCap);
    return {
      ...base,
      mode: this.mode,
      dpr
    };
  }

  recordFrame(now = performance.now(), paused = false) {
    const dt = Math.min(120, Math.max(1, now - this.lastTimestamp));
    this.lastTimestamp = now;

    if (paused) {
      this.slowSince = 0;
      this.stableSince = 0;
      this.extremeLagSince = 0;
      return { dt, fps: 60, changed: false };
    }

    this.frameTimes[this.frameIdx] = dt;
    this.frameIdx = (this.frameIdx + 1) % this.frameTimes.length;
    this.frameCount++;

    if (dt > 24 && this.mode !== "battery-saver") {
      this.droppedFrames++;
    }

    if (this.frameCount < 30 || this.mode === "battery-saver") {
      return { dt, fps: this.getAverageFps(), changed: false };
    }

    const avgFps = this.getAverageFps();
    const maxTier = QUALITY_PROFILES[this.mode]?.baseTier ?? 2;
    let changed = false;

    // 1. Track sustained slow performance (~2 seconds before stepping down)
    if (avgFps < 43) {
      this.stableSince = 0;
      if (!this.slowSince) this.slowSince = now;

      if (this.tier > 0 && now - this.slowSince >= 2000 && now - this.lastAdjustAt >= 2000) {
        this.tier--;
        this.slowSince = 0;
        this.extremeLagSince = 0;
        this.lastAdjustAt = now;
        changed = true;
        this.onQualityChange?.(this.getConfig());
      } else if (this.tier === 0 && avgFps < 28) {
        // Only fall back if already at lowest detail AND extremely laggy for several seconds (4s)
        if (!this.extremeLagSince) this.extremeLagSince = now;
        if (now - this.extremeLagSince >= 4000 && !this.fallbackTriggered) {
          this.fallbackTriggered = true;
          this.onFallback?.("lag");
        }
      } else {
        this.extremeLagSince = 0;
      }
    } else if (avgFps >= 56 && this.tier < maxTier) {
      // 2. Track sustained smooth performance (~10 seconds before stepping up)
      this.slowSince = 0;
      this.extremeLagSince = 0;
      if (!this.stableSince) this.stableSince = now;

      if (now - this.stableSince >= 10000 && now - this.lastAdjustAt >= 10000) {
        this.tier++;
        this.stableSince = 0;
        this.lastAdjustAt = now;
        changed = true;
        this.onQualityChange?.(this.getConfig());
      }
    } else {
      this.slowSince = 0;
      this.stableSince = 0;
      this.extremeLagSince = 0;
    }

    return { dt, fps: avgFps, changed };
  }

  getAverageFps() {
    const count = Math.min(this.frameCount, this.frameTimes.length);
    if (count === 0) return 60;
    let sum = 0;
    for (let i = 0; i < count; i++) sum += this.frameTimes[i];
    const avgDt = sum / count;
    return Math.round(1000 / Math.max(1, avgDt));
  }

  getDiagnostics() {
    const cfg = this.getConfig();
    return {
      fps: this.getAverageFps(),
      dpr: cfg.dpr.toFixed(2),
      tierName: cfg.name,
      mode: this.mode,
      droppedFrames: this.droppedFrames
    };
  }
}
