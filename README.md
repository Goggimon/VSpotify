# VSpotify v1.0

A custom, fullscreen Spotify visualizer and HUD with 9 real-time 60fps visualizers, dynamic 2-color album-art theming, and a zero-dependency macOS system-audio FFT bridge.

## Features
- **Automatic Spotify HUD:** Follows whatever device you're playing on (Mac, Phone, or Echo Dot) via Spotify Web API, with Play/Pause/Next/Previous/Seek controls and optional browser playback (`Play Here`).
- **2-Color Album Art Theme:** Extracts the most present color for the background and the 2nd/3rd most present distinct colors for alternating visualizer lines, bars, and waves.
- **9 Visualizers (`1–9`):** Bars, Radial, Wave, Particles, Horizon, Matrix, Milkdrop, Plasma, and Concert Mirror.
- **4 Fullscreen HUDs (`H`):** Cinema, Minimal, Centered, and Hidden (with idle auto-hide).
- **Real-Time macOS Audio Bridge:** Optional `ScreenCaptureKit` Swift helper streams 60fps system-audio FFT over `ws://127.0.0.1:8889` with zero tab sharing.

## Quick Start

1. **Start the local web server:**
   ```bash
   cd ~/Documents/Apps/VSpotify
   python3 -m http.server 8888 --bind 127.0.0.1
   ```
2. **Open `http://127.0.0.1:8888/`** in Chrome, Arc, or Edge.
3. **Connect Spotify:**
   - Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
   - Add `http://127.0.0.1:8888/` under **Redirect URIs** and enable **Web API** + **Web Playback SDK**.
   - Click **Connect**, paste your **Client ID**, and authorize (Spotify Premium required).
4. **(Optional) Enable Real-Time 60fps Audio:**
   ```bash
   swiftc helper/AudioBridge.swift -O -o helper/vspotify-audio
   ./helper/vspotify-audio
   ```

## Keyboard Shortcuts
- `1–9`: Switch visualizer
- `H`: Cycle HUD layout
- `F`: Toggle Fullscreen
- `C`: Open/Close Customization Drawer
- `Space`: Play / Pause
