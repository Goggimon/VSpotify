// Unified Audio Engine: Tab Audio Capture (Zero-Delay FFT), Local Files, Demo Synth, and Playback Pulse

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.captureStream = null;
    this.audioEl = new Audio();
    this.audioEl.crossOrigin = "anonymous";
    this.demoTimer = null;
    this.isDemoPlaying = false;
    this.hasLiveAudio = false;
    this.isRemotePlaying = false;

    this.fftData = new Uint8Array(256);
    this.timeData = new Uint8Array(256);
    this.eqGains = { bass: 1.2, mids: 1.0, treble: 1.1 };
    this.smoothing = 0.78;
    this.sensitivity = 1.2;
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

  async startTabCapture() {
    this.stopDemo();
    this.ensureContext();

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      },
      preferCurrentTab: true
    });

    stream.getVideoTracks().forEach((t) => t.stop());

    if (stream.getAudioTracks().length === 0) {
      throw new Error("No audio track was shared. Make sure 'Share tab audio' is checked.");
    }

    if (this.source) this.source.disconnect();
    this.captureStream = stream;
    this.source = this.ctx.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    this.hasLiveAudio = true;

    stream.getAudioTracks()[0].addEventListener("ended", () => {
      this.hasLiveAudio = false;
    });
    return true;
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
    if (this.analyser && this.hasLiveAudio) {
      this.analyser.getByteFrequencyData(this.fftData);
      this.analyser.getByteTimeDomainData(this.timeData);
      return {
        fft: this.fftData,
        time: this.timeData,
        bands: this.computeBands(this.fftData)
      };
    }

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
