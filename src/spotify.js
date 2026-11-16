// Spotify OAuth 2.0 PKCE + Automatic Active-Device HUD Polling + Web Playback SDK

const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state"
].join(" ");

const sdkReadyPromise = new Promise((resolve) => {
  if (window.Spotify) {
    resolve(window.Spotify);
  } else {
    window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify);
  }
});

function randomString(len = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (x) => chars[x % chars.length]).join("");
}

async function sha256Base64Url(plain) {
  const data = new TextEncoder().encode(plain);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export class SpotifyBridge {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.player = null;
    this.deviceId = null;
    this.sdkReady = false;
    this.sdkError = null;
    this.pollTimer = null;
    this.isPaused = true;
    this.token = localStorage.getItem("vspotify_access_token") || null;
  }

  getRedirectUri() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  async startAuth(clientId, deviceName) {
    localStorage.setItem("vspotify_client_id", clientId);
    localStorage.setItem("vspotify_device_name", deviceName || "VSpotify Mac");

    const verifier = randomString(64);
    const challenge = await sha256Base64Url(verifier);
    localStorage.setItem("vspotify_code_verifier", verifier);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: SCOPES,
      redirect_uri: this.getRedirectUri(),
      code_challenge_method: "S256",
      code_challenge: challenge
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async handleCallbackIfPresent() {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      window.history.replaceState({}, document.title, this.getRedirectUri());
      throw new Error(`Spotify auth denied: ${error}`);
    }

    const code = params.get("code");
    if (!code) return Boolean(this.token);

    this.callbacks.onStatus?.("Exchanging token...", false);
    const clientId = localStorage.getItem("vspotify_client_id");
    const verifier = localStorage.getItem("vspotify_code_verifier");
    if (!clientId || !verifier) {
      throw new Error("Missing Client ID or verifier. Click Connect again.");
    }

    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: this.getRedirectUri(),
      code_verifier: verifier
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error_description || data.error || "Token exchange failed");
    }

    this.token = data.access_token;
    localStorage.setItem("vspotify_access_token", data.access_token);
    if (data.refresh_token) {
      localStorage.setItem("vspotify_refresh_token", data.refresh_token);
    }

    window.history.replaceState({}, document.title, this.getRedirectUri());
    return true;
  }

  async refreshToken() {
    const refresh = localStorage.getItem("vspotify_refresh_token");
    const clientId = localStorage.getItem("vspotify_client_id");
    if (!refresh || !clientId) return null;

    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: refresh
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    if (!res.ok) return null;
    const data = await res.json();
    this.token = data.access_token;
    localStorage.setItem("vspotify_access_token", data.access_token);
    if (data.refresh_token) {
      localStorage.setItem("vspotify_refresh_token", data.refresh_token);
    }
    return this.token;
  }

  async apiFetch(path, options = {}) {
    if (!this.token) return null;
    let res = await fetch(`https://api.spotify.com/v1${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(options.headers || {})
      }
    });

    if (res.status === 401) {
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        localStorage.removeItem("vspotify_access_token");
        this.token = null;
        this.callbacks.onStatus?.("Session expired — reconnect", false);
        return null;
      }
      res = await fetch(`https://api.spotify.com/v1${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...(options.headers || {})
        }
      });
    }
    return res;
  }

  startPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);

    const poll = async () => {
      try {
        const res = await this.apiFetch("/me/player");
        if (!res) return;

        if (res.status === 204) {
          if (!this.sdkReady) {
            const note = this.sdkError ? ` (${this.sdkError})` : "";
            this.callbacks.onStatus?.(`Connected${note}`, true);
          }
          this.isPaused = true;
          this.callbacks.onPlayingChange?.(false);
          return;
        }

        if (!res.ok) return;
        const data = await res.json();
        if (!data || !data.item) return;

        this.isPaused = !data.is_playing;
        this.callbacks.onPlayingChange?.(data.is_playing);

        const deviceLabel = data.device?.name ? `Following: ${data.device.name}` : "Connected";
        const suffix = this.sdkError ? ` · ${this.sdkError}` : "";
        this.callbacks.onStatus?.(`${deviceLabel}${suffix}`, true);

        this.callbacks.onTrackUpdate?.({
          name: data.item.name,
          artists: data.item.artists.map((a) => a.name).join(", "),
          artUrl: data.item.album?.images?.[0]?.url || "",
          duration: data.item.duration_ms || 0,
          position: data.progress_ms || 0,
          paused: !data.is_playing
        });
      } catch {
        // Ignore transient network hiccups
      }
    };

    poll();
    this.pollTimer = setInterval(poll, 1500);
  }

  async transferHere() {
    if (!this.deviceId) {
      throw new Error(this.sdkError || "Browser Connect device is not registered yet.");
    }
    if (this.player?.activateElement) {
      await this.player.activateElement();
    }
    await this.apiFetch("/me/player", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_ids: [this.deviceId], play: true })
    });
  }

  async initPlayer() {
    if (!this.token) return;

    this.callbacks.onStatus?.("Connected — Syncing...", true);
    this.startPolling();

    try {
      const SpotifySDK = await Promise.race([
        sdkReadyPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("SDK blocked/timeout")), 6000))
      ]);
      const deviceName = localStorage.getItem("vspotify_device_name") || "VSpotify Mac";

      this.player = new SpotifySDK.Player({
        name: deviceName,
        getOAuthToken: async (cb) => {
          if (!this.token) await this.refreshToken();
          cb(this.token);
        },
        volume: 0.85
      });

      this.player.addListener("ready", ({ device_id }) => {
        this.deviceId = device_id;
        this.sdkReady = true;
        this.sdkError = null;
        this.callbacks.onReady?.(device_id, deviceName);
      });

      this.player.addListener("not_ready", () => {
        this.sdkReady = false;
      });

      this.player.addListener("player_state_changed", (state) => {
        if (!state) return;
        const track = state.track_window.current_track;
        this.isPaused = state.paused;
        this.callbacks.onPlayingChange?.(!state.paused);
        this.callbacks.onTrackUpdate?.({
          name: track.name,
          artists: track.artists.map((a) => a.name).join(", "),
          artUrl: track.album.images[0]?.url || "",
          duration: state.duration,
          position: state.position,
          paused: state.paused
        });
      });

      this.player.addListener("initialization_error", ({ message }) => {
        this.sdkError = `DRM/Browser: ${message}`;
        this.callbacks.onSdkError?.(this.sdkError);
      });

      this.player.addListener("authentication_error", async ({ message }) => {
        const refreshed = await this.refreshToken();
        if (refreshed) this.player.connect();
        else this.sdkError = `Auth: ${message}`;
      });

      this.player.addListener("account_error", ({ message }) => {
        this.sdkError = `Account: ${message}`;
        this.callbacks.onSdkError?.(this.sdkError);
      });

      await this.player.connect();
    } catch (err) {
      this.sdkError = err.message;
      this.callbacks.onSdkError?.(this.sdkError);
    }
  }

  async togglePlay() {
    if (this.sdkReady && this.player) {
      const state = await this.player.getCurrentState();
      if (state) return this.player.togglePlay();
    }
    await this.apiFetch(this.isPaused ? "/me/player/play" : "/me/player/pause", { method: "PUT" });
  }

  async nextTrack() {
    if (this.sdkReady && this.player) {
      const state = await this.player.getCurrentState();
      if (state) return this.player.nextTrack();
    }
    await this.apiFetch("/me/player/next", { method: "POST" });
  }

  async previousTrack() {
    if (this.sdkReady && this.player) {
      const state = await this.player.getCurrentState();
      if (state) return this.player.previousTrack();
    }
    await this.apiFetch("/me/player/previous", { method: "POST" });
  }

  async seek(ms) {
    if (this.sdkReady && this.player) {
      const state = await this.player.getCurrentState();
      if (state) return this.player.seek(ms);
    }
    await this.apiFetch(`/me/player/seek?position_ms=${Math.round(ms)}`, { method: "PUT" });
  }
}
