// Modular 60fps Canvas Visualizers (17 Modes + Smart Center Album Art & Alternating Palette)

export class VisualizerRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.mode = "bars";
    this.accent = "#d4a359";
    this.palette = ["#d4a359", "#f0d49a"];
    this.glow = 18;
    this.density = 64;
    this.sensitivity = 1.2;
    this.thickness = 2.6;
    this.speed = 1.0;
    this.artScale = 1.0;
    this.showCenterArt = false;

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

  // Modes where album art sits naturally in the center when HUD hides / fullscreen
  isCenteredArtMode() {
    return ["radial", "spiral", "milkdrop", "mandala", "orbit"].includes(this.mode);
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

  drawCenterAlbumArt(bands, baseRadius) {
    if (!this.showCenterArt || !this.artImage || !this.artImage.complete || this.artImage.naturalWidth === 0) {
      return;
    }
    const { ctx, w, h } = this;
    const cx = w / 2;
    const cy = h / 2;
    const r = baseRadius * this.artScale + bands.bass * 8;

    ctx.save();
    ctx.shadowColor = this.colorAt(0);
    ctx.shadowBlur = Math.max(18, this.glow * 1.4);

    // Outer metallic ring
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.strokeStyle = this.colorAt(0);
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(this.artImage, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  render(sample) {
    const { ctx, w, h } = this;
    this.phase += (0.016 + sample.bands.energy * 0.036) * this.speed;
    this.vinylAngle += (0.007 + sample.bands.energy * 0.013) * this.speed;

    if (this.mode === "milkdrop" || this.mode === "warp") {
      ctx.fillStyle = "rgba(9, 7, 5, 0.22)";
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }

    ctx.save();
    ctx.shadowColor = this.accent;
    ctx.shadowBlur = this.glow;

    switch (this.mode) {
      case "bars": this.drawBars(sample); break;
      case "radial": this.drawRadial(sample); break;
      case "waveform": this.drawWaveform(sample); break;
      case "particles": this.drawParticles(sample); break;
      case "horizon": this.drawHorizon(sample); break;
      case "matrix": this.drawMatrix(sample); break;
      case "milkdrop": this.drawMilkdrop(sample); break;
      case "plasma": this.drawPlasma(sample); break;
      case "mirror": this.drawMirror(sample); break;
      case "vinyl": this.drawVinyl(sample); break;
      case "warp": this.drawWarp(sample); break;
      case "spiral": this.drawSpiral(sample); break;
      case "synthwave": this.drawSynthwave(sample); break;
      case "dna": this.drawDNA(sample); break;
      case "mandala": this.drawMandala(sample); break;
      case "aurora": this.drawAurora(sample); break;
      case "orbit": this.drawOrbit(sample); break;
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
      ctx.fillStyle = "#fff8eb";
      ctx.fillRect(x + 2, baseY - this.peaks[i] - 4, Math.max(2, barW - 4), 2.5);
    }
  }

  drawRadial({ fft, bands }) {
    const { ctx, w, h, density, sensitivity } = this;
    const cx = w / 2;
    const cy = h / 2;
    const centerR = this.showCenterArt ? Math.min(w, h) * 0.14 * this.artScale : Math.min(w, h) * 0.17;
    const baseR = centerR + 14 + bands.bass * 20;
    const count = Math.min(density, fft.length);

    ctx.lineWidth = this.thickness;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const val = Math.min(1, (fft[i] / 255) * sensitivity);
      const len = 10 + val * (Math.min(w, h) * 0.22);
      const col = this.colorAt(i);

      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * baseR, cy + Math.sin(angle) * baseR);
      ctx.lineTo(cx + Math.cos(angle) * (baseR + len), cy + Math.sin(angle) * (baseR + len));
      ctx.stroke();
    }

    this.drawCenterAlbumArt(bands, Math.min(w, h) * 0.14);
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
      ctx.lineWidth = l === 0 ? this.thickness : Math.max(1.2, this.thickness * 0.6);

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
    const speedBoost = (1 + bands.energy * 6) * this.speed;

    this.particles.forEach((p, idx) => {
      p.x += p.vx * speedBoost;
      p.y += p.vy * speedBoost;
      if (p.x < 0 || p.x > 1) p.vx *= -1;
      if (p.y < 0 || p.y > 1) p.vy *= -1;

      const r = p.size * (1 + bands.bass * 2.2) * (this.thickness / 2.6);
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
      ctx.lineWidth = Math.max(1.5, this.thickness * 0.8);

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
        ctx.fillStyle = r < lit ? col : "rgba(255,245,230,0.06)";
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
    const minR = this.showCenterArt ? Math.min(w, h) * 0.12 * this.artScale : 0;

    for (let r = 0; r < rings; r++) {
      const progress = ((r / rings) + (this.phase * 0.15)) % 1;
      const radius = minR + progress * Math.max(w, h) * 0.55;
      const idx = Math.floor(progress * fft.length * 0.5);
      const warp = (fft[idx] / 255) * sensitivity * 32;
      const col = this.colorAt(r);

      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = (1 - progress) * 0.88;
      ctx.lineWidth = Math.max(1.4, this.thickness * 0.7 + bands.bass * 2);

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

    this.drawCenterAlbumArt(bands, Math.min(w, h) * 0.11);
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
      ctx.lineWidth = this.thickness + bands.mids * 1.8;

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

  drawVinyl({ fft, bands }) {
    const { ctx, w, h, sensitivity } = this;
    const cx = w / 2;
    const cy = h / 2;
    const discR = Math.min(w, h) * 0.25 * this.artScale + bands.bass * 10;

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

    const rimBars = 48;
    for (let i = 0; i < rimBars; i++) {
      const a = (i / rimBars) * Math.PI * 2 + this.vinylAngle * 0.5;
      const len = 6 + Math.min(1, (fft[i] / 255) * sensitivity) * 44;
      const col = this.colorAt(i);
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = this.thickness;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (discR + 4), cy + Math.sin(a) * (discR + 4));
      ctx.lineTo(cx + Math.cos(a) * (discR + 4 + len), cy + Math.sin(a) * (discR + 4 + len));
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.vinylAngle);

    ctx.globalAlpha = 0.96;
    ctx.fillStyle = "#0b0908";
    ctx.beginPath();
    ctx.arc(0, 0, discR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 235, 200, 0.08)";
    ctx.lineWidth = 1;
    for (let g = discR * 0.48; g < discR * 0.94; g += 7) {
      ctx.beginPath();
      ctx.arc(0, 0, g, 0, Math.PI * 2);
      ctx.stroke();
    }

    const labelR = discR * 0.44;
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

    ctx.fillStyle = "#090705";
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  drawWarp({ bands }) {
    const { ctx, w, h, sensitivity } = this;
    const cx = w / 2;
    const cy = h / 2;
    const speed = (0.008 + bands.energy * 0.032) * sensitivity * this.speed;

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
      ctx.lineWidth = 1 + (1 - s.z) * (this.thickness + bands.bass * 2);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    });
  }

  drawSpiral({ fft, bands }) {
    const { ctx, w, h, density, sensitivity } = this;
    const cx = w / 2;
    const cy = h / 2;
    const arms = 3;
    const points = Math.min(density, 96);
    const startR = this.showCenterArt ? Math.min(w, h) * 0.13 * this.artScale : 0;

    for (let a = 0; a < arms; a++) {
      const col = this.colorAt(a);
      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = 0.88;
      ctx.lineWidth = this.thickness + bands.mids * 1.5;

      for (let i = 0; i < points; i++) {
        const t = i / points;
        const angle = t * Math.PI * 5 + this.phase * 0.9 + (a * Math.PI * 2) / arms;
        const val = (fft[i % fft.length] / 255) * sensitivity;
        const rad = startR + t * (Math.min(w, h) * 0.36) + val * 28;
        const x = cx + Math.cos(angle) * rad;
        const y = cy + Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    this.drawCenterAlbumArt(bands, Math.min(w, h) * 0.125);
  }

  drawSynthwave({ fft, bands }) {
    const { ctx, w, h, sensitivity } = this;
    const horizonY = h * 0.56;
    const sunR = Math.min(w, h) * 0.16 + bands.bass * 12;
    const sunX = w / 2;
    const sunY = horizonY - sunR * 0.55;

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

    ctx.globalCompositeOperation = "destination-out";
    for (let y = sunY + 4; y < sunY + sunR; y += 14) {
      const thickness = 2 + ((y - sunY) / sunR) * 5;
      ctx.fillRect(sunX - sunR, y, sunR * 2, thickness);
    }
    ctx.restore();

    ctx.beginPath();
    ctx.strokeStyle = this.colorAt(1);
    ctx.shadowColor = this.colorAt(1);
    ctx.lineWidth = this.thickness;
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

  // 14. Double Helix DNA
  drawDNA({ fft, bands }) {
    const { ctx, w, h, sensitivity } = this;
    const pts = 48;
    const amp = h * 0.18 + bands.bass * 35;

    for (let s = 0; s < 2; s++) {
      const col = this.colorAt(s);
      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.lineWidth = this.thickness;
      ctx.globalAlpha = 0.9;

      for (let i = 0; i <= pts; i++) {
        const t = i / pts;
        const x = w * 0.08 + t * (w * 0.84);
        const mod = (fft[i % fft.length] / 255) * sensitivity * 45;
        const y = h / 2 + Math.sin(t * Math.PI * 4 + this.phase * 1.4 + s * Math.PI) * (amp + mod * 0.4);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Connecting rungs
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= pts; i += 2) {
      const t = i / pts;
      const x = w * 0.08 + t * (w * 0.84);
      const y1 = h / 2 + Math.sin(t * Math.PI * 4 + this.phase * 1.4) * amp;
      const y2 = h / 2 + Math.sin(t * Math.PI * 4 + this.phase * 1.4 + Math.PI) * amp;
      ctx.strokeStyle = this.colorAt(i);
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
      ctx.stroke();
    }
  }

  // 15. Sacred Geometry Mandala
  drawMandala({ fft, bands }) {
    const { ctx, w, h, sensitivity } = this;
    const cx = w / 2;
    const cy = h / 2;
    const folds = 12;
    const startR = this.showCenterArt ? Math.min(w, h) * 0.13 * this.artScale : 24;

    for (let f = 0; f < folds; f++) {
      const baseAngle = (f / folds) * Math.PI * 2 + this.phase * 0.35;
      const col = this.colorAt(f);
      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.lineWidth = Math.max(1.5, this.thickness * 0.8);
      ctx.globalAlpha = 0.8;

      for (let i = 0; i < 24; i++) {
        const t = i / 23;
        const val = (fft[i * 2] / 255) * sensitivity;
        const r = startR + t * Math.min(w, h) * 0.28 + val * 30;
        const sway = Math.sin(t * Math.PI * 2 + this.phase) * 0.18;
        const x = cx + Math.cos(baseAngle + sway) * r;
        const y = cy + Math.sin(baseAngle + sway) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    this.drawCenterAlbumArt(bands, Math.min(w, h) * 0.125);
  }

  // 16. Northern Lights Aurora Curtains
  drawAurora({ fft, bands }) {
    const { ctx, w, h, density, sensitivity } = this;
    const cols = Math.min(density, 72);
    const colW = w / cols;

    for (let i = 0; i < cols; i++) {
      const val = Math.min(1, (fft[i] / 255) * sensitivity);
      const col = this.colorAt(i);
      const curtainH = h * (0.28 + val * 0.55);
      const yTop = h * 0.15 + Math.sin(this.phase + i * 0.2) * 35;

      const grad = ctx.createLinearGradient(0, yTop, 0, yTop + curtainH);
      grad.addColorStop(0, "transparent");
      grad.addColorStop(0.4, col);
      grad.addColorStop(1, "transparent");

      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.22 + val * 0.5 + bands.mids * 0.1;
      ctx.fillRect(i * colW, yTop, colW + 2, curtainH);
    }
  }

  // 17. Planetary Orbitals
  drawOrbit({ fft, bands }) {
    const { ctx, w, h, sensitivity } = this;
    const cx = w / 2;
    const cy = h / 2;
    const orbits = 5;
    const baseR = this.showCenterArt ? Math.min(w, h) * 0.16 * this.artScale : Math.min(w, h) * 0.12;

    for (let o = 0; o < orbits; o++) {
      const rx = baseR + o * (Math.min(w, h) * 0.055) + bands.bass * 12;
      const ry = rx * 0.48;
      const tilt = o * 0.45 + this.phase * 0.15;
      const col = this.colorAt(o);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);

      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = Math.max(1.2, this.thickness * 0.65);
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Orbiting audio-reactive node
      const a = this.phase * (1.2 + o * 0.35);
      const nx = Math.cos(a) * rx;
      const ny = Math.sin(a) * ry;
      const nodeR = 4 + (fft[o * 6] / 255) * sensitivity * 9;

      ctx.fillStyle = col;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(nx, ny, nodeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    this.drawCenterAlbumArt(bands, Math.min(w, h) * 0.125);
  }
}
