// Extrapolated Playback Clock with Drift Correction for Smooth 60fps Lyrics

export class PlaybackClock {
  constructor() {
    this.trackKey = null;
    this.positionMs = 0;
    this.observedAt = performance.now();
    this.paused = true;
    this.durationMs = 0;
    this.lastSource = "none";
  }

  reset(trackKey = null, durationMs = 0) {
    this.trackKey = trackKey;
    this.positionMs = 0;
    this.observedAt = performance.now();
    this.paused = true;
    this.durationMs = durationMs || 0;
    this.lastSource = "none";
  }

  update(snapshot) {
    if (!snapshot) return;
    const now = snapshot.observedAt ?? performance.now();
    const nextKey = snapshot.trackKey || snapshot.uri || snapshot.trackId || null;

    // Snap immediately on track change
    if (nextKey !== this.trackKey) {
      this.trackKey = nextKey;
      this.positionMs = Math.max(0, snapshot.position || 0);
      this.observedAt = now;
      this.paused = Boolean(snapshot.paused);
      this.durationMs = snapshot.duration || 0;
      this.lastSource = snapshot.source || "poll";
      return;
    }

    const incomingPos = Math.max(0, snapshot.position || 0);
    const incomingPaused = Boolean(snapshot.paused);
    const source = snapshot.source || "poll";
    this.durationMs = snapshot.duration || this.durationMs;

    // Snap on SDK state, explicit seek, or pause/resume transition
    if (source === "sdk" || source === "seek" || incomingPaused !== this.paused) {
      this.positionMs = incomingPos;
      this.observedAt = now;
      this.paused = incomingPaused;
      this.lastSource = source;
      return;
    }

    // Reconcile 1.5s Web API poll updates smoothly without backwards/forwards jitter
    const extrapolated = this.getRawPositionMs(now);
    const drift = incomingPos - extrapolated;

    if (Math.abs(drift) > 1800) {
      // Major drift (seek on phone/Echo Dot or long stall): snap
      this.positionMs = incomingPos;
      this.observedAt = now;
    } else if (!incomingPaused) {
      // Gentle 25% blend to absorb network latency without visible jumps
      this.positionMs = extrapolated + drift * 0.25;
      this.observedAt = now;
    }

    this.paused = incomingPaused;
    this.lastSource = source;
  }

  getRawPositionMs(now = performance.now()) {
    if (this.paused) return this.positionMs;
    const elapsed = Math.max(0, now - this.observedAt);
    const pos = this.positionMs + elapsed;
    return this.durationMs > 0 ? Math.min(this.durationMs, pos) : pos;
  }

  getPositionMs(offsetMs = 0) {
    return Math.max(0, this.getRawPositionMs() + (Number(offsetMs) || 0));
  }
}

export function findActiveLineIndex(lines, posMs) {
  if (!Array.isArray(lines) || lines.length === 0) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const start = lines[mid].startMs;
    if (start !== null && start <= posMs) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}
