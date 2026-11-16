// Modular 60fps Canvas Visualizers (13 Modes with Alternating Album-Art Palette)

export class VisualizerRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.mode = "bars";
    this.accent = "#1db954";
    this.palette = ["#1db954"];
    this.glow = 18;
    this.density = 64;
    this.sensitivity = 1.2;
    this.phase = 0;
    this.vinylAngle = 0;
    this.artImage = null;

    this.peaks = new Float32Array(128);
    this.particles = Array.from({ length: 110 }, () => this.makeParticle());
    this.stars = Array.from({ length: 160 }, () => this.makeStar());
    this.resize();
  }

  setArtImage(img) {
    this.artImage = img;
  }

  setPalette(colors) {
    this.palette = Array.isArray(colors) && colors.length > 0 ? colors : [this.accent];
    this.accent = this.palette[0];
  }

  colorAt(index) {
    return this.palette[index % this.palette.length];
  }

  makeParticle() {
    return {
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0015,
      vy: (Math.random() - 0.5) * 0.0015,
      size: 1.5 + Math.random() * 2.5
    };
  }

  makeStar() {
    return {
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: Math.random(),
      pz: 1
    };
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
  }

  render(sample) {
    const { ctx, w, h } = this;
    this.phase += 0.018 + sample.bands.energy * 0.04;
    this.vinylAngle += 0.008 + sample.bands.energy * 0.014;

    if (this.mode === "milkdrop" || this.mode === "warp") {
      ctx.fillStyle = "rgba(5, 5, 8, 0.22)";
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }

    ctx.save();
    ctx.shadowColor = this.accent;
    ctx.shadowBlur = this.glow;

    switch (this.mode) {
      case "bars":
        this.drawBars(sample);
        break;
      case "radial":
        this.drawRadial(sample);
        break;
      case "waveform":
        this.drawWaveform(sample);
        break;
      case "particles":
        this.drawParticles(sample);
        break;
      case "horizon":
        this.drawHorizon(sample);
        break;
      case "matrix":
        this.drawMatrix(sample);
        break;
      case "milkdrop":
        this.drawMilkdrop(sample);
        break;
      case "plasma":
        this.drawPlasma(sample);
        break;
      case "mirror":
        this.drawMirror(sample);
        break;
      case "vinyl":
        this.drawVinyl(sample);
        break;
      case "warp":
        this.drawWarp(sample);
        break;
      case "spiral":
        this.drawSpiral(sample);
        break;
      case "synthwave":
        this.drawSynthwave(sample);
        break;
    }
    ctx.restore();
  }

  drawBars({ fft }) {
    const { ctx, w, h, density, sensitivity } = this;
    const count = Math.min(density, fft.length);
    const barW = (w * 0.82) / count;
    const startX = w * 0.09;
    const baseY = h * 0.78;

    for (let i = 0; i < count; i++) {
      const val = Math.min(1, (fft[i] / 255) * sensitivity);
      const barH = val * (h * 0.46);
      const x = startX + i * barW;
      const col = this.colorAt(i);

      this.peaks[i] = Math.max(this.peaks[i] * 0.965, barH);

      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.roundRect(x + 2, baseY - barH, Math.max(2, barW - 4), barH, 4);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + 2, baseY - this.peaks[i] - 4, Math.max(2, barW - 4), 2.5);
    }
  }

  drawRadial({ fft, bands }) {
    const { ctx, w, h, density, sensitivity } = this;
    const cx = w / 2;
    const cy = h / 2;
    const baseR = Math.min(w, h) * 0.18 + bands.bass * 26;
    const count = Math.min(density, fft.length);

    ctx.lineWidth = 3;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const val = Math.min(1, (fft[i] / 255) * sensitivity);
      const len = 10 + val * (Math.min(w, h) * 0.22);
      const col = this.colorAt(i);

      const x1 = cx + Math.cos(angle) * baseR;
      const y1 = cy + Math.sin(angle) * baseR;
      const x2 = cx + Math.cos(angle) * (baseR + len);
      const y2 = cy + Math.sin(angle) * (baseR + len);

      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  drawWaveform({ time, bands }) {
    const { ctx, w, h, sensitivity } = this;
    const layers = 3;

    for (let l = 0; l < layers; l++) {
      const col = this.colorAt(l);
      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = l === 0 ? 0.95 : 0.45;
      ctx.lineWidth = l === 0 ? 3 : 1.8;

      const amp = (h * 0.24) * sensitivity * (1 - l * 0.22);
      const slice = w / time.length;

      for (let i = 0; i < time.length; i++) {
        const v = (time[i] - 128) / 128;
        const y = h / 2 + v * amp + Math.sin(i * 0.08 + bands.bass * 3 + l) * 10;
        const x = i * slice;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  drawParticles({ bands }) {
    const { ctx, w, h } = this;
    const speedBoost = 1 + bands.energy * 6;

    this.particles.forEach((p, idx) => {
      p.x += p.vx * speedBoost;
      p.y += p.vy * speedBoost;
      if (p.x < 0 || p.x > 1) p.vx *= -1;
      if (p.y < 0 || p.y > 1) p.vy *= -1;

      const r = p.size * (1 + bands.bass * 2.2);
      const col = this.colorAt(idx);
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = 0.55 + Math.min(0.45, bands.treble * 0.5);
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawHorizon({ fft }) {
    const { ctx, w, h, sensitivity } = this;
    const rows = 8;

    for (let r = 0; r < rows; r++) {
      const col = this.colorAt(r);
      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = 0.25 + (r / rows) * 0.72;
      ctx.lineWidth = 2;

      const baseY = h * 0.35 + r * (h * 0.06);
      const pts = 48;
      for (let i = 0; i <= pts; i++) {
        const idx = Math.floor((i / pts) * (fft.length * 0.6));
        const val = (fft[idx] / 255) * sensitivity * (1 - r * 0.08);
        const x = (i / pts) * w;
        const y = baseY - val * 120;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  drawMatrix({ fft }) {
    const { ctx, w, h, sensitivity } = this;
    const cols = 24;
    const rows = 14;
    const cellW = (w * 0.8) / cols;
    const cellH = (h * 0.52) / rows;
    const startX = w * 0.1;
    const baseY = h * 0.74;

    for (let c = 0; c < cols; c++) {
      const idx = Math.floor((c / cols) * (fft.length * 0.7));
      const lit = Math.round(Math.min(1, (fft[idx] / 255) * sensitivity) * rows);
      const col = this.colorAt(c);
      for (let r = 0; r < rows; r++) {
        ctx.fillStyle = r < lit ? col : "rgba(255,255,255,0.06)";
        ctx.globalAlpha = r < lit ? 0.9 : 1;
        ctx.beginPath();
        ctx.roundRect(startX + c * cellW + 3, baseY - (r + 1) * cellH + 3, cellW - 6, cellH - 6, 4);
        ctx.fill();
      }
    }
  }

  drawMilkdrop({ fft, bands }) {
    const { ctx, w, h, sensitivity } = this;
    const cx = w / 2;
    const cy = h / 2;
    const rings = 12;
    const sides = 6;

    for (let r = 0; r < rings; r++) {
      const progress = ((r / rings) + (this.phase * 0.15)) % 1;
      const radius = progress * Math.max(w, h) * 0.58;
      const idx = Math.floor(progress * fft.length * 0.5);
      const warp = (fft[idx] / 255) * sensitivity * 32;
      const col = this.colorAt(r);

      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = (1 - progress) * 0.88;
      ctx.lineWidth = 1.6 + bands.bass * 2.2;

      for (let s = 0; s <= sides * 4; s++) {
        const a = (s / (sides * 4)) * Math.PI * 2 + this.phase * (r % 2 === 0 ? 0.4 : -0.3);
        const rad = radius + Math.sin(a * sides + this.phase * 2) * warp;
        const x = cx + Math.cos(a) * rad;
        const y = cy + Math.sin(a) * rad;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  drawPlasma({ time, bands }) {
    const { ctx, w, h, sensitivity } = this;
    const ribbons = 5;

    for (let r = 0; r < ribbons; r++) {
      const col = this.colorAt(r);
      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = 0.32 + (r / ribbons) * 0.62;
      ctx.lineWidth = 2.5 + bands.mids * 2;

      for (let x = 0; x <= w; x += 12) {
        const nx = x / w;
        const tIdx = Math.floor(nx * (time.length - 1));
        const wave = ((time[tIdx] - 128) / 128) * 110 * sensitivity;
        const y =
          h / 2 +
          Math.sin(nx * 6 + this.phase + r * 0.8) * (70 + bands.bass * 80) +
          Math.cos(nx * 11 - this.phase * 1.4) * 35 +
          wave * 0.5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  drawMirror({ fft, bands }) {
    const { ctx, w, h, density, sensitivity } = this;
    const count = Math.min(density, fft.length);
    const halfW = w * 0.45;
    const barW = halfW / count;
    const cy = h / 2;

    for (let i = 0; i < count; i++) {
      const val = Math.min(1, (fft[i] / 255) * sensitivity);
      const barH = val * (h * 0.38) + bands.bass * 12;
      const col = this.colorAt(i);

      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = 0.88;

      const xRight = w / 2 + i * barW;
      const xLeft = w / 2 - (i + 1) * barW;

      ctx.beginPath();
      ctx.roundRect(xRight + 1, cy - barH, Math.max(2, barW - 2), barH * 2, 3);
      ctx.roundRect(xLeft + 1, cy - barH, Math.max(2, barW - 2), barH * 2, 3);
      ctx.fill();
    }
  }

  // 10. Spinning Vinyl Disc with Live Album Art + Beat Rings
  drawVinyl({ fft, bands }) {
    const { ctx, w, h, sensitivity } = this;
    const cx = w / 2;
    const cy = h / 2;
    const discR = Math.min(w, h) * 0.25 + bands.bass * 10;

    // Outer beat-reactive rings
    for (let r = 0; r < 4; r++) {
      const col = this.colorAt(r);
      const pulseR = discR + 18 + r * 22 + bands.energy * (18 + r * 8);
      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = 0.45 - r * 0.08;
      ctx.lineWidth = 2;
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Radial rim bars
    const rimBars = 48;
    for (let i = 0; i < rimBars; i++) {
      const a = (i / rimBars) * Math.PI * 2 + this.vinylAngle * 0.5;
      const len = 6 + Math.min(1, (fft[i] / 255) * sensitivity) * 44;
      const col = this.colorAt(i);
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (discR + 4), cy + Math.sin(a) * (discR + 4));
      ctx.lineTo(cx + Math.cos(a) * (discR + 4 + len), cy + Math.sin(a) * (discR + 4 + len));
      ctx.stroke();
    }

    // Vinyl record body
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.vinylAngle);

    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "#0b0b0e";
    ctx.beginPath();
    ctx.arc(0, 0, discR, 0, Math.PI * 2);
    ctx.fill();

    // Subtle vinyl grooves
    ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
    ctx.lineWidth = 1;
    for (let g = discR * 0.48; g < discR * 0.94; g += 7) {
      ctx.beginPath();
      ctx.arc(0, 0, g, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Center album art label
    const labelR = discR * 0.42;
    ctx.beginPath();
    ctx.arc(0, 0, labelR, 0, Math.PI * 2);
    ctx.clip();
    if (this.artImage && this.artImage.complete && this.artImage.naturalWidth > 0) {
      ctx.drawImage(this.artImage, -labelR, -labelR, labelR * 2, labelR * 2);
    } else {
      ctx.fillStyle = this.accent;
      ctx.fill();
    }
    ctx.restore();

    // Center spindle hole
    ctx.fillStyle = "#050507";
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 11. 3D Warp Starfield Tunnel
  drawWarp({ bands }) {
    const { ctx, w, h, sensitivity } = this;
    const cx = w / 2;
    const cy = h / 2;
    const speed = (0.008 + bands.energy * 0.032) * sensitivity;

    this.stars.forEach((s, idx) => {
      s.pz = s.z;
      s.z -= speed;
      if (s.z <= 0.02) {
        s.x = (Math.random() - 0.5) * 2;
        s.y = (Math.random() - 0.5) * 2;
        s.z = 1;
        s.pz = 1;
      }

      const sx = cx + (s.x / s.z) * (w * 0.45);
      const sy = cy + (s.y / s.z) * (h * 0.45);
      const px = cx + (s.x / s.pz) * (w * 0.45);
      const py = cy + (s.y / s.pz) * (h * 0.45);

      const col = this.colorAt(idx);
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = Math.min(1, (1 - s.z) * 1.2);
      ctx.lineWidth = 1 + (1 - s.z) * (2.5 + bands.bass * 2);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    });
  }

  // 12. Audio Galaxy / Frequency Spiral
  drawSpiral({ fft, bands }) {
    const { ctx, w, h, density, sensitivity } = this;
    const cx = w / 2;
    const cy = h / 2;
    const arms = 3;
    const points = Math.min(density, 96);

    for (let a = 0; a < arms; a++) {
      const col = this.colorAt(a);
      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2 + bands.mids * 1.5;

      for (let i = 0; i < points; i++) {
        const t = i / points;
        const angle = t * Math.PI * 5 + this.phase * 0.9 + (a * Math.PI * 2) / arms;
        const val = (fft[i % fft.length] / 255) * sensitivity;
        const rad = t * Math.min(w, h) * 0.38 + val * 28;
        const x = cx + Math.cos(angle) * rad;
        const y = cy + Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // 13. Synthwave Retro Sun & Perspective Grid
  drawSynthwave({ fft, bands }) {
    const { ctx, w, h, sensitivity } = this;
    const horizonY = h * 0.56;
    const sunR = Math.min(w, h) * 0.16 + bands.bass * 12;
    const sunX = w / 2;
    const sunY = horizonY - sunR * 0.55;

    // Segmented retro sun
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.clip();

    const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sunGrad.addColorStop(0, this.colorAt(0));
    sunGrad.addColorStop(1, this.colorAt(1));
    ctx.fillStyle = sunGrad;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);

    // Horizontal sun scan cutouts
    ctx.globalCompositeOperation = "destination-out";
    for (let y = sunY + 4; y < sunY + sunR; y += 14) {
      const thickness = 2 + ((y - sunY) / sunR) * 5;
      ctx.fillRect(sunX - sunR, y, sunR * 2, thickness);
    }
    ctx.restore();

    // Horizon spectrum silhouette
    ctx.beginPath();
    ctx.strokeStyle = this.colorAt(1);
    ctx.shadowColor = this.colorAt(1);
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.9;
    const pts = 48;
    for (let i = 0; i <= pts; i++) {
      const idx = Math.floor((i / pts) * (fft.length * 0.5));
      const val = (fft[idx] / 255) * sensitivity * 70;
      const x = (i / pts) * w;
      const y = horizonY - val;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Perspective floor grid
    const gridCol = this.colorAt(0);
    ctx.strokeStyle = gridCol;
    ctx.shadowColor = gridCol;
    ctx.lineWidth = 1.2;

    const vLines = 16;
    for (let i = -vLines; i <= vLines; i++) {
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * 26, horizonY);
      ctx.lineTo(w / 2 + i * 190, h);
      ctx.stroke();
    }

    const scroll = (this.phase * 0.25) % 1;
    for (let r = 0; r < 10; r++) {
      const p = (r + scroll) / 10;
      const y = horizonY + Math.pow(p, 1.8) * (h - horizonY);
      ctx.globalAlpha = 0.15 + p * 0.45;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }
}
