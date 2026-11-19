// Legacy FX & Technical Visualizers (Preallocated Typed Arrays & Fixed Pools, Zero Per-Frame GC)

export const VISUALIZER_REGISTRY = [
  // Core
  { id: "bars", name: "Bars", category: "Core", tech: "Canvas 2D", cost: "Low", desc: "Classic spectrum bars with peak caps" },
  { id: "radial", name: "Radial", category: "Core", tech: "Canvas 2D", cost: "Low", desc: "Circular beat spokes around center art" },
  { id: "waveform", name: "Wave", category: "Core", tech: "Canvas 2D", cost: "Low", desc: "Multi-layer glowing oscilloscope" },
  { id: "particles", name: "Particles", category: "Core", tech: "Canvas 2D", cost: "Low", desc: "Audio-reactive drifting field" },
  { id: "horizon", name: "Horizon", category: "Core", tech: "Canvas 2D", cost: "Low", desc: "Layered frequency terrain" },
  { id: "matrix", name: "Matrix", category: "Core", tech: "Canvas 2D", cost: "Low", desc: "Segmented LED equalizer grid" },

  // Spatial
  { id: "vinyl", name: "Vinyl", category: "Spatial", tech: "Canvas 2D", cost: "Low", desc: "Spinning vinyl disc with live album art" },
  { id: "warp", name: "Warp", category: "Spatial", tech: "Canvas 2D", cost: "Low", desc: "3D starfield warp tunnel" },
  { id: "spiral", name: "Spiral", category: "Spatial", tech: "Canvas 2D", cost: "Low", desc: "Rotating multi-arm frequency galaxy" },
  { id: "synthwave", name: "Synthwave", category: "Spatial", tech: "Canvas 2D", cost: "Low", desc: "Segmented sun and perspective grid" },
  { id: "dna", name: "DNA", category: "Spatial", tech: "Canvas 2D", cost: "Low", desc: "Intertwining double-helix wave" },
  { id: "mandala", name: "Mandala", category: "Spatial", tech: "Canvas 2D", cost: "Medium", desc: "12-fold sacred geometry petals" },
  { id: "aurora", name: "Aurora", category: "Spatial", tech: "Canvas 2D", cost: "Medium", desc: "Vertical northern-lights curtains" },
  { id: "orbit", name: "Orbit", category: "Spatial", tech: "Canvas 2D", cost: "Low", desc: "Tilted planetary rings with beat nodes" },

  // Legacy FX (New Expansion)
  { id: "liquid-spectrum", name: "Liquid Spectrum", category: "Legacy FX", tech: "Canvas 2D", cost: "Medium", desc: "Layered flowing ribbons driven by bass, mids, and treble" },
  { id: "fractal-tunnel", name: "Fractal Tunnel", category: "Legacy FX", tech: "WebGL Shader", cost: "Medium-High", desc: "Endless geometric SDF tunnel with beat-driven motion" },
  { id: "kaleidoscope", name: "Kaleidoscope", category: "Legacy FX", tech: "WebGL Shader", cost: "Medium-High", desc: "Mirrored radial symmetry with optional album texture" },
  { id: "superscope", name: "SuperScope", category: "Legacy FX", tech: "Canvas 2D", cost: "Low-Medium", desc: "Vector equation art: infinity, flower, orbit, spiral, mountain, heart" },
  { id: "plasma-reactor", name: "Plasma Reactor", category: "Legacy FX", tech: "WebGL Shader", cost: "High", desc: "Organic plasma field with audio-reactive energy veins" },
  { id: "wireframe-city", name: "Wireframe City", category: "Legacy FX", tech: "Canvas 2D", cost: "Medium", desc: "Moving perspective horizon with frequency skyscrapers" },
  { id: "laser-cathedral", name: "Laser Cathedral", category: "Legacy FX", tech: "Canvas 2D", cost: "Medium", desc: "Symmetrical concert beams and structural bass pulses" },
  { id: "chromatic-bloom", name: "Chromatic Bloom", category: "Legacy FX", tech: "Canvas 2D", cost: "Medium", desc: "Pooled particle blooms, shockwave rings, and color wisps" },
  { id: "crystal-engine", name: "Crystal Engine", category: "Legacy FX", tech: "Canvas 2D", cost: "Medium", desc: "Floating low-poly shards orbiting center album art" },
  { id: "milkdrop", name: "Milkdrop", category: "Legacy FX", tech: "Canvas 2D", cost: "Medium", desc: "Trailing concentric geometric rings" },

  // Technical
  { id: "retro-audio-lab", name: "Retro Audio Lab", category: "Technical", tech: "Canvas 2D", cost: "Low", desc: "Always-smooth VU meters, oscilloscope, spectrum, and tape reels" },
  { id: "plasma", name: "Plasma Ribbons", category: "Technical", tech: "Canvas 2D", cost: "Low", desc: "Flowing interference ribbons" },
  { id: "mirror", name: "Concert", category: "Technical", tech: "Canvas 2D", cost: "Low", desc: "Symmetrical LED mirror spectrum" }
];

export const SUPERSCOPE_EQUATIONS = ["infinity", "flower", "orbit", "spiral", "mountain", "heart"];

const MAX_BLOOM_PARTICLES = 180;
const MAX_BLOOM_RINGS = 14;
const MAX_SHARDS = 28;

export class LegacyFXEngine {
  constructor() {
    this.scopeEquation = "infinity";
    this.phase = 0;

    // Preallocated Chromatic Bloom pools (zero per-frame allocations)
    this.pActive = new Uint8Array(MAX_BLOOM_PARTICLES);
    this.pX = new Float32Array(MAX_BLOOM_PARTICLES);
    this.pY = new Float32Array(MAX_BLOOM_PARTICLES);
    this.pVx = new Float32Array(MAX_BLOOM_PARTICLES);
    this.pVy = new Float32Array(MAX_BLOOM_PARTICLES);
    this.pLife = new Float32Array(MAX_BLOOM_PARTICLES);
    this.pColorIdx = new Uint8Array(MAX_BLOOM_PARTICLES);
    this.pCursor = 0;

    this.rActive = new Uint8Array(MAX_BLOOM_RINGS);
    this.rRad = new Float32Array(MAX_BLOOM_RINGS);
    this.rLife = new Float32Array(MAX_BLOOM_RINGS);
    this.rCursor = 0;
    this.lastBassHit = 0;

    // Preallocated Crystal Engine shards
    this.shardAngle = new Float32Array(MAX_SHARDS);
    this.shardDist = new Float32Array(MAX_SHARDS);
    this.shardSize = new Float32Array(MAX_SHARDS);
    this.shardRot = new Float32Array(MAX_SHARDS);
    this.shardPush = new Float32Array(MAX_SHARDS);
    for (let i = 0; i < MAX_SHARDS; i++) {
      this.shardAngle[i] = (i / MAX_SHARDS) * Math.PI * 2;
      this.shardDist[i] = 0.22 + (i % 3) * 0.065;
      this.shardSize[i] = 10 + (i % 4) * 5;
      this.shardRot[i] = i * 0.7;
    }

    // Preallocated Wireframe City heights
    this.cityHeights = new Float32Array(32);

    // Preallocated Retro Audio Lab ballistic needles & spectrum peaks
    this.vuL = 0;
    this.vuR = 0;
    this.vuPeakL = 0;
    this.vuPeakR = 0;
    this.labBalance = 0;
    this.labPeaks = new Float32Array(36);

    // Preallocated Liquid Spectrum smoothed ribbon curves (7 ribbons x 65 pts)
    this.liquidY = new Float32Array(7 * 65);
    this.liquidInit = false;

    // Preallocated SuperScope vector buffers
    this.scopeX = new Float32Array(181);
    this.scopeY = new Float32Array(181);
  }

  reset() {
    this.pActive.fill(0);
    this.rActive.fill(0);
    this.shardPush.fill(0);
    this.cityHeights.fill(0);
    this.vuL = 0;
    this.vuR = 0;
    this.vuPeakL = 0;
    this.vuPeakR = 0;
    this.labBalance = 0;
    this.labPeaks.fill(0);
    this.liquidY.fill(0);
    this.liquidInit = false;
  }

  render(mode, ctx, w, h, sample, palette, qualityCfg, thickness, speed, sensitivity, artImage, artScale, showCenterArt) {
    this.phase += (0.016 + (sample.bands.energy || 0) * 0.034) * speed;
    const colorAt = (idx) => palette[idx % palette.length];

    switch (mode) {
      case "liquid-spectrum":
        this.drawLiquidSpectrum(ctx, w, h, sample, colorAt, qualityCfg, thickness, sensitivity);
        break;
      case "superscope":
        this.drawSuperScope(ctx, w, h, sample, colorAt, qualityCfg, thickness, sensitivity);
        break;
      case "wireframe-city":
        this.drawWireframeCity(ctx, w, h, sample, colorAt, qualityCfg, sensitivity);
        break;
      case "laser-cathedral":
        this.drawLaserCathedral(ctx, w, h, sample, colorAt, qualityCfg, thickness, sensitivity);
        break;
      case "chromatic-bloom":
        this.drawChromaticBloom(ctx, w, h, sample, colorAt, qualityCfg);
        break;
      case "crystal-engine":
        this.drawCrystalEngine(ctx, w, h, sample, colorAt, qualityCfg, artImage, artScale, showCenterArt);
        break;
      case "retro-audio-lab":
        this.drawRetroAudioLab(ctx, w, h, sample, colorAt, qualityCfg, sensitivity);
        break;
    }
  }

  // #2: Liquid Spectrum — Silky smoothed Bézier frequency ribbons (zero per-frame allocations)
  drawLiquidSpectrum(ctx, w, h, { fft, bands }, colorAt, q, thickness, sensitivity) {
    const ribbons = q.tier === 0 ? 3 : q.tier === 1 ? 5 : 7;
    const pts = Math.max(24, Math.min(64, q.segments));
    const lerp = this.liquidInit ? 0.24 : 1.0;

    for (let r = 0; r < ribbons; r++) {
      const col = colorAt(r);
      const baseY = h * (0.3 + (r / Math.max(1, ribbons - 1)) * 0.4);
      const rowOffset = r * 65;

      for (let i = 0; i <= pts; i++) {
        const t = i / pts;
        const idx = Math.floor(t * (fft.length * 0.55));
        const amp = (fft[idx] / 255) * sensitivity;
        const turb = Math.sin(t * 7.5 + this.phase * (0.95 + r * 0.14)) * (20 + bands.mids * 52);
        const crest = Math.cos(t * 4.2 - this.phase * 0.7 + r * 0.9) * (16 + bands.bass * 64);
        const shimmer = q.secondaryLayers ? Math.sin(t * 18 + this.phase * 2.2 + r) * (bands.treble * 14) : 0;
        const targetY = baseY + turb + crest + shimmer - amp * 88;
        this.liquidY[rowOffset + i] += (targetY - this.liquidY[rowOffset + i]) * lerp;
      }

      // Soft translucent silk fill under the ribbon (Tier 1+)
      if (q.secondaryLayers) {
        ctx.beginPath();
        ctx.moveTo(0, this.liquidY[rowOffset]);
        for (let i = 0; i < pts; i++) {
          const x0 = (i / pts) * w;
          const x1 = ((i + 1) / pts) * w;
          const y0 = this.liquidY[rowOffset + i];
          const y1 = this.liquidY[rowOffset + i + 1];
          ctx.quadraticCurveTo(x0, y0, (x0 + x1) * 0.5, (y0 + y1) * 0.5);
        }
        ctx.lineTo(w, this.liquidY[rowOffset + pts]);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.045 + (r / ribbons) * 0.04;
        ctx.fill();
      }

      // Luminous silk crest line
      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = 0.34 + (r / ribbons) * 0.62;
      ctx.lineWidth = r === ribbons - 1 ? Math.max(1.6, thickness * 0.85) : thickness + bands.bass * 1.5;
      ctx.moveTo(0, this.liquidY[rowOffset]);
      for (let i = 0; i < pts; i++) {
        const x0 = (i / pts) * w;
        const x1 = ((i + 1) / pts) * w;
        const y0 = this.liquidY[rowOffset + i];
        const y1 = this.liquidY[rowOffset + i + 1];
        ctx.quadraticCurveTo(x0, y0, (x0 + x1) * 0.5, (y0 + y1) * 0.5);
      }
      ctx.lineTo(w, this.liquidY[rowOffset + pts]);
      ctx.stroke();
    }
    this.liquidInit = true;
  }

  // #3: SuperScope — 6 parametric vector equations with harmonic echo trace (zero allocations)
  drawSuperScope(ctx, w, h, { time, bands }, colorAt, q, thickness, sensitivity) {
    const pts = Math.max(48, Math.min(180, q.segments * 2));
    const cx = w * 0.5;
    const cy = h * 0.5;
    const radius = Math.min(w, h) * 0.27 * (1 + bands.bass * 0.18);
    const eq = this.scopeEquation;

    for (let i = 0; i <= pts; i++) {
      const u = i / pts;
      const a = u * Math.PI * 2;
      const wave = ((time[i % time.length] - 128) / 128) * sensitivity * 42;
      let x = cx;
      let y = cy;

      if (eq === "infinity") {
        const denom = 1 + Math.sin(a) * Math.sin(a);
        x = cx + (radius * 1.28 * Math.cos(a)) / denom;
        y = cy + (radius * 1.18 * Math.sin(a) * Math.cos(a)) / denom + wave;
      } else if (eq === "flower") {
        const r = radius * (0.64 + 0.36 * Math.cos(6 * a + this.phase)) + wave * 0.65;
        x = cx + Math.cos(a) * r;
        y = cy + Math.sin(a) * r;
      } else if (eq === "orbit") {
        const r = radius * (0.86 + 0.24 * Math.sin(3 * a - this.phase * 1.35)) + wave;
        x = cx + Math.cos(a + this.phase * 0.3) * r;
        y = cy + Math.sin(a + this.phase * 0.3) * r * 0.62;
      } else if (eq === "spiral") {
        const r = u * radius * 1.12 + wave * 0.55;
        const ang = u * Math.PI * 8 + this.phase;
        x = cx + Math.cos(ang) * r;
        y = cy + Math.sin(ang) * r;
      } else if (eq === "mountain") {
        x = w * 0.1 + u * w * 0.8;
        y = cy + Math.sin(u * 10 + this.phase) * 32 - Math.abs(wave) * 1.35;
      } else {
        const scale = (radius / 16) * (0.86 + bands.bass * 0.24);
        x = cx + scale * 16 * Math.pow(Math.sin(a), 3);
        y = cy - scale * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) + wave * 0.35;
      }

      this.scopeX[i] = x;
      this.scopeY[i] = y;
    }

    // Secondary harmonic echo trace (Tier 1+)
    if (q.secondaryLayers) {
      ctx.beginPath();
      ctx.strokeStyle = colorAt(1);
      ctx.shadowColor = colorAt(1);
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = Math.max(1.2, thickness * 0.6);
      const drift = 4 + bands.mids * 12;
      for (let i = 0; i <= pts; i++) {
        const ex = this.scopeX[i] + Math.sin(this.phase + i * 0.08) * drift;
        const ey = this.scopeY[i] + Math.cos(this.phase + i * 0.08) * drift;
        if (i === 0) ctx.moveTo(ex, ey);
        else ctx.lineTo(ex, ey);
      }
      ctx.stroke();
    }

    // Primary crisp vector curve
    ctx.beginPath();
    ctx.strokeStyle = colorAt(0);
    ctx.shadowColor = colorAt(0);
    ctx.lineWidth = thickness;
    ctx.globalAlpha = 0.95;
    for (let i = 0; i <= pts; i++) {
      if (i === 0) ctx.moveTo(this.scopeX[i], this.scopeY[i]);
      else ctx.lineTo(this.scopeX[i], this.scopeY[i]);
    }
    ctx.stroke();

    // Cardinal resonance nodes (Tier 1+)
    if (q.secondaryLayers) {
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.72;
      const step = Math.max(12, Math.floor(pts / 8));
      for (let i = 0; i < pts; i += step) {
        ctx.beginPath();
        ctx.arc(this.scopeX[i], this.scopeY[i], 2.2 + bands.bass * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 6. Wireframe City (front faces & horizon grid only, no hidden back faces)
  drawWireframeCity(ctx, w, h, { fft, bands }, colorAt, q, sensitivity) {
    const horizonY = h * 0.48;
    const gridCol = colorAt(0);
    const bldgCol = colorAt(1);

    // Moving perspective ground grid
    ctx.strokeStyle = gridCol;
    ctx.shadowColor = gridCol;
    ctx.lineWidth = 1.1;
    const vCount = q.tier === 0 ? 8 : 14;
    for (let i = -vCount; i <= vCount; i++) {
      ctx.globalAlpha = 0.26;
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * 24, horizonY);
      ctx.lineTo(w / 2 + i * 165, h);
      ctx.stroke();
    }

    const scroll = (this.phase * 0.35) % 1;
    const rows = q.tier === 0 ? 5 : 8;
    for (let r = 0; r < rows; r++) {
      const p = (r + scroll) / rows;
      const y = horizonY + Math.pow(p, 1.75) * (h - horizonY);
      ctx.globalAlpha = 0.14 + p * 0.35;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Skyline buildings (front faces only)
    const count = q.tier === 0 ? 16 : q.tier === 1 ? 24 : 32;
    const bw = (w * 0.9) / count;
    const startX = w * 0.05;

    ctx.strokeStyle = bldgCol;
    ctx.shadowColor = bldgCol;
    ctx.lineWidth = 1.5;

    for (let i = 0; i < count; i++) {
      const idx = Math.floor((i / count) * (fft.length * 0.55));
      const targetH = 16 + Math.min(1, (fft[idx] / 255) * sensitivity) * (h * 0.34) + bands.bass * 14;
      this.cityHeights[i] += (targetH - this.cityHeights[i]) * 0.25;
      const bh = this.cityHeights[i];
      const bx = startX + i * bw + 3;
      const by = horizonY - bh;

      ctx.fillStyle = "rgba(8, 8, 12, 0.72)";
      ctx.globalAlpha = 0.85;
      ctx.fillRect(bx, by, bw - 6, bh);
      ctx.strokeRect(bx, by, bw - 6, bh);
    }
  }

  // #6: Laser Cathedral — Vaulted bass arches, volumetric additive beams, and horizon haze
  drawLaserCathedral(ctx, w, h, { fft, bands }, colorAt, q, thickness, sensitivity) {
    const cx = w * 0.5;
    const minDim = Math.min(w, h);
    const beams = q.tier === 0 ? 5 : q.tier === 1 ? 8 : 12;
    const arches = q.tier === 0 ? 1 : 3;

    ctx.save();
    if (q.secondaryLayers) {
      ctx.globalCompositeOperation = "lighter";
    }

    // Vaulted cathedral bass arches
    for (let a = 0; a < arches; a++) {
      const col = colorAt(a);
      const r = minDim * (0.36 + a * 0.14 + bands.bass * (0.1 + a * 0.03));
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = (0.18 + Math.min(0.4, bands.bass * 0.35)) * (1 - a * 0.22);
      ctx.lineWidth = Math.max(1.4, (2.4 - a * 0.5) + bands.bass * 3.5);
      ctx.beginPath();
      ctx.arc(cx, h * 0.94, r, Math.PI, 0);
      ctx.stroke();
    }

    // Symmetrical volumetric beam arrays
    const apexY = h * 0.03;
    for (let i = 0; i < beams; i++) {
      const t = i / Math.max(1, beams - 1);
      const val = Math.min(1, (fft[i * 3] / 255) * sensitivity);
      if (val < 0.05) continue;

      const spread = (0.14 + t * 0.76) * (Math.PI * 0.45);
      const sway = Math.sin(this.phase * 0.85 + i * 0.38) * (0.07 + bands.treble * 0.2);
      const ang = spread + sway;
      const dx = Math.sin(ang) * w * 0.68;
      const col = colorAt(i);

      // Soft volumetric cone (Tier 1+)
      if (q.secondaryLayers) {
        const coneW = 14 + val * 26;
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.035 + val * 0.055;
        ctx.beginPath();
        ctx.moveTo(cx, apexY);
        ctx.lineTo(cx - dx - coneW, h);
        ctx.lineTo(cx - dx + coneW, h);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(cx, apexY);
        ctx.lineTo(cx + dx - coneW, h);
        ctx.lineTo(cx + dx + coneW, h);
        ctx.closePath();
        ctx.fill();
      }

      // Crisp laser core
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = 0.24 + val * 0.68;
      ctx.lineWidth = Math.max(1.2, thickness * 0.65 + val * 2.1);

      ctx.beginPath();
      ctx.moveTo(cx, apexY);
      ctx.lineTo(cx - dx, h);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx, apexY);
      ctx.lineTo(cx + dx, h);
      ctx.stroke();
    }

    // Subtle stage floor horizon line (Tier 1+)
    if (q.secondaryLayers) {
      ctx.strokeStyle = colorAt(0);
      ctx.globalAlpha = 0.16 + bands.bass * 0.2;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(w * 0.08, h * 0.94);
      ctx.lineTo(w * 0.92, h * 0.94);
      ctx.stroke();
    }

    ctx.restore();
  }

  // 8. Chromatic Bloom (fixed particle pool + fixed ring pool)
  drawChromaticBloom(ctx, w, h, { bands }, colorAt, q) {
    const cx = w / 2;
    const cy = h / 2;
    const maxP = Math.floor(MAX_BLOOM_PARTICLES * q.particleRatio);
    const now = performance.now();

    if ((bands.bass > 0.62 || bands.energy > 0.58) && now - this.lastBassHit > 160) {
      this.lastBassHit = now;
      // Spawn shockwave ring
      const ri = this.rCursor;
      this.rCursor = (this.rCursor + 1) % MAX_BLOOM_RINGS;
      this.rActive[ri] = 1;
      this.rRad[ri] = 24;
      this.rLife[ri] = 1.0;

      // Spawn capped burst from pool
      const burst = q.tier === 0 ? 6 : 14;
      for (let b = 0; b < burst; b++) {
        const pi = this.pCursor;
        this.pCursor = (this.pCursor + 1) % maxP;
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 4.5 * (1 + bands.bass);
        this.pActive[pi] = 1;
        this.pX[pi] = cx;
        this.pY[pi] = cy;
        this.pVx[pi] = Math.cos(ang) * spd;
        this.pVy[pi] = Math.sin(ang) * spd;
        this.pLife[pi] = 1.0;
        this.pColorIdx[pi] = b % 3;
      }
    }

    // Update & draw rings
    ctx.lineWidth = 2.2;
    for (let i = 0; i < MAX_BLOOM_RINGS; i++) {
      if (!this.rActive[i]) continue;
      this.rRad[i] += 5.5 + bands.energy * 6;
      this.rLife[i] -= 0.018;
      if (this.rLife[i] <= 0) {
        this.rActive[i] = 0;
        continue;
      }
      const col = colorAt(i);
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = this.rLife[i] * 0.65;
      ctx.beginPath();
      ctx.arc(cx, cy, this.rRad[i], 0, Math.PI * 2);
      ctx.stroke();
    }

    // Update & draw pooled particles
    for (let i = 0; i < maxP; i++) {
      if (!this.pActive[i]) continue;
      this.pX[i] += this.pVx[i];
      this.pY[i] += this.pVy[i];
      this.pVx[i] *= 0.985;
      this.pVy[i] *= 0.985;
      this.pLife[i] -= 0.016;
      if (this.pLife[i] <= 0) {
        this.pActive[i] = 0;
        continue;
      }
      const col = colorAt(this.pColorIdx[i]);
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = this.pLife[i] * 0.9;
      ctx.beginPath();
      ctx.arc(this.pX[i], this.pY[i], 2 + this.pLife[i] * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 9. Crystal Engine (low-poly shards orbiting center album art)
  drawCrystalEngine(ctx, w, h, { fft, bands }, colorAt, q, artImage, artScale, showCenterArt) {
    const cx = w / 2;
    const cy = h / 2;
    const count = q.tier === 0 ? 12 : q.tier === 1 ? 20 : MAX_SHARDS;
    const minDim = Math.min(w, h);

    for (let i = 0; i < count; i++) {
      const targetPush = Math.max(0, (bands.bass - 0.35) * 65);
      this.shardPush[i] += (targetPush - this.shardPush[i]) * 0.16;

      const ang = this.shardAngle[i] + this.phase * (i % 2 === 0 ? 0.35 : -0.25);
      const r = this.shardDist[i] * minDim + this.shardPush[i] + (fft[i * 2] / 255) * 28;
      const sx = cx + Math.cos(ang) * r;
      const sy = cy + Math.sin(ang) * r;
      const sz = this.shardSize[i] * (1 + bands.mids * 0.35);
      const col = colorAt(i);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(this.shardRot[i] + this.phase);
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = 0.24;
      ctx.beginPath();
      ctx.moveTo(0, -sz);
      ctx.lineTo(sz * 0.72, 0);
      ctx.lineTo(0, sz);
      ctx.lineTo(-sz * 0.72, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }

    if (showCenterArt && artImage && artImage.complete && artImage.naturalWidth > 0) {
      const r = minDim * 0.12 * artScale + bands.bass * 6;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(artImage, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
    }
  }

  // 10. Retro Audio Lab (always-smooth studio mastering console, zero shadowBlur, zero allocations)
  drawRetroAudioLab(ctx, w, h, { fft, time, bands }, colorAt, q, sensitivity) {
    const col1 = colorAt(0);
    const col2 = colorAt(1);
    const rackW = Math.min(w * 0.86, 1020);
    const rackH = Math.min(h * 0.64, 520);
    const rackX = (w - rackW) * 0.5;
    const rackY = (h - rackH) * 0.48;
    const pad = Math.max(16, rackW * 0.032);
    const innerW = rackW - pad * 2;

    ctx.save();
    ctx.shadowBlur = 0;

    // Brushed smoked-glass rack chassis
    ctx.fillStyle = "rgba(10, 10, 14, 0.56)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(rackX, rackY, rackW, rackH, 18);
    ctx.fill();
    ctx.stroke();

    // Corner rack screws (Tier 1+)
    if (q.secondaryLayers) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      const sOff = 12;
      ctx.beginPath();
      ctx.arc(rackX + sOff, rackY + sOff, 2.2, 0, Math.PI * 2);
      ctx.arc(rackX + rackW - sOff, rackY + sOff, 2.2, 0, Math.PI * 2);
      ctx.arc(rackX + sOff, rackY + rackH - sOff, 2.2, 0, Math.PI * 2);
      ctx.arc(rackX + rackW - sOff, rackY + rackH - sOff, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Moving-coil ballistic VU physics (fast attack, smooth analog decay)
    const targetL = Math.min(1, (bands.bass * 0.72 + bands.energy * 0.38) * sensitivity * 0.85);
    const targetR = Math.min(1, ((bands.mids + bands.treble) * 0.52 + bands.energy * 0.25) * sensitivity * 0.85);
    this.vuL += (targetL - this.vuL) * (targetL > this.vuL ? 0.34 : 0.09);
    this.vuR += (targetR - this.vuR) * (targetR > this.vuR ? 0.34 : 0.09);
    this.vuPeakL = Math.max(this.vuPeakL * 0.985, this.vuL);
    this.vuPeakR = Math.max(this.vuPeakR * 0.985, this.vuR);

    // Top Row: Dual Analog VU Meters + Precision Tape Deck
    const topY = rackY + pad;
    const topH = Math.min(96, Math.max(58, rackH * 0.22));
    const showTape = innerW > 540;
    const vuW = showTape ? Math.min(260, innerW * 0.33) : (innerW - 14) * 0.5;

    this.drawVUMeter(ctx, rackX + pad, topY, vuW, topH, this.vuL, this.vuPeakL, "CH-L", col1, col2, q);
    this.drawVUMeter(ctx, rackX + rackW - pad - vuW, topY, vuW, topH, this.vuR, this.vuPeakR, "CH-R", col1, col2, q);

    if (showTape) {
      const deckX = w * 0.5;
      const reelY = topY + topH * 0.48;
      const reelR = Math.min(28, topH * 0.36);
      const reelSpan = Math.min(54, (innerW - vuW * 2) * 0.24);
      const lx = deckX - reelSpan;
      const rx = deckX + reelSpan;

      // Magnetic tape path + center playback head
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(lx, reelY + reelR * 0.65);
      ctx.lineTo(deckX - 10, topY + topH - 10);
      ctx.lineTo(deckX + 10, topY + topH - 10);
      ctx.lineTo(rx, reelY + reelR * 0.65);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(deckX - 7, topY + topH - 15, 14, 7);

      this.drawTapeReel(ctx, lx, reelY, reelR, this.phase * 1.9, col1);
      this.drawTapeReel(ctx, rx, reelY, reelR, this.phase * 1.9, col2);
    }

    // Middle Row: Recessed CRT Oscilloscope
    const scopeY = topY + topH + 12;
    const scopeH = Math.min(148, Math.max(62, rackH * 0.3));
    const scopeX = rackX + pad;

    ctx.fillStyle = "rgba(5, 6, 8, 0.72)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(scopeX, scopeY, innerW, scopeH, 10);
    ctx.fill();
    ctx.stroke();

    // Hairline CRT graticule grid (Tier 1+)
    if (q.secondaryLayers) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      for (let gx = 1; gx < 8; gx++) {
        const x = scopeX + (gx / 8) * innerW;
        ctx.beginPath();
        ctx.moveTo(x, scopeY + 4);
        ctx.lineTo(x, scopeY + scopeH - 4);
        ctx.stroke();
      }
      for (let gy = 1; gy < 4; gy++) {
        const y = scopeY + (gy / 4) * scopeH;
        ctx.beginPath();
        ctx.moveTo(scopeX + 4, y);
        ctx.lineTo(scopeX + innerW - 4, y);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.beginPath();
      ctx.moveTo(scopeX + 6, scopeY + scopeH * 0.5);
      ctx.lineTo(scopeX + innerW - 6, scopeY + scopeH * 0.5);
      ctx.stroke();
    }

    // Harmonic echo trace (Tier 1+)
    const scopeMidY = scopeY + scopeH * 0.5;
    const scopeAmp = scopeH * 0.38 * sensitivity;
    if (q.secondaryLayers) {
      ctx.beginPath();
      ctx.strokeStyle = col2;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < time.length; i += 4) {
        const x = scopeX + 8 + (i / time.length) * (innerW - 16);
        const y = scopeMidY + ((time[i] - 128) / 128) * scopeAmp * 0.65;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Primary crisp oscilloscope trace
    ctx.beginPath();
    ctx.strokeStyle = col1;
    ctx.globalAlpha = 0.94;
    ctx.lineWidth = 1.9;
    const step = q.tier === 0 ? 4 : 2;
    for (let i = 0; i < time.length; i += step) {
      const x = scopeX + 8 + (i / time.length) * (innerW - 16);
      const y = scopeMidY + ((time[i] - 128) / 128) * scopeAmp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Bottom Row: Precision Spectrum Analyzer + Stereo Balance
    const specY = scopeY + scopeH + 14;
    const specH = Math.max(54, rackY + rackH - pad - 24 - specY);
    const bars = q.tier === 0 ? 24 : 36;
    const bw = innerW / bars;
    const specBase = specY + specH;

    for (let i = 0; i < bars; i++) {
      const idx = Math.floor((i / bars) * (fft.length * 0.58));
      const v = Math.min(1, (fft[idx] / 255) * sensitivity);
      const bh = Math.max(2, v * specH);
      this.labPeaks[i] = Math.max(this.labPeaks[i] * 0.96, bh);

      const bx = scopeX + i * bw + 2;
      const barWidth = Math.max(2, bw - 4);

      ctx.fillStyle = i % 2 === 0 ? col1 : col2;
      ctx.globalAlpha = 0.84;
      ctx.beginPath();
      ctx.roundRect(bx, specBase - bh, barWidth, bh, 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.globalAlpha = 0.9;
      ctx.fillRect(bx, specBase - this.labPeaks[i] - 3, barWidth, 1.8);
    }

    // Stereo Balance & Headroom Bar
    const targetBal = Math.max(-1, Math.min(1, (bands.treble - bands.bass) * 0.85));
    this.labBalance += (targetBal - this.labBalance) * 0.18;
    const balW = Math.min(200, innerW * 0.34);
    const balX = w * 0.5 - balW * 0.5;
    const balY = specBase + 12;

    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(balX, balY, balW, 3);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(w * 0.5 - 0.5, balY - 2, 1, 7);
    ctx.fillStyle = col1;
    ctx.beginPath();
    ctx.roundRect(w * 0.5 + this.labBalance * (balW * 0.44) - 6, balY - 2, 12, 7, 3);
    ctx.fill();

    // Subtle CRT scanlines (Tier 1+ only)
    if (q.secondaryLayers) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.11)";
      for (let y = scopeY; y < scopeY + scopeH; y += 4) {
        ctx.fillRect(scopeX, y, innerW, 1);
      }
    }

    ctx.restore();
  }

  drawVUMeter(ctx, x, y, w, h, level, peak, label, col1, col2, q) {
    ctx.save();
    ctx.fillStyle = "rgba(18, 16, 15, 0.72)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();

    const cx = x + w * 0.5;
    const cy = y + h - 8;
    const arcR = Math.min(w * 0.38, h * 0.78);
    const startA = -Math.PI * 0.8;
    const endA = -Math.PI * 0.2;
    const redA = startA + (endA - startA) * 0.74;

    // Scale arc (normal + redline zone)
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.24)";
    ctx.beginPath();
    ctx.arc(cx, cy, arcR, startA, redA);
    ctx.stroke();

    ctx.strokeStyle = col2;
    ctx.beginPath();
    ctx.arc(cx, cy, arcR, redA, endA);
    ctx.stroke();

    // Scale ticks (Tier 1+)
    if (q.secondaryLayers) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
      ctx.lineWidth = 1;
      for (let t = 0; t <= 6; t++) {
        const a = startA + (t / 6) * (endA - startA);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (arcR - 5), cy + Math.sin(a) * (arcR - 5));
        ctx.lineTo(cx + Math.cos(a) * (arcR + 1), cy + Math.sin(a) * (arcR + 1));
        ctx.stroke();
      }
    }

    // Ballistic needle
    const ang = startA + Math.min(1, level) * (endA - startA);
    ctx.strokeStyle = level > 0.76 ? col2 : col1;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * (arcR + 2), cy + Math.sin(ang) * (arcR + 2));
    ctx.stroke();

    // Pivot cap
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.beginPath();
    ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Channel label + Peak LED
    ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
    ctx.font = "600 10px ui-monospace, monospace";
    ctx.fillText(label, x + 10, y + 16);

    ctx.fillStyle = peak > 0.76 ? col2 : "rgba(255, 255, 255, 0.14)";
    ctx.beginPath();
    ctx.arc(x + w - 12, y + 12, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawTapeReel(ctx, cx, cy, r, angle, col) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Outer tape pack ring
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // Inner aluminum flange
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r * 0.22), Math.sin(a) * (r * 0.22));
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }

    // Center hub
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2.5, r * 0.16), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function paletteAvailable(colorAt) {
  return colorAt(0) !== colorAt(1);
}
