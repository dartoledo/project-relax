/* ============================================================
   Serene — A Pocket Sanctuary
   app.js
   ============================================================ */
(() => {
"use strict";

/* ---------------- helpers ---------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad   = n => String(n).padStart(2, "0");
const fmtClock = s => { s = Math.max(0, Math.ceil(s)); return pad(Math.floor(s / 60)) + ":" + pad(s % 60); };
const fmtMin   = m => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
const todayKey = () => new Date().toISOString().slice(0, 10);
const reducedMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- state ---------------- */
const STORE_KEY = "serene.v1";
const DEFAULTS = {
  theme: "dusk",
  masterVolume: 70,
  muted: false,
  soundVolumes: { rain: 70, ocean: 65, chimes: 55, fire: 60, birds: 50, white: 40, pink: 35, brown: 55 },
  activeSounds: [],
  focusPreset: "pomodoro",
  chime: true,
  notify: false,
  breathPattern: "box",
  cues: true,
  sleepMode: true,
  idleSeconds: 300,
};
const DEFAULT_STATS = { sessions: [], focusMin: 0, breathCycles: 0, moods: {} };

function loadState() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { data = null; }
  const settings = Object.assign({}, DEFAULTS, data && data.settings);
  settings.soundVolumes = Object.assign({}, DEFAULTS.soundVolumes, data && data.settings && data.settings.soundVolumes);
  const stats = Object.assign({}, DEFAULT_STATS, data && data.stats);
  return { settings, stats };
}
const { settings: S, stats: T } = loadState();
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify({ settings: S, stats: T })); } catch (e) { /* private mode */ } }

/* ---------------- toasts ---------------- */
const toastsEl = $("#toasts");
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  toastsEl.appendChild(t);
  setTimeout(() => t.remove(), 3600);
}

/* ---------------- themes ---------------- */
const THEME_COLORS = { dusk: "#1c2340", forest: "#14231c", ocean: "#0d1f33", candle: "#241a12", midnight: "#0f1222" };
function applyTheme(name) {
  S.theme = name; save();
  document.documentElement.dataset.theme = name;
  const meta = $('meta[name="theme-color"]');
  if (meta && THEME_COLORS[name]) meta.setAttribute("content", THEME_COLORS[name]);
  $$('.swatch').forEach(b => b.classList.toggle("active", b.dataset.theme === name));
}
$$('.swatch').forEach(b => b.addEventListener("click", () => applyTheme(b.dataset.theme)));

/* ---------------- tabs ---------------- */
const PANES = { home: "#pane-home", sounds: "#pane-sounds", focus: "#pane-focus", breathe: "#pane-breathe", garden: "#pane-garden", stats: "#pane-stats" };
let activeTab = "home";
function setTab(name, opts) {
  if (!PANES[name]) return;
  activeTab = name;
  $$('.tab').forEach(b => {
    const on = b.dataset.tab === name;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", String(on));
  });
  Object.values(PANES).forEach(sel => $(sel).classList.remove("active"));
  $(PANES[name]).classList.add("active");
  if (!opts || !opts.noScroll) window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
}
$$('.tab').forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));

/* ---------------- greeting & quote ---------------- */
function greet() {
  const h = new Date().getHours();
  $("#greeting").textContent = h < 5 ? "The night is quiet" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
const QUOTES = [
  ["Stillness is not the absence of motion — it is the presence of you.", "Serene"],
  ["You do not have to control your thoughts. You just have to stop letting them control you.", "Unknown"],
  ["Nature does not hurry, yet everything is accomplished.", "Lao Tzu"],
  ["Rest when you are weary. Recovery is part of the work.", "Serene"],
  ["The quieter you become, the more you can hear.", "Ram Dass"],
  ["Breath by breath, this moment is all you have — and it is enough.", "Serene"],
  ["Let the beauty of what you love be your teacher.", "Rumi"],
  ["In the middle of difficulty lies opportunity.", "Albert Einstein"],
  ["Slow down and everything you are looking for will find you.", "Lao Tzu"],
  ["A day of worry has more sorrow than a year of work.", "Thomas Fuller"],
  ["The soul always bathes in silence, even when the world is loud.", "Serene"],
  ["Do what you can, love what you have share with whom you are.", "Satchelle"],
  ["Water is liquid, and it takes the shape of its container. Be water.", "After Bruce Lee"],
  ["The best way to unwind is to let go of what did not work out today.", "Serene"],
  ["Every breath you take is a fresh beginning.", "Unknown"],
  ["Calm minds rise like the sun — slowly, then all at once.", "Serene"],
];
function renderQuote(i) {
  const [q, a] = QUOTES[i % QUOTES.length];
  $("#quote").textContent = q;
  $("#quoteAuthor").textContent = "— " + a;
}
renderQuote(Math.floor(Date.now() / 864e5) % QUOTES.length);
$("#shuffleQuote").addEventListener("click", () => renderQuote(Math.floor(Math.random() * QUOTES.length)));
$("#copyQuote").addEventListener("click", async () => {
  const text = `“${$("#quote").textContent}” — ${$("#quoteAuthor").textContent.replace(/^—\s*/, "")}`;
  try { await navigator.clipboard.writeText(text); toast("Copied to clipboard"); }
  catch (e) { toast("Copy: “" + text.slice(0, 40) + "…”"); }
});

/* quick cards */
$$('.quick-card').forEach(c => c.addEventListener("click", () => {
  setTab(c.dataset.goto);
  if (c.dataset.goto === "sounds") applyPreset("rainynight", true);
}));

/* ---------------- audio engine ---------------- */
const SOUND_DEFS = [
  { id: "rain",   name: "Rain",        icon: "🌧️" },
  { id: "ocean",  name: "Ocean",       icon: "🌊" },
  { id: "chimes", name: "Wind Chimes", icon: "🎐" },
  { id: "fire",   name: "Fireplace",   icon: "🔥" },
  { id: "birds",  name: "Birdsong",    icon: "🐦" },
  { id: "white",  name: "White Noise", icon: "⚪" },
  { id: "pink",   name: "Pink Noise",  icon: "🌸" },
  { id: "brown",  name: "Brown Noise", icon: "🍫" },
];
const SOUND_PRESETS = {
  rainynight: { label: "🌙 Rainy Night", mix: { rain: 80, fire: 45 } },
  oceandrift: { label: "🌊 Ocean Drift", mix: { ocean: 90, chimes: 35 } },
  forestdawn: { label: "🌿 Forest Dawn", mix: { birds: 70, rain: 40 } },
  deepsleep:  { label: "💤 Deep Sleep",  mix: { brown: 60, ocean: 45 } },
};

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];

class AudioEngine {
  constructor(defs) {
    this.defs = defs;
    this.ctx = null;
    this.master = null;
    this.nodes = {};      // id -> { stop() }
    this.sleepScale = 1;
  }
  ensure() {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    this.applyMaster();
    return this.ctx;
  }
  resume() { if (this.ctx && this.ctx.resume) this.ctx.resume().catch(() => {}); }
  setSleepScale(s) { this.sleepScale = s; this.applyMaster(); }
  applyMaster() {
    if (!this.ctx || !this.master) return;
    const target = S.muted ? 0 : (S.masterVolume / 100) * this.sleepScale;
    const p = this.master.gain, t = this.ctx.currentTime;
    try { p.setTargetAtTime(target, t, 0.25); } catch (e) { p.value = target; }
  }
  noiseBuffer(kind) {
    const sr = this.ctx.sampleRate || 44100;
    const len = Math.floor(sr * 2);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    if (kind === "white") {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } else if (kind === "brown") {
      let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    } else { // pink — Paul Kellet
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.98950 * b2 + w * 0.0759697; b3 = 0.97900 * b3 + w * 0.1041336;
        b4 = 0.96160 * b4 + w * 0.1289532; b5 = 0.82270 * b5 + w * 0.1698818;
        b6 = -0.55690 * b6 - w * 0.0417598;
        d[i] = (b0+b1+b2+b3+b4+b5+b6) * 0.11 + w * 0.015;
      }
    }
    return buf;
  }
  loopNoise(kind, filters, gainVal) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(kind);
    src.loop = true;
    let node = src;
    for (const f of filters) {
      const flt = ctx.createBiquadFilter();
      if (flt.type !== undefined) { flt.type = f.type; flt.frequency.value = f.frequency; if (f.Q) flt.Q.value = f.Q; }
      node.connect(flt); node = flt;
    }
    const g = ctx.createGain();
    g.gain.value = gainVal;
    node.connect(g);
    g.connect(this.master);
    src.start();
    return { src, g };
  }
  burst(kind, dur, filterSpec, peak, when) {
    const ctx = this.ctx;
    const sr = ctx.sampleRate || 44100;
    const len = Math.max(64, Math.floor(sr * dur));
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    let node = src;
    if (filterSpec) {
      const flt = ctx.createBiquadFilter();
      flt.type = filterSpec.type; flt.frequency.value = filterSpec.frequency; flt.Q.value = filterSpec.Q || 1;
      node.connect(flt); node = flt;
    }
    const g = ctx.createGain();
    const t0 = when || ctx.currentTime;
    try {
      g.gain.setValueAtTime(Math.max(0.0001, peak), t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur * 1.6);
    } catch (e) { g.gain.value = peak; }
    node.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur * 2);
  }
  tone(freq, peak, attack, decay, when) {
    const ctx = this.ctx;
    const t0 = when || ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine"; osc.frequency.value = freq;
    const g = ctx.createGain();
    try {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + attack + decay);
    } catch (e) { g.gain.value = peak; }
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + attack + decay + 0.1);
    return osc;
  }
  start(id, volPct) {
    if (this.nodes[id]) return true;
    const ctx = this.ensure();
    if (!ctx) return false;
    this.resume();
    const v = clamp(volPct != null ? volPct : S.soundVolumes[id] || 50, 0, 100) / 100;
    let stopFns = [], timers = [];

    if (id === "rain") {
      const n = this.loopNoise("white", [{ type: "highpass", frequency: 300 }, { type: "lowpass", frequency: 5200 }], v * 0.5);
      stopFns.push(() => { try { n.src.stop(); } catch (e) {} });
      timers.push(setInterval(() => {
        if (Math.random() < 0.6) this.burst("white", 0.09, { type: "bandpass", frequency: 1400 + Math.random() * 2600, Q: 2 }, v * 0.22 * (0.35 + Math.random() * 0.65));
      }, 90));
    } else if (id === "ocean") {
      const ctx2 = this.ctx;
      const src = ctx2.createBufferSource();
      src.buffer = this.noiseBuffer("brown"); src.loop = true;
      const flt = ctx2.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = 420; flt.Q.value = 0.6;
      const g = ctx2.createGain(); g.gain.value = v * 0.85;
      src.connect(flt); flt.connect(g); g.connect(this.master);
      const lfo1 = ctx2.createOscillator(); lfo1.frequency.value = 0.07;                 // swell
      const l1g = ctx2.createGain(); l1g.gain.value = v * 0.45;
      lfo1.connect(l1g); l1g.connect(g.gain);
      const lfo2 = ctx2.createOscillator(); lfo2.frequency.value = 0.045;               // filter drift
      const l2g = ctx2.createGain(); l2g.gain.value = 260;
      lfo2.connect(l2g); l2g.connect(flt.frequency);
      src.start(); lfo1.start(); lfo2.start();
      stopFns.push(() => { [src, lfo1, lfo2].forEach(o => { try { o.stop(); } catch (e) {} }); });
    } else if (id === "chimes") {
      let alive = true;
      const ring = () => {
        if (!alive) return;
        const count = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          const f = PENTA[Math.floor(Math.random() * PENTA.length)];
          this.tone(f, v * 0.28, 0.015, 2.6 + Math.random() * 2.4, ctx.currentTime + i * (0.3 + Math.random() * 0.7));
        }
        timers.push(setTimeout(ring, 2600 + Math.random() * 6400));
      };
      ring();
      stopFns.push(() => { alive = false; });
    } else if (id === "fire") {
      const n = this.loopNoise("brown", [{ type: "lowpass", frequency: 380 }], v * 0.5);
      stopFns.push(() => { try { n.src.stop(); } catch (e) {} });
      timers.push(setInterval(() => {
        if (Math.random() < 0.6) this.burst("white", 0.05, { type: "bandpass", frequency: 1100 + Math.random() * 2800, Q: 2.5 }, v * (0.1 + Math.random() * 0.28));
      }, 70));
      timers.push(setInterval(() => { if (Math.random() < 0.5) this.burst("white", 0.09, { type: "bandpass", frequency: 3600 + Math.random() * 1400, Q: 3 }, v * 0.3); }, 2100));
    } else if (id === "birds") {
      let alive = true;
      const chirpSeq = () => {
        if (!alive) return;
        const nChirps = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < nChirps; i++) {
          const ctx2 = this.ctx, t0 = ctx2.currentTime + i * (0.12 + Math.random() * 0.15);
          const f0 = 1900 + Math.random() * 1600;
          const osc = ctx2.createOscillator();
          osc.type = "sine";
          try {
            osc.frequency.setValueAtTime(f0, t0);
            osc.frequency.linearRampToValueAtTime(f0 * (0.7 + Math.random() * 0.5), t0 + 0.08 + Math.random() * 0.06);
          } catch (e) { osc.frequency.value = f0; }
          const g = ctx2.createGain();
          try {
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.linearRampToValueAtTime(v * 0.16, t0 + 0.03);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
          } catch (e) { g.gain.value = v * 0.16; }
          osc.connect(g); g.connect(this.master);
          osc.start(t0); osc.stop(t0 + 0.3);
        }
        timers.push(setTimeout(chirpSeq, 1400 + Math.random() * 5200));
      };
      chirpSeq();
      stopFns.push(() => { alive = false; });
    } else if (id === "white") {
      const n = this.loopNoise("white", [{ type: "lowpass", frequency: 9000 }], v * 0.35);
      stopFns.push(() => { try { n.src.stop(); } catch (e) {} });
    } else if (id === "pink") {
      const n = this.loopNoise("pink", [{ type: "lowpass", frequency: 6000 }], v * 0.45);
      stopFns.push(() => { try { n.src.stop(); } catch (e) {} });
    } else if (id === "brown") {
      const n = this.loopNoise("brown", [{ type: "lowpass", frequency: 700 }], v * 0.8);
      stopFns.push(() => { try { n.src.stop(); } catch (e) {} });
    }

    this.nodes[id] = {
      stop() {
        timers.forEach(t => { clearTimeout(t); clearInterval(t); });
        stopFns.forEach(f => f());
        delete this.nodes[id];
      },
    };
    return true;
  }
  stop(id) {
    const n = this.nodes[id];
    if (n) { n.stop(); }
  }
}
const engine = new AudioEngine(SOUND_DEFS);

/* mixer UI */
const soundGrid = $("#soundGrid");
SOUND_DEFS.forEach(def => {
  const card = document.createElement("div");
  card.className = "card glass sound-card";
  card.dataset.sound = def.id;
  card.setAttribute("role", "button");
  card.tabIndex = 0;
  card.setAttribute("aria-pressed", "false");
  card.innerHTML =
    `<span class="sound-icon">${def.icon}</span>` +
    `<span class="sound-name">${def.name} <span class="sound-state">Off</span></span>` +
    `<span class="wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>` +
    `<input type="range" min="0" max="100" value="${S.soundVolumes[def.id] || 50}" data-sound="${def.id}" aria-label="${def.name} volume">`;
  soundGrid.appendChild(card);

  const slider = $("input", card);
  slider.addEventListener("click", e => e.stopPropagation());
  slider.addEventListener("input", () => {
    S.soundVolumes[def.id] = +slider.value; save();
    if (S.activeSounds.includes(def.id)) engine.start(def.id, +slider.value); // live retune
    else toggleSound(def.id); // sliding a silent sound wakes it up
  });
  const activate = () => toggleSound(def.id);
  card.addEventListener("click", e => { if (!e.target.closest("input")) activate(); });
  card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } });
});

function renderSoundCard(id) {
  const def = SOUND_DEFS.find(d => d.id === id);
  const card = $(`.sound-card[data-sound="${id}"]`);
  if (!def || !card) return;
  const on = S.activeSounds.includes(id);
  card.classList.toggle("on", on);
  card.setAttribute("aria-pressed", String(on));
  $(".sound-state", card).textContent = on ? "On" : "Off";
  $("input", card).value = S.soundVolumes[id] || 50;
}
function toggleSound(id) {
  const on = S.activeSounds.includes(id);
  if (on) { engine.stop(id); S.activeSounds = S.activeSounds.filter(x => x !== id); }
  else { engine.start(id, S.soundVolumes[id]); S.activeSounds.push(id); }
  save();
  renderSoundCard(id);
  renderNowPlaying();
}
function renderNowPlaying() {
  const names = S.activeSounds.map(id => SOUND_DEFS.find(d => d.id === id).name);
  const el = $("#nowPlaying"), dotWrap = $(".now-playing");
  if (S.muted) { el.textContent = "Muted — press M to bring the sound back"; dotWrap.classList.remove("live"); return; }
  if (!names.length) { el.textContent = "Ambience idle — press a sound to begin"; dotWrap.classList.remove("live"); return; }
  el.textContent = `Playing ${names.join(" + ")} · master ${S.masterVolume}%`;
  dotWrap.classList.add("live");
}

/* sound presets */
const presetRow = $("#soundPresets");
Object.entries(SOUND_PRESETS).forEach(([key, p]) => {
  const b = document.createElement("button");
  b.className = "chip";
  b.dataset.preset = key;
  b.textContent = p.label;
  b.addEventListener("click", () => applyPreset(key));
  presetRow.appendChild(b);
});
function applyPreset(key, silent) {
  const p = SOUND_PRESETS[key];
  if (!p) return;
  SOUND_DEFS.forEach(def => {
    if (def.id in p.mix) {
      S.soundVolumes[def.id] = p.mix[def.id];
      if (!S.activeSounds.includes(def.id)) { engine.start(def.id, p.mix[def.id]); S.activeSounds.push(def.id); }
      else engine.start(def.id, p.mix[def.id]);
    } else if (S.activeSounds.includes(def.id)) {
      engine.stop(def.id);
      S.activeSounds = S.activeSounds.filter(x => x !== def.id);
    }
  });
  save();
  SOUND_DEFS.forEach(def => renderSoundCard(def.id));
  renderNowPlaying();
  if (!silent) toast(p.label + " — sounds layered");
}

/* master volume */
const masterVol = $("#masterVol");
masterVol.value = S.masterVolume;
$("#masterVal").textContent = S.masterVolume + "%";
masterVol.addEventListener("input", () => {
  S.masterVolume = +masterVol.value;
  S.muted = S.masterVolume === 0 ? S.muted : false;
  $("#masterVal").textContent = masterVol.value + "%";
  save(); engine.applyMaster(); renderNowPlaying();
});

/* restore persisted ambience (starts on first gesture) */
S.activeSounds.forEach(renderSoundCard);
renderNowPlaying();
(function armAutostart() {
  if (!S.activeSounds.length || !S.masterVolume) return;
  const start = () => { engine.ensure(); S.activeSounds.forEach(id => engine.start(id, S.soundVolumes[id])); };
  window.addEventListener("pointerdown", start, { once: true });
  window.addEventListener("keydown", start, { once: true });
})();

/* ---------------- focus timer ---------------- */
const FOCUS_PRESETS = {
  pomodoro: { label: "Pomodoro · 25/5", work: 25, break: 5 },
  deep:     { label: "Deep Work · 50/10", work: 50, break: 10 },
  sprint:   { label: "Sprint · 15/3", work: 15, break: 3 },
  custom:   { label: "Custom", work: 25, break: 5 },
};
const focusRow = $("#focusPresets");
Object.entries(FOCUS_PRESETS).forEach(([key, p]) => {
  const b = document.createElement("button");
  b.className = "chip";
  b.dataset.preset = key;
  b.textContent = p.label;
  b.addEventListener("click", () => selectFocusPreset(key));
  focusRow.appendChild(b);
});
function currentWork() { return S.focusPreset === "custom" ? clamp(+$("#customWork").value || 25, 1, 90) : FOCUS_PRESETS[S.focusPreset].work; }
function currentBreak() { return S.focusPreset === "custom" ? clamp(+$("#customBreak").value || 5, 1, 30) : FOCUS_PRESETS[S.focusPreset].break; }

const RING_C = 2 * Math.PI * 118;
const ringFg = $("#ringFg");
ringFg.style.strokeDasharray = RING_C;
ringFg.style.strokeDashoffset = 0;

const timer = { phase: "work", total: FOCUS_PRESETS.pomodoro.work * 60, remaining: FOCUS_PRESETS.pomodoro.work * 60, running: false, endAt: 0 };
function selectFocusPreset(key) {
  S.focusPreset = key; save();
  $$('#focusPresets .chip').forEach(c => c.classList.toggle("active", c.dataset.preset === key));
  $("#customFocus").hidden = key !== "custom";
  resetTimer(true);
}
$$('#focusPresets .chip').forEach(c => c.classList.toggle("active", c.dataset.preset === S.focusPreset));
$("#customFocus").hidden = S.focusPreset !== "custom";
$("#customWork").addEventListener("input", () => { if (S.focusPreset === "custom") resetTimer(true); });
$("#customBreak").addEventListener("input", () => { if (S.focusPreset === "custom") resetTimer(true); });

function renderTimer() {
  $("#timeLeft").textContent = fmtClock(timer.remaining);
  const frac = timer.total ? clamp(1 - timer.remaining / timer.total, 0, 1) : 0;
  ringFg.style.strokeDashoffset = RING_C * frac; // 0 = full circle, C = empty
  ringFg.classList.toggle("break", timer.phase === "break");
  $("#timerPhase").textContent = timer.phase === "work" ? "Work" : "Break";
  $("#startPause").textContent = timer.running ? "Pause" : (timer.remaining < timer.total ? "Resume" : "Start");
  const today = T.sessions.filter(s => s.t >= new Date().setHours(0, 0, 0, 0)).reduce((a, s) => a + s.min, 0);
  $("#focusMeta").textContent = `${T.sessions.length} sessions total · ${fmtMin(today)} focused today`;
}
function tickTimer() {
  if (!timer.running) return;
  timer.remaining = Math.max(0, (timer.endAt - performance.now()) / 1000);
  renderTimer();
  if (timer.remaining <= 0) { completePhase(); return; }
  timer.raf = requestAnimationFrame(tickTimer);
}
function startPause() {
  if (timer.running) {
    timer.running = false;
    cancelAnimationFrame(timer.raf);
    releaseWakeLock();
  } else {
    timer.endAt = performance.now() + timer.remaining * 1000;
    timer.running = true;
    acquireWakeLock();
    tickTimer();
  }
  renderTimer();
}
function resetTimer(silent) {
  timer.running = false;
  cancelAnimationFrame(timer.raf);
  releaseWakeLock();
  timer.phase = "work";
  timer.total = currentWork() * 60;
  timer.remaining = timer.total;
  renderTimer();
  if (!silent) toast("Timer reset");
}
function completePhase() {
  timer.running = false;
  cancelAnimationFrame(timer.raf);
  releaseWakeLock();
  if (timer.phase === "work") {
    T.sessions.push({ t: Date.now(), min: currentWork() });
    if (T.sessions.length > 500) T.sessions = T.sessions.slice(-500);
    T.focusMin += currentWork();
    save();
    if (S.chime) chime(3);
    vibrate([200, 120, 200]);
    toast("Session complete — well done 🎉");
    maybeNotify("Focus session complete. Time to rest.");
    timer.phase = "break";
    timer.total = currentBreak() * 60;
    timer.remaining = timer.total;
    startPause(); // auto-start the break
  } else {
    if (S.chime) chime(1);
    toast("Break over — ready when you are");
    timer.phase = "work";
    timer.total = currentWork() * 60;
    timer.remaining = timer.total;
  }
  renderTimer();
}
$("#startPause").addEventListener("click", startPause);
$("#resetTimer").addEventListener("click", () => resetTimer(false));
$("#chimeToggle").checked = S.chime;
$("#chimeToggle").addEventListener("change", e => { S.chime = e.target.checked; save(); });
$("#notifyToggle").checked = S.notify;
$("#notifyToggle").addEventListener("change", e => {
  S.notify = e.target.checked; save();
  if (S.notify && window.Notification && Notification.requestPermission) {
    Notification.requestPermission().then(p => {
      if (p !== "granted") { $("#notifyToggle").checked = false; S.notify = false; save(); }
      else toast("Notifications on — we'll let you know when a session ends");
    }).catch(() => {});
  }
});

function chime(times) {
  const ctx = engine.ensure();
  if (!ctx) return;
  for (let i = 0; i < times; i++) {
    const t = ctx.currentTime + i * 0.5;
    engine.tone(1046.5, 0.22, 0.01, 1.8, t);
    engine.tone(1567.98, 0.08, 0.01, 1.2, t + 0.03);
  }
}
function vibrate(pattern) { if (navigator.vibrate) navigator.vibrate(pattern); }
function maybeNotify(body) {
  if (!S.notify || !window.Notification || Notification.permission !== "granted") return;
  try { new Notification("Serene", { body }); } catch (e) {}
}

/* wake lock */
let wakeLock = null;
function acquireWakeLock() {
  if (!navigator.wakeLock) return;
  navigator.wakeLock.request("screen").then(l => { wakeLock = l; }).catch(() => {});
}
function releaseWakeLock() {
  if (wakeLock && wakeLock.release) wakeLock.release().catch(() => {});
  wakeLock = null;
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && timer.running) acquireWakeLock();
});

renderTimer();

/* ---------------- breathing coach ---------------- */
const BREATH_PATTERNS = {
  box:      { label: "Box · 4-4-4-4", phases: [["Inhale", 4], ["Hold", 4], ["Exhale", 4], ["Hold", 4]] },
  "478":    { label: "4-7-8 Sleep",   phases: [["Inhale", 4], ["Hold", 7], ["Exhale", 8]] },
  coherent: { label: "Coherent · 5-5", phases: [["Inhale", 5], ["Exhale", 5]] },
};
const breathRow = $("#breathPresets");
Object.entries(BREATH_PATTERNS).forEach(([key, p]) => {
  const b = document.createElement("button");
  b.className = "chip";
  b.dataset.pattern = key;
  b.textContent = p.label;
  b.addEventListener("click", () => selectBreathPattern(key));
  breathRow.appendChild(b);
});
function selectBreathPattern(key) {
  S.breathPattern = key; save();
  $$('#breathPresets .chip').forEach(c => c.classList.toggle("active", c.dataset.pattern === key));
  stopBreathing(true);
}
$$('#breathPresets .chip').forEach(c => c.classList.toggle("active", c.dataset.pattern === S.breathPattern));

const orb = $("#orb");
const breath = { running: false, idx: 0, phaseEnd: 0, tickId: 0, sessionCycles: 0 };
function cueTick() {
  if (!$("#cueToggle").checked) return;
  const ctx = engine.ensure();
  if (ctx) engine.tone(660, 0.08, 0.01, 0.25);
}
function breathStep() {
  if (!breath.running) return;
  const pat = BREATH_PATTERNS[S.breathPattern];
  const [name, dur] = pat.phases[breath.idx];
  $("#phaseLabel").textContent = name;
  orb.style.transitionDuration = dur + "s";
  if (name === "Inhale") { orb.classList.remove("exhale"); orb.classList.add("inhale"); }
  else if (name === "Exhale") { orb.classList.remove("inhale"); orb.classList.add("exhale"); }
  cueTick();
  breath.phaseEnd = performance.now() + dur * 1000;
  clearInterval(breath.tickId);
  breath.tickId = setInterval(() => {
    const left = Math.max(0, (breath.phaseEnd - performance.now()) / 1000);
    $("#phaseCount").textContent = left > 0 ? String(Math.ceil(left)) : "";
  }, 150);
  setTimeout(() => {
    if (!breath.running) return;
    breath.idx = (breath.idx + 1) % pat.phases.length;
    if (breath.idx === 0) {
      breath.sessionCycles++;
      T.breathCycles++; save();
      renderBreathMeta();
    }
    breathStep();
  }, dur * 1000);
}
function startBreathing() {
  if (breath.running) return;
  breath.running = true;
  breath.idx = 0;
  $("#breathToggle").textContent = "Pause";
  engine.ensure();
  breathStep();
}
function stopBreathing(silent) {
  breath.running = false;
  clearInterval(breath.tickId);
  orb.classList.remove("inhale", "exhale");
  $("#phaseLabel").textContent = "Ready";
  $("#phaseCount").textContent = "";
  $("#breathToggle").textContent = "Begin";
  if (!silent) toast("Breathing ended — nice and steady");
}
function renderBreathMeta() {
  $("#breathMeta").textContent = `${breath.sessionCycles} cycles this session · ${T.breathCycles} total`;
}
$("#breathToggle").addEventListener("click", () => (breath.running ? stopBreathing(false) : startBreathing()));
$("#breathReset").addEventListener("click", () => { stopBreathing(true); breath.sessionCycles = 0; renderBreathMeta(); });
$("#cueToggle").checked = S.cues;
$("#cueToggle").addEventListener("change", e => { S.cues = e.target.checked; save(); });
renderBreathMeta();

/* ---------------- zen garden ---------------- */
const gCanvas = $("#gardenCanvas");
const gCtx = gCanvas.getContext ? gCanvas.getContext("2d") : null;
const ripples = [];
let lastRipple = { x: -99, y: -99 };
function sizeGarden() {
  const w = gCanvas.clientWidth || 600, h = gCanvas.clientHeight || 400;
  const d = window.devicePixelRatio || 1;
  if (gCanvas.width !== Math.round(w * d) || gCanvas.height !== Math.round(h * d)) {
    gCanvas.width = Math.round(w * d); gCanvas.height = Math.round(h * d);
  }
  if (gCtx) gCtx.setTransform(d, 0, 0, d, 0, 0);
}
function addRipple(x, y) {
  ripples.push({ x, y, born: performance.now(), life: 2600, max: 26 + Math.random() * 20 });
  if (ripples.length > 60) ripples.shift();
}
function drawGarden() {
  if (!gCtx) return;
  sizeGarden();
  const w = gCanvas.clientWidth, h = gCanvas.clientHeight;
  gCtx.clearRect(0, 0, w, h);
  const now = performance.now();
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    const p = (now - r.born) / r.life;
    if (p >= 1) { ripples.splice(i, 1); continue; }
    const rad = 6 + p * r.max;
    const a = Math.pow(1 - p, 2);
    // shadow ring (depth)
    gCtx.beginPath();
    gCtx.arc(r.x + 1.5, r.y + 2.5, rad, 0, Math.PI * 2);
    gCtx.strokeStyle = `rgba(70, 55, 35, ${a * 0.35})`;
    gCtx.lineWidth = 5;
    gCtx.stroke();
    // light ring
    gCtx.beginPath();
    gCtx.arc(r.x, r.y, rad, 0, Math.PI * 2);
    gCtx.strokeStyle = `rgba(255, 246, 220, ${a * 0.5})`;
    gCtx.lineWidth = 2;
    gCtx.stroke();
    // inner tooth echo
    if (rad > 14) {
      gCtx.beginPath();
      gCtx.arc(r.x, r.y, rad * 0.62, 0, Math.PI * 2);
      gCtx.strokeStyle = `rgba(255, 246, 220, ${a * 0.28})`;
      gCtx.lineWidth = 1.4;
      gCtx.stroke();
    }
  }
}
(function gardenLoop() {
  if (activeTab === "garden") drawGarden();
  requestAnimationFrame(gardenLoop);
})();
gCanvas.addEventListener("pointerdown", e => { const r = gCanvas.getBoundingClientRect(); addRipple(e.clientX - r.left, e.clientY - r.top); });
gCanvas.addEventListener("pointermove", e => {
  if (e.buttons !== 1) return;
  const r = gCanvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  if (Math.hypot(x - lastRipple.x, y - lastRipple.y) > 7) { lastRipple = { x, y }; addRipple(x, y); }
});
$("#gardenReset").addEventListener("click", () => { ripples.length = 0; toast("The garden is clean again"); });

/* ---------------- mood & stats ---------------- */
const moodPick = $("#moodPick");
$$('#moodPick button').forEach(b => {
  b.addEventListener("click", () => {
    T.moods[todayKey()] = b.dataset.mood;
    save(); renderMoodPick(); renderMoodStrip(); renderStats();
    toast(`Logged ${b.dataset.mood} — thank you for checking in`);
  });
});
function renderMoodPick() {
  const today = T.moods[todayKey()];
  $$('#moodPick button').forEach(b => b.classList.toggle("picked", b.dataset.mood === today));
}
function renderMoodStrip() {
  const strip = $("#moodStrip");
  strip.innerHTML = "";
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const cell = document.createElement("div");
    cell.className = "mood-cell" + (i === 0 ? " today" : "");
    cell.innerHTML = `<span>${T.moods[key] || "·"}</span><span class="day">${i === 0 ? "today" : d.toLocaleDateString(undefined, { weekday: "short" })}</span>`;
    strip.appendChild(cell);
  }
}
function renderStats() {
  const startToday = new Date().setHours(0, 0, 0, 0);
  const todayMin = T.sessions.filter(s => s.t >= startToday).reduce((a, s) => a + s.min, 0);
  $("#statFocusToday").textContent = String(todayMin);
  $("#statFocusTotal").textContent = fmtMin(T.focusMin);
  $("#statBreath").textContent = String(T.breathCycles);
  $("#statMoods").textContent = Object.keys(T.moods).length;
}
renderMoodPick(); renderMoodStrip(); renderStats();

/* ---------------- settings ---------------- */
$("#sleepSwitch").checked = S.sleepMode;
$("#idleSelect").value = String(S.idleSeconds);
$("#sleepSwitch").addEventListener("change", e => {
  S.sleepMode = e.target.checked; save(); syncSleepBtn();
  toast(S.sleepMode ? "Sleep mode on — the room will dim when you go idle" : "Sleep mode off");
});
$("#idleSelect").addEventListener("change", e => { S.idleSeconds = +e.target.value; save(); });
function syncSleepBtn() { $("#sleepBtn").setAttribute("aria-pressed", String(S.sleepMode)); }
syncSleepBtn();

/* ---------------- export / import / reset ---------------- */
function exportJSON() { return { v: 1, exportedAt: new Date().toISOString(), settings: S, stats: T }; }
$("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(exportJSON(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL ? URL.createObjectURL(blob) : "";
  const a = document.createElement("a");
  a.href = url; a.download = "serene-backup.json";
  document.body.appendChild(a); a.click(); a.remove();
  if (URL.revokeObjectURL) setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Backup exported");
});
$("#importBtn").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", e => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!data.settings || !data.stats) throw new Error("bad shape");
      localStorage.setItem(STORE_KEY, JSON.stringify({ settings: data.settings, stats: data.stats }));
      toast("Backup restored — reloading");
      setTimeout(() => location.reload(), 600);
    } catch (err) { toast("Import failed — not a Serene backup"); }
  };
  reader.readAsText(f);
});
let resetArmed = 0;
$("#resetBtn").addEventListener("click", () => {
  const btn = $("#resetBtn");
  if (!resetArmed) {
    resetArmed = Date.now();
    btn.textContent = "Sure? Click again";
    setTimeout(() => { btn.textContent = "Reset all"; resetArmed = 0; }, 3200);
  } else {
    localStorage.removeItem(STORE_KEY);
    location.reload();
  }
});

/* ---------------- sleep mode (idle dim) ---------------- */
let lastActive = Date.now(), sleeping = false;
function poke() {
  const wasSleeping = sleeping;
  lastActive = Date.now();
  if (wasSleeping && !S.sleepMode) return;
  if (wasSleeping) wake();
}
function sleep() {
  sleeping = true;
  document.body.classList.add("sleeping");
  $("#sleepIndicator").hidden = false;
  engine.setSleepScale(0.4);
}
function wake() {
  if (!sleeping) return;
  sleeping = false;
  document.body.classList.remove("sleeping");
  $("#sleepIndicator").hidden = true;
  engine.setSleepScale(1);
  toast("Welcome back — sounds restored");
}
["pointerdown", "keydown", "wheel"].forEach(ev => window.addEventListener(ev, poke, { passive: true }));
setInterval(() => {
  if (S.sleepMode && !sleeping && Date.now() - lastActive > S.idleSeconds * 1000) sleep();
}, 1000);
$("#sleepBtn").addEventListener("click", () => {
  S.sleepMode = !S.sleepMode; save();
  syncSleepBtn(); $("#sleepSwitch").checked = S.sleepMode;
  if (!S.sleepMode) wake(); else poke();
  toast(S.sleepMode ? "Sleep mode armed" : "Sleep mode off");
});

/* ---------------- keyboard shortcuts ---------------- */
window.addEventListener("keydown", e => {
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea" || e.key === "F2") return;
  if (e.key === "?") { $("#helpModal").hidden = false; return; }
  const k = e.key.toLowerCase();
  if ((e.key === "Escape" && !$("#helpModal").hidden)) { $("#helpModal").hidden = true; return; }
  if (k === "h") setTab("home");
  else if (k === "s") setTab("sounds");
  else if (k === "t") setTab("focus");
  else if (k === "b") setTab("breathe");
  else if (k === "g") setTab("garden");
  else if (k === "j") setTab("stats");
  else if (k === "f") toggleFullscreen();
  else if (k === "m") { S.muted = !S.muted; save(); engine.applyMaster(); renderNowPlaying(); toast(S.muted ? "Muted" : "Sound on"); }
  else if (/^[1-8]$/.test(e.key)) { const def = SOUND_DEFS[+e.key - 1]; if (def) toggleSound(def.id); }
  else if (e.key === " " && activeTab === "focus") { e.preventDefault(); startPause(); }
});
$("#helpClose").addEventListener("click", () => $("#helpModal").hidden = true);
$("#helpModal").addEventListener("click", e => { if (e.target.id === "helpModal") $("#helpModal").hidden = true; });

/* ---------------- fullscreen & PWA ---------------- */
function toggleFullscreen() {
  if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen(); return; }
  if (document.documentElement.requestFullscreen) {
    const p = document.documentElement.requestFullscreen();
    if (p && p.catch) p.catch(() => {});
  }
}
$("#fsBtn").addEventListener("click", toggleFullscreen);
let installEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; $("#installBtn").hidden = false; });
$("#installBtn").addEventListener("click", () => {
  if (!installEvt) return;
  installEvt.prompt();
  installEvt.userChoice.then(() => { $("#installBtn").hidden = true; installEvt = null; }).catch(() => {});
});
if (window.matchMedia && matchMedia("(display: standalone)").matches) $("#installBtn").hidden = true;

/* ---------------- service worker (offline) ---------------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

/* ---------------- fireflies ---------------- */
const ffCanvas = $("#fireflies");
const ffCtx = ffCanvas.getContext ? ffCanvas.getContext("2d") : null;
const flies = Array.from({ length: 34 }, () => ({
  x: Math.random(), y: Math.random(), r: 1 + Math.random() * 1.8,
  sp: 0.0004 + Math.random() * 0.0012, ph: Math.random() * Math.PI * 2,
  drift: 0.3 + Math.random() * 0.7,
}));
let ffPar = { x: 0, y: 0 };
window.addEventListener("pointermove", e => {
  ffPar.x = (e.clientX / innerWidth - 0.5) * 26;
  ffPar.y = (e.clientY / innerHeight - 0.5) * 18;
}, { passive: true });
function drawFlies(t) {
  if (!ffCtx) return;
  const d = window.devicePixelRatio || 1;
  const w = innerWidth, h = innerHeight;
  if (ffCanvas.width !== Math.round(w * d)) { ffCanvas.width = Math.round(w * d); ffCanvas.height = Math.round(h * d); }
  ffCtx.setTransform(d, 0, 0, d, 0, 0);
  ffCtx.clearRect(0, 0, w, h);
  for (const f of flies) {
    if (!reducedMotion) {
      f.y -= f.sp * f.drift;
      f.x += Math.sin(t / 2400 + f.ph) * 0.00035;
      if (f.y < -0.05) { f.y = 1.05; f.x = Math.random(); }
    }
    const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t / 900 + f.ph));
    const x = f.x * w - ffPar.x, y = f.y * h - ffPar.y;
    const g = ffCtx.createRadialGradient(x, y, 0, x, y, f.r * 5);
    g.addColorStop(0, `rgba(255, 248, 214, ${a})`);
    g.addColorStop(1, "rgba(255, 248, 214, 0)");
    ffCtx.fillStyle = g;
    ffCtx.beginPath();
    ffCtx.arc(x, y, f.r * 5, 0, Math.PI * 2);
    ffCtx.fill();
  }
}
(function flyLoop(t) { drawFlies(t || 0); requestAnimationFrame(flyLoop); })();

/* ---------------- tilt cards ---------------- */
if (!reducedMotion && matchMedia) {
  $$('.tilt').forEach(card => {
    card.addEventListener("mousemove", e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `translateY(-3px) rotateX(${-py * 5}deg) rotateY(${px * 5}deg)`;
    });
    card.addEventListener("mouseleave", () => { card.style.transform = ""; });
  });
}

/* ---------------- init ---------------- */
greet();
applyTheme(S.theme);
renderNowPlaying();

/* expose a small API for tests / console play */
window.sereneApp = {
  settings: S, stats: T, timer,
  engine, toggleSound, applyPreset, setTab,
  startPause, resetTimer, selectFocusPreset,
  startBreathing, stopBreathing, selectBreathPattern,
  addRipple, garden: { reset() { ripples.length = 0; } },
  exportJSON, toast,
};
})();
