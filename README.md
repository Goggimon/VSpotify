# VSpotify v3.5.0

A calm, fullscreen visual instrument for Spotify and local audio—featuring **27 real-time visualizers** (Canvas 2D + WebGL shaders), **5 fluid connected lyric scenes** with Adaptive Scene Flow, an **8-role Album Palette engine**, **Adaptive Album Art Anchors**, and a **Performance Governor** built to keep playback smooth on any device.

**Live App:** https://goggimon.github.io/VSpotify/

---

## Features

### 5 Fluid Lyric Scenes & Adaptive Scene Flow
- **Signature Connected Scenes:**
  1. **Connected Zigzag** — Spatial word route linked by a continuous SVG Bezier path and traveling highlight comet.
  2. **Cinema Captions** — Clean, readable two-line default with calm cross-dissolves.
  3. **Editorial** — Large asymmetric serif typography that opens up during choruses.
  4. **Constellation** — Persistent connected star-node field with subtle audio-reactive pulse.
  5. **Neon Thread** — Continuous glowing light thread linking adjacent lines.
- **Fluid Continuity:** Outgoing lines dissolve smoothly (`is-entering` / `is-outgoing`) rather than snapping/rebuilding every line.
- **Adaptive Scene Flow:** Detects verses, choruses, and instrumental breathing gaps to modulate motion (`Calm` / `Balanced` / `Expressive`) while keeping one consistent scene identity per song.
- **Flexible Sources:** Fetches synced/static lyrics via [LRCLIB](https://lrclib.net/) or lets you import local `.lrc`, `.txt`, or `.json` files with timing offset controls.

### 8-Role Album Palette & Adaptive Art Anchors
- **Full 8-Role Album Palette:** Extracts `background`, `backgroundShade`, `lyricPrimary`, `lyricSecondary`, `visualPrimary`, `visualSecondary`, `highlight`, and `shadow` once per album-art change—preserving tonal shades while guaranteeing lyric contrast. Switch between **Album Palette** and **Manual Accent** anytime.
- **Adaptive Album Art Anchors:** Configure **Album Art** (`Adaptive`, `Center`, `Corner`, `Ambient`, `Hidden`), **Art Scale**, and **Art Intensity** (`Subtle`, `Balanced`, `Bold`). In `Adaptive` mode, artwork embeds into centered visualizers when lyrics aren't blocking it, docks cleanly in the corner for linear modes, and softens into an ambient disc behind lyric scenes.

### 27 Visualizers & Performance Governor
- **Single Central Loop + Performance Governor:** One `requestAnimationFrame` loop drives audio sampling, the active visualizer, and lyrics together. Choose **Cinematic**, **Balanced**, or **Battery Saver** profiles; if a heavy WebGL mode lags or WebGL is unavailable, VSpotify scales down detail first and safely falls back to **Retro Audio Lab** with a one-click switch-back toast.
- **Categorized Visualizer Browser (`B`) & Shuffle-Bag `Surprise Me` (`R`):** Browse by category or Favorites, and cycle through every supported visualizer without repeats until the deck resets.
  - **Core (6):** `Bars`, `Radial`, `Wave`, `Particles`, `Horizon`, `Matrix`
  - **Spatial (8):** `Vinyl`, `Warp`, `Spiral`, `Synthwave`, `DNA`, `Mandala`, `Aurora`, `Orbit`
  - **Legacy FX (10):** `Liquid Spectrum`, `Fractal Tunnel` *(WebGL)*, `Kaleidoscope` *(WebGL)*, `SuperScope` *(multi-equation vector art)*, `Plasma Reactor` *(WebGL)*, `Wireframe City`, `Laser Cathedral`, `Chromatic Bloom`, `Crystal Engine`, `Milkdrop`
  - **Technical (3):** `Retro Audio Lab` *(always-smooth VU + scope)*, `Plasma Ribbons`, `Concert`

### Playback, Audio & HUD
- **Automatic Spotify HUD & Connect Device:** Follows playback on any Spotify Connect device (Mac, phone, speaker) via Spotify Web API, with Play/Pause/Next/Previous/Seek and in-tab **Play Here** via Spotify's Web Playback SDK.
- **Zero-Delay 60fps Tab Audio:** Click **Play Here** → **Tab Audio** (with *Share tab audio* checked) to pipe live audio into the Web Audio `AnalyserNode`—no admin privileges or virtual audio drivers required. Falls back to a smooth playback-synced pulse on external devices.
- **Demo Scene & Local Audio:** Test without logging into Spotify using **Demo Scene** (built-in synth beat) or **Local Audio** (`Customize → Playback & Lyrics → Advanced`).
- **4 HUD Presets (`H`) & Lyric Focus (`V`):** Cycle between `Cinema`, `Minimal`, `Centered`, and `Hidden`, or toggle **Lyric Focus** to dim the visualizer and let lyrics lead.

---

## Setup

1. Open **https://goggimon.github.io/VSpotify/** in Chrome, Arc, or Edge.
2. In your [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), create an app, enable **Web API** + **Web Playback SDK**, and add `https://goggimon.github.io/VSpotify/` under **Redirect URIs**.
3. Click **Connect**, paste your **Client ID**, and authorize (Spotify Premium required).
4. Click **Play Here** → **Tab Audio** → select **This Tab** (check **Share tab audio**) for real-time 60fps reactivity.

---

## Keyboard Shortcuts
- `Space`: Play / Pause
- `L`: Toggle Lyrics
- `V`: Toggle Lyric Focus Mode
- `B`: Open Visualizer Browser
- `R`: Surprise Me (shuffle-bag next visualizer)
- `H`: Cycle HUD Layout (`Cinema` → `Minimal` → `Centered` → `Hidden`)
- `C`: Open / Close Customize Drawer
- `F`: Toggle Fullscreen
- `1–9`, `0`: Quick-switch first 10 visualizers
- `?`: Show Keyboard Shortcuts
