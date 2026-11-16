// Unified Audio Engine: macOS System Audio Bridge (ws://127.0.0.1:8889), Local Files, Demo Synth, and Smooth Pulse

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.audioEl = new Audio();
    this.audioEl.crossOrigin = "anonymous";
    this.demoTimer = null;
    this.isDemoPlaying = false;
    this.hasLiveAudio = false;
    this.isRemotePlaying = false;

    // macOS ScreenCaptureKit WebSocket Bridge
    this.ws = null;
    this.wsConnected = false;
    this.wsTargetFft = new Uint8Array(128);

    this.fftData = new Uint8Array(256);
    this.smoothFft = new Float32Array(256);
    this.timeData = new Uint8Array(256);
    this.eqGains = { bass: 1.2, mids: 1.0, treble: 1.1 };
    this.smoothing = 0.78;
    this.sensitivity = 1.2;

    this.connectBridge();
  }

  connectBridge() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    try {
      const ws = new WebSocket("ws://127.0.0.1:8889");
      ws.binaryType = "arraybuffer";
      ws.onopen = () => {
        this.wsConnected = true;
      };
      ws.onmessage = (evt) => {
        const incoming = new Uint8Array(evt.data);
        const len = Math.min(incoming.length, this.wsTargetFft.length);
        for (let i = 0; i < len; i++) {
          this.wsTargetFft[i] = incoming[i];
        }
      };
      ws.onclose = () => {
        this.wsConnected = false;
        setTimeout(() => this.connectBridge(), 3000);
      };
      ws.onerror = () => {
        this.wsConnected = false;
      };
      this.ws = ws;
    } catch {
      this.wsConnected = false;
    }
  }

  ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = this.smoothing;
      this.fftData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.fftSize);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  setRemotePlaying(playing) {
    this.isRemotePlaying = Boolean(playing);
  }

  setSmoothing(val) {
    this.smoothing = val;
    if (this.analyser) {
      this.analyser.smoothingTimeConstant = val;
    }
  }

  setSensitivity(val) {
    this.sensitivity = val;
  }

  setEqGains(bass, mids, treble) {
    this.eqGains = { bass, mids, treble };
  }

  loadLocalFile(file, onMeta) {
    this.stopDemo();
    this.ensureContext();

    const url = URL.createObjectURL(file);
    this.audioEl.src = url;

    if (!this.localMediaSource) {
      this.localMediaSource = this.ctx.createMediaElementSource(this.audioEl);
    }
    this.localMediaSource.disconnect();
    this.localMediaSource.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.audioEl.play();
    this.hasLiveAudio = true;
    if (onMeta) {
      onMeta({
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: "Local Audio File",
        duration: 0
      });
    }
  }

  toggleDemoSynth(onMeta) {
    if (this.isDemoPlaying) {
      this.stopDemo();
      return false;
    }
    this.ensureContext();
    this.isDemoPlaying = true;
    this.hasLiveAudio = true;

    let step = 0;
    const notes = [110, 110, 146.83, 130.81, 98, 98, 164.81, 146.83];

    const triggerBeat = () => {
      if (!this.isDemoPlaying) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(notes[step % notes.length], now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.22);

      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.analyser);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);

      if (step % 2 === 1) {
        const hi = this.ctx.createOscillator();
        const hiGain = this.ctx.createGain();
        hi.type = "sawtooth";
        hi.frequency.setValueAtTime(6200 + Math.random() * 2000, now);
        hiGain.gain.setValueAtTime(0.08, now);
        hiGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        hi.connect(hiGain);
        hiGain.connect(this.analyser);
        hiGain.connect(this.ctx.destination);
        hi.start(now);
        hi.stop(now + 0.09);
      }

      step++;
    };

    triggerBeat();
    this.demoTimer = setInterval(triggerBeat, 260);

    if (onMeta) {
      onMeta({
        title: "Demo Synth Pulse",
        artist: "Built-in Web Audio Generator",
        duration: 0
      });
    }
    return true;
  }

  stopDemo() {
    this.isDemoPlaying = false;
    if (this.demoTimer) {
      clearInterval(this.demoTimer);
      this.demoTimer = null;
    }
  }

  computeBands(fft) {
    const len = fft.length;
    const bassEnd = Math.floor(len * 0.12);
    const midsEnd = Math.floor(len * 0.52);

    let bassSum = 0;
    let midsSum = 0;
    let trebleSum = 0;

    for (let i = 0; i < len; i++) {
      const v = fft[i] / 255;
      if (i < bassEnd) bassSum += v;
      else if (i < midsEnd) midsSum += v;
      else trebleSum += v;
    }

    const bass = Math.min(1.5, (bassSum / Math.max(1, bassEnd)) * this.eqGains.bass * this.sensitivity);
    const mids = Math.min(1.5, (midsSum / Math.max(1, midsEnd - bassEnd)) * this.eqGains.mids * this.sensitivity);
    const treble = Math.min(1.5, (trebleSum / Math.max(1, len - midsEnd)) * this.eqGains.treble * this.sensitivity);
    const energy = bass * 0.45 + mids * 0.35 + treble * 0.2;

    return { bass, mids, treble, energy };
  }

  sampleAmbientPulse() {
    const t = performance.now() * 0.001;
    const kick = Math.pow(0.5 + 0.5 * Math.sin(t * 4.4), 4);
    const snare = Math.pow(0.5 + 0.5 * Math.sin(t * 2.2 + 1.5), 6);

    for (let i = 0; i < this.fftData.length; i++) {
      const ratio = i / this.fftData.length;
      const harmonic =
        0.5 +
        0.5 * Math.sin(t * 3.1 + i * 0.16) * Math.cos(t * 1.4 - i * 0.08);
      const lowBoost = ratio < 0.2 ? kick * 0.65 : 0;
      const midBoost = ratio >= 0.2 && ratio < 0.55 ? snare * 0.55 : 0;
      const envelope = Math.exp(-ratio * 1.9) * (0.4 + 0.6 * kick) + lowBoost + midBoost;
      this.fftData[i] = Math.min(255, Math.floor(210 * envelope * (0.45 + 0.55 * harmonic)));
    }

    for (let i = 0; i < this.timeData.length; i++) {
      const v =
        Math.sin(t * 7 + i * 0.1) * (0.35 + 0.45 * kick) +
        Math.cos(t * 13 - i * 0.18) * 0.22 * snare;
      this.timeData[i] = Math.max(0, Math.min(255, Math.floor(128 + v * 75)));
    }

    return {
      fft: this.fftData,
      time: this.timeData,
      bands: this.computeBands(this.fftData)
    };
  }

  sample() {
    // Priority 1: Live macOS ScreenCaptureKit WebSocket Bridge (zero delay, zero tab sharing)
    if (this.wsConnected) {
      const alpha = 1 - Math.min(0.92, Math.max(0.15, this.smoothing * 0.85));
      for (let i = 0; i < 128; i++) {
        this.smoothFft[i] += (this.wsTargetFft[i] - this.smoothFft[i]) * alpha;
        this.fftData[i] = Math.round(this.smoothFft[i]);
      }
      // Synthesize smooth waveform from live spectrum for wave/plasma modes
      const t = performance.now() * 0.01;
      for (let i = 0; i < this.timeData.length; i++) {
        const amp = (this.fftData[i % 64] / 255) * 90;
        this.timeData[i] = Math.max(0, Math.min(255, Math.floor(128 + Math.sin(t + i * 0.18) * amp)));
      }
      return {
        fft: this.fftData,
        time: this.timeData,
        bands: this.computeBands(this.fftData)
      };
    }

    // Priority 2: Local file / Demo Synth
    if (this.analyser && this.hasLiveAudio) {
      this.analyser.getByteFrequencyData(this.fftData);
      this.analyser.getByteTimeDomainData(this.timeData);
      return {
        fft: this.fftData,
        time: this.timeData,
        bands: this.computeBands(this.fftData)
      };
    }

    // Priority 3: Playback-Synced Pulse when remote Spotify is playing
    if (this.isRemotePlaying) {
      return this.sampleAmbientPulse();
    }

    return {
      fft: this.fftData,
      time: this.timeData,
      bands: { bass: 0, mids: 0, treble: 0, energy: 0 }
    };
  }
}
