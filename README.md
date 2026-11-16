# VSpotify v2.0.0

A minimalist, fullscreen Spotify visualizer and HUD hosted on GitHub Pages—featuring 17 real-time 60fps visualizers, dynamic 2-color album-art theming, smart fullscreen art placement, and zero-delay browser Tab Audio FFT reactivity.

**Live App:** https://goggimon.github.io/VSpotify/

## Features
- **Automatic Spotify HUD & Connect Device:** Follows whatever device you're playing on (Mac, Phone, or Echo Dot) via Spotify Web API, with Play/Pause/Next/Previous/Seek controls and in-tab playback (**Play Here**) via Spotify's Web Playback SDK.
- **Zero-Delay 60fps Reactivity:** Click **Play Here**, then **Tab Audio** (with *Share tab audio* checked) to pipe live audio into the Web Audio `AnalyserNode`—no admin privileges or kernel drivers required. Automatically falls back to a smooth Playback-Synced Pulse when playing on external devices.
- **Dynamic 2-Color Album Art Theme:** Extracts the most present color for the background and the 2nd/3rd most present distinct colors for alternating visualizer lines, bars, and waves.
- **Smart Fullscreen & Idle Art Placement:** When fullscreen is active or the HUD auto-hides:
  - Centered visualizers (*Radial, Spiral, Milkdrop, Mandala, Orbit*) place the live album art in the center so visuals diverge outward from it.
  - Linear/wall visualizers (*Bars, Wave, Plasma, Aurora, Synthwave, etc.*) dock a compact floating album-art card in the bottom-left corner.
- **17 Visualizers:**
  1. `Bars` — Classic spectrum bars with peak caps
  2. `Radial` — Circular beat ring around center art
  3. `Wave` — Multi-layer glowing oscilloscope
  4. `Particles` — Audio-reactive starfield
  5. `Horizon` — Layered frequency terrain
  6. `Matrix` — LED equalizer grid
  7. `Milkdrop` — Winamp-style geometric tunnel
  8. `Plasma` — Flowing interference ribbons
  9. `Concert` — Symmetrical festival LED mirror spectrum
  10. `Vinyl` — Spinning turntable disc with live album art
  11. `Warp` — 3D starfield warp tunnel
  12. `Spiral` — Rotating multi-arm frequency galaxy
  13. `Synthwave` — Segmented retro sun & 3D perspective grid
  14. `DNA` — Intertwining double-helix wave
  15. `Mandala` — 12-fold sacred geometry petals
  16. `Aurora` — Vertical northern-lights curtains
  17. `Orbit` — Tilted planetary rings with beat-reactive nodes
- **4 Fullscreen HUD Layouts (`H`):** `Cinema`, `Minimal`, `Centered`, and `Hidden` (with configurable idle auto-hide).
- **Luxury Customization & Presets:** Switch between **Obsidian Glass** and **Warm Espresso** surfaces, tune **Line/Bar Thickness**, **Motion Speed**, **Center Art Size**, **Glow**, **Sensitivity**, **Smoothing**, **Density**, **Visual EQ Reactivity** (Bass/Mids/Treble), and save custom presets (alongside built-in *Late Night*, *Concert Hall*, *Deep Space*, and *Retro Dusk*).

## Setup

1. Open **https://goggimon.github.io/VSpotify/** in Chrome, Arc, or Edge.
2. In your [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), create an app, enable **Web API** + **Web Playback SDK**, and add `https://goggimon.github.io/VSpotify/` under **Redirect URIs**.
3. Click **Connect**, paste your **Client ID**, and authorize (Spotify Premium required).
4. Click **Play Here** → **Tab Audio** → select **This Tab** (check **Share tab audio**) for real-time 60fps reactivity.

*(To test without logging into Spotify, open **Customize** (`C`) and use **Synth Beat** or **Load Audio File**.)*

## Keyboard Shortcuts
- `1–9`, `0`: Switch between the first 10 visualizers (`0` = Vinyl)
- `H`: Cycle HUD layout (`Cinema` → `Minimal` → `Centered` → `Hidden`)
- `F`: Toggle Fullscreen
- `C`: Open / Close Customization Drawer
- `Space`: Play / Pause

## Roadmap
- **v2.1 — Synced Lyrics & Queue Drawer:** Time-synced lyrics overlay (via LRCLIB) plus a slide-up Spotify queue and playlist switcher.
- **v2.2 — WebGL / GLSL Shader Modes:** GPU-accelerated fluid smoke, liquid metal, and raymarched 3D tunnels.
- **v2.3 — Second-Screen / TV Display Mode:** A `?display=1` URL mode that hides controls completely for a monitor or TV while you control playback from your phone.
- **v3.0 — Optional Desktop Wrapper:** Lightweight Electron/Tauri or macOS WebKit shell for global media keys and zero-prompt audio capture.
