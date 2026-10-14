# Serene — A Pocket Sanctuary

A relaxing, premium web experience. Open it, breathe, and let the noise go.

## Features

- **Ambience engine** — 8 synthesized soundscapes (rain, ocean, wind chimes, fireplace, birdsong, white/pink/brown noise) with per-sound volumes, crossfades and one-tap presets. No audio files: everything is generated live with the Web Audio API.
- **Focus timer** — Pomodoro / Deep Work / Sprint / custom presets, accurate timestamp-based countdown, animated progress ring, completion chimes, optional notifications, screen wake-lock so sessions don't drift in the background.
- **Breathing coach** — Box (4·4·4·4), 4-7-8 sleep and coherent (5·5) patterns with an animated orb, live countdown and soft sound cues.
- **Zen garden** — drag to rake ripples into the sand; watch them fade. One tap resets the garden.
- **Mood check-in & stats** — daily mood log with a 7-day strip, focus minutes today/total, breathing cycles, all persisted locally.
- **Five ambient themes** — Dusk, Forest, Ocean, Candlelight, Midnight, each re-tinting the whole scene (including the browser tab color).
- **Living scenes** — full-bleed nature & wildlife backdrops (Misty Pines, Ocean Dusk, Deer at Dawn, Grove Owl, Fox Meadow, Misty Ridges), each a hi-res photo (2840–3840 px wide) rendered completely still for a calm, jitter-free backdrop; switching scenes uses a dual-layer opacity crossfade (the incoming photo loads hidden, then both fade — no pop, no flicker). A soft veil keeps every card readable, and the choice is persisted + cached offline. Or keep the original Aurora — it dims and pauses under any photo.
- **Sleep mode** — after you go idle the room dims and sounds soften to a murmur; any movement wakes it gently.
- **Daily wisdom** — a rotating quote with shuffle & copy-to-clipboard.
- **PWA** — installable, offline-capable (service worker), app icons, standalone display.
- **Fireflies** — a living particle field with eased pointer parallax: the field glides toward the cursor over ~1 s instead of jumping, and it dims to 35 % over photo scenes so backdrops read as still (respects *prefers-reduced-motion*).
- **Keyboard shortcuts** — `1–8` sounds, `H/S/T/B/G/J` tabs, `Space` start/pause focus, `M` mute, `F` fullscreen, `?` help.
- **Data control** — export / import a JSON backup of your settings and stats; one-tap reset. Everything stays in your browser (localStorage).

## Run it

Any static file server works:

```bash
cd serene
python -m http.server 8000
# open http://localhost:8000
```

(Or just open `index.html` directly — the service worker only activates over http/https.)

## Test it

```bash
cd serene
npm install            # installs jsdom (dev dependency)
npm test               # runs the DOM smoke test suite
```

The smoke test boots the real page in jsdom and verifies: tab navigation, sound toggling + presets, focus timer start/pause/complete, breathing coach phases, zen-garden ripples, mood logging, stats rendering, theme switching, and JSON export.
