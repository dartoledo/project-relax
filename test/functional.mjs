/* Serene — functional test suite: 20 numbered tests against the live page in jsdom.
   Run: node test/functional.mjs   (or: npm run test:functional) */
import { JSDOM, VirtualConsole, ResourceLoader } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = path.join(root, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");

const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", () => {}); // swallow not-implemented noise (e.g. location.reload)

/* Load relative assets (app.js, styles.css, img/) from disk under a real http origin,
   so window.localStorage behaves like it does in the browser (file:// URLs are an opaque
   origin and jsdom throws SecurityError on localStorage access). */
class DiskResourceLoader extends ResourceLoader {
  fetch(url, options) {
    const u = new URL(url);
    if (u.origin === "http://localhost") {
      try { return Promise.resolve(fs.readFileSync(path.join(root, u.pathname))); }
      catch (e) { return Promise.resolve(Buffer.from("")); }
    }
    return super.fetch(url, options);
  }
}

let dom;
try {
  dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "dangerously",
    resources: new DiskResourceLoader(),
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      // --- canvas 2D stub (fireflies + zen garden) ---
      window.HTMLCanvasElement.prototype.getContext = function () {
        const grad = { addColorStop() {} };
        return {
          clearRect() {}, fillRect() {}, strokeRect() {},
          beginPath() {}, closePath() {}, arc() {}, fill() {}, stroke() {},
          moveTo() {}, lineTo() {}, save() {}, restore() {}, setTransform() {},
          createRadialGradient: () => grad, createLinearGradient: () => grad,
          measureText: () => ({ width: 0 }),
          globalAlpha: 1, lineWidth: 1, strokeStyle: "", fillStyle: "",
        };
      };
      // --- Web Audio stub (sound engine) ---
      class Param { constructor(v = 0) { this.value = v; } setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} setTargetAtTime() {} }
      class Anode { constructor() { this.connect = () => {}; this.disconnect = () => {}; this.start = () => {}; this.stop = () => {}; this.type = ""; this.loop = false; this.buffer = null; } }
      window.AudioContext = class {
        constructor() { this.sampleRate = 44100; this.currentTime = 0; this.state = "running"; this.destination = {}; }
        createGain() { const n = new Anode(); n.gain = new Param(1); return n; }
        createOscillator() { const n = new Anode(); n.frequency = new Param(440); return n; }
        createBiquadFilter() { const n = new Anode(); n.frequency = new Param(600); n.Q = new Param(1); return n; }
        createBuffer(ch, len) { const b = { numberOfChannels: ch, length: len, sampleRate: 44100 }; b.getChannelData = () => new Float32Array(len); return b; }
        createBufferSource() { return new Anode(); }
        createStereoPanner() { const n = new Anode(); n.pan = new Param(0); return n; }
        resume() { return Promise.resolve(); }
      };
      window.webkitAudioContext = window.AudioContext;
      // --- misc browser API stubs ---
      if (!window.matchMedia) window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
      window.scrollTo = () => {};
      window.HTMLAnchorElement.prototype.scrollIntoView = function () {};
      window.Notification = class { constructor() {} static get permission() { return "granted"; } static requestPermission() { return Promise.resolve("granted"); } };
    },
  });
} catch (e) {
  console.error("JSDOM construction failed:", e);
  process.exit(1);
}

const w = dom.window;
const d = w.document;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key  = (k) => w.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true }));
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));

await new Promise((resolve) => w.addEventListener("load", resolve));
await sleep(150);

/* ---------------- tiny harness ---------------- */
let pass = 0, fail = 0;
const failures = [];
async function test(n, name, fn) {
  try { await fn(); pass++; console.log(`PASS ${String(n).padStart(2, "0")}  ${name}`); }
  catch (e) { fail++; failures.push(`${String(n).padStart(2, "0")} ${name}: ${e.message}`); console.log(`FAIL ${String(n).padStart(2, "0")}  ${name}\n     -> ${e.message}`); }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg || "assertion failed"); };
const app = () => w.sereneApp;

/* 01 — boot */
await test(1, "app boots: sereneApp API exposed, home pane active", async () => {
  assert(w.sereneApp && typeof w.sereneApp === "object", "window.sereneApp missing");
  assert(d.querySelector("#pane-home").classList.contains("active"), "home pane not active by default");
  assert(!d.querySelector("#pane-sounds").classList.contains("active"), "sounds pane should be inactive at boot");
});

/* 02 — greeting + quote */
await test(2, "time-of-day greeting and daily quote render", async () => {
  const g = d.getElementById("greeting").textContent;
  assert(["Good morning", "Good afternoon", "Good evening", "The night is quiet"].includes(g), `unexpected greeting "${g}"`);
  assert(d.getElementById("quote").textContent.length > 10, "quote missing");
  assert(/^— /.test(d.getElementById("quoteAuthor").textContent), "quote author missing the em-dash prefix");
});

/* 03 — tab navigation */
await test(3, "tab navigation switches panes and ARIA state", async () => {
  d.querySelector('[data-tab="stats"]').click();
  await sleep(20);
  assert(d.querySelector("#pane-stats").classList.contains("active"), "stats pane not active");
  assert(!d.querySelector("#pane-home").classList.contains("active"), "home pane still active");
  assert(d.querySelector('[data-tab="stats"]').getAttribute("aria-selected") === "true", "stats tab aria-selected not set");
  assert(d.querySelector('[data-tab="home"]').getAttribute("aria-selected") === "false", "home tab aria-selected not cleared");
});

/* 04 — quick cards */
await test(4, "quick card navigates and pre-applies the Rainy Night preset", async () => {
  d.querySelector('.quick-card[data-goto="sounds"]').click();
  await sleep(30);
  assert(d.querySelector("#pane-sounds").classList.contains("active"), "quick card did not open Sounds");
  assert(d.querySelector('[data-sound="rain"]').getAttribute("aria-pressed") === "true", "Rainy Night preset not applied by quick card");
});

/* 05 — sound toggle */
await test(5, "sound cards toggle ambience on/off; now-playing tracks the mix", async () => {
  const rain = d.querySelector('[data-sound="rain"]'); // left ON by Rainy Night in test 4
  rain.click(); await sleep(20);
  assert(rain.getAttribute("aria-pressed") === "false", "Rain did not turn off");
  const np = d.getElementById("nowPlaying").textContent;
  assert(!np.includes("Rain") && np.includes("Fireplace"), "now-playing should list only Fireplace now: " + np);
  rain.click(); await sleep(20);
  assert(rain.getAttribute("aria-pressed") === "true", "Rain did not turn back on");
  assert(app().settings.activeSounds.length >= 2, "expected two active sounds after re-enabling Rain");
});

/* 06 — presets */
await test(6, "presets layer multiple sounds and swap cleanly", async () => {
  d.querySelector('[data-preset="oceandrift"]').click(); await sleep(20);
  const S = app().settings;
  assert(S.activeSounds.includes("ocean") && S.activeSounds.includes("chimes"), "Ocean Drift mix incomplete: " + S.activeSounds.join(", "));
  assert(!S.activeSounds.includes("rain") && !S.activeSounds.includes("fire"), "sounds from the previous preset were not removed");
  assert(S.soundVolumes.ocean === 90 && S.soundVolumes.chimes === 35, "preset volumes not applied");
});

/* 07 — master volume */
await test(7, "master volume slider updates the readout and persists", async () => {
  const m = d.getElementById("masterVol");
  m.value = "40"; fire(m, "input"); await sleep(20);
  assert(d.getElementById("masterVal").textContent === "40%", "readout not updated");
  assert(app().settings.masterVolume === 40, "setting not persisted");
});

/* 08 — mute */
await test(8, "'M' mutes and un-mutes with now-playing feedback", async () => {
  key("m"); await sleep(20);
  assert(app().settings.muted === true, "not muted after 'M'");
  assert(d.getElementById("nowPlaying").textContent.startsWith("Muted"), "now-playing missing the muted message");
  key("m"); await sleep(20);
  assert(app().settings.muted === false, "still muted after second press");
});

/* 09 — focus presets */
await test(9, "focus presets set durations; custom values are clamped to 1–90 min", async () => {
  app().selectFocusPreset("sprint"); await sleep(20);
  assert(d.getElementById("timeLeft").textContent === "15:00", `Sprint should load 15:00, got ${d.getElementById("timeLeft").textContent}`);
  d.getElementById("customWork").value = "15";
  app().selectFocusPreset("custom"); await sleep(20);
  assert(!d.getElementById("customFocus").hidden, "custom inputs not revealed for the custom preset");
  assert(d.getElementById("timeLeft").textContent === "15:00", "custom work minutes ignored");
  d.getElementById("customWork").value = "95"; fire(d.getElementById("customWork"), "input"); await sleep(20);
  assert(d.getElementById("timeLeft").textContent === "90:00", `custom value not clamped to 90 (got ${d.getElementById("timeLeft").textContent})`);
});

/* 10 — start / pause / resume */
await test(10, "timer start / pause / resume cycle", async () => {
  app().selectFocusPreset("sprint"); await sleep(20);
  const btn = d.getElementById("startPause");
  app().startPause(); await sleep(1300); // > 1 s so fmtClock's ceil() crosses a second boundary
  assert(btn.textContent === "Pause", "button should read Pause while running, got " + btn.textContent);
  const mid = d.getElementById("timeLeft").textContent;
  assert(mid !== "15:00" && /^\d\d:\d\d$/.test(mid), "timer not counting down (still " + mid + ")");
  app().startPause(); await sleep(20);
  assert(btn.textContent === "Resume", "button should read Resume when paused, got " + btn.textContent);
});

/* 11 — full work -> break cycle */
await test(11, "work phase logs a session, auto-starts the break; break ends back at Work", async () => {
  d.getElementById("customWork").value = "1";
  d.getElementById("customBreak").value = "1";
  app().selectFocusPreset("custom"); await sleep(20);
  const before = app().stats.sessions.length, minBefore = app().stats.focusMin;
  app().startPause();
  app().timer.endAt = w.performance.now() + 400; // fast-forward the 1-min work phase
  await sleep(800);
  assert(app().stats.sessions.length === before + 1, "session not recorded in stats");
  assert(app().stats.focusMin === minBefore + 1, "focus minutes not updated");
  assert(d.getElementById("timerPhase").textContent === "Break", "phase should be Break after work completes");
  assert(app().timer.running === true, "break did not auto-start");
  app().timer.endAt = w.performance.now() + 400; // fast-forward the break too
  await sleep(800);
  assert(d.getElementById("timerPhase").textContent === "Work", "should be back on Work after the break");
  assert(d.getElementById("timeLeft").textContent === "01:00", "work block not reset to full duration");
  assert(app().timer.running === false, "work block should start paused");
});

/* 12 — reset */
await test(12, "Reset restores the full work duration", async () => {
  app().selectFocusPreset("sprint"); await sleep(20);
  app().startPause(); await sleep(1300); // > 1 s so fmtClock's ceil() crosses a second boundary
  assert(d.getElementById("timeLeft").textContent !== "15:00", "expected a running timer before reset");
  d.getElementById("resetTimer").click(); await sleep(20);
  assert(d.getElementById("timeLeft").textContent === "15:00", "reset did not restore 15:00");
  assert(d.getElementById("startPause").textContent === "Start", "button should read Start after reset");
});

/* 13 — breathing coach */
await test(13, "breathing coach advances phases and counts completed cycles", async () => {
  app().selectBreathPattern("coherent"); // 5-5: fastest full cycle (10 s)
  await sleep(20);
  const before = app().stats.breathCycles;
  app().startBreathing();
  await sleep(400);
  assert(["Inhale", "Exhale"].includes(d.getElementById("phaseLabel").textContent), "phase label not live: " + d.getElementById("phaseLabel").textContent);
  await sleep(10600); // one full 5+5 cycle completes inside this window
  app().stopBreathing();
  assert(app().stats.breathCycles > before, "cycle not counted (still " + app().stats.breathCycles + ")");
  assert(d.getElementById("phaseLabel").textContent === "Ready", "orb not reset after stop");
});

/* 14 — zen garden */
await test(14, "zen garden accepts ripples and rake-clean resets it", async () => {
  const c = d.getElementById("gardenCanvas");
  let err = null;
  try {
    app().addRipple(120, 80);
    c.dispatchEvent(new w.PointerEvent("pointerdown", { clientX: 50, clientY: 40, bubbles: true }));
    c.dispatchEvent(new w.PointerEvent("pointermove", { clientX: 64, clientY: 47, buttons: 1, bubbles: true }));
  } catch (e) { err = e; }
  assert(!err, "ripple interaction threw: " + err);
  d.getElementById("gardenReset").click(); await sleep(20);
  const toasts = d.querySelectorAll("#toasts .toast");
  assert(toasts[toasts.length - 1].textContent === "The garden is clean again", "rake-clean toast missing");
});

/* 15 — mood check-in */
await test(15, "mood check-in logs to stats and the 7-day strip", async () => {
  const calm = [...d.querySelectorAll("#moodPick [data-mood]")].find(b => b.dataset.mood === "😌"); // jsdom can't match non-BMP emoji in CSS
  assert(calm, "calm mood button not found");
  calm.click(); await sleep(20);
  assert(d.getElementById("statMoods").textContent === "1", "mood not counted in stats (" + d.getElementById("statMoods").textContent + ")");
  assert(d.getElementById("moodStrip").textContent.includes("😌"), "today's mood missing from the strip");
  assert(calm.classList.contains("picked"), "picked mood not highlighted");
});

/* 16 — themes (scope selectors to .swatch: after applyTheme, <html> itself carries data-theme) */
await test(16, "theme swatches apply color, meta tag and active state", async () => {
  assert(d.querySelector('.swatch[data-theme="dusk"]').classList.contains("active"), "dusk swatch should be active at start");
  d.querySelector('.swatch[data-theme="forest"]').click(); await sleep(20);
  assert(d.documentElement.dataset.theme === "forest", "data-theme not set on <html>");
  assert(d.querySelector('meta[name="theme-color"]').getAttribute("content") === "#14231c", "meta theme-color not updated");
  assert(d.querySelector('.swatch[data-theme="forest"]').classList.contains("active"), "forest swatch not active");
  assert(!d.querySelector('.swatch[data-theme="dusk"]').classList.contains("active"), "previous swatch still active");
  assert(app().settings.theme === "forest", "theme not persisted to settings");
});

/* 17 — scenes */
await test(17, "scene picker highlights the card and toggles the photo layer", async () => {
  app().selectScene("oceanDusk"); await sleep(20);
  const card = d.querySelector('.scene-card[data-scene="oceanDusk"]');
  assert(card.classList.contains("active") && card.getAttribute("aria-pressed") === "true", "Ocean Dusk card not highlighted");
  assert(d.body.classList.contains("scene-photo"), "photo layer not enabled for a photo scene");
  app().selectScene("aurora"); await sleep(20);
  assert(!d.body.classList.contains("scene-photo"), "Aurora should hide the photo layer");
  app().selectScene("does-not-exist"); await sleep(20);
  assert(app().settings.scene === "mistyPines", `unknown scene should fall back to Misty Pines, got ${app().settings.scene}`);
});

/* 18 — sleep mode settings */
await test(18, "sleep-mode settings persist (switch, idle timeout, topbar button)", async () => {
  const sw = d.getElementById("sleepSwitch");
  sw.checked = false; fire(sw, "change"); await sleep(20);
  assert(app().settings.sleepMode === false, "sleep switch not persisted off");
  const sel = d.getElementById("idleSelect");
  sel.value = "60"; fire(sel, "change"); await sleep(20);
  assert(app().settings.idleSeconds === 60, "idle timeout not persisted");
  d.getElementById("sleepBtn").click(); await sleep(20); // re-arm via the topbar button
  assert(app().settings.sleepMode === true, "topbar button did not re-arm sleep mode");
  assert(d.getElementById("sleepSwitch").checked === true, "switch out of sync with the topbar button");
  assert(d.getElementById("sleepBtn").getAttribute("aria-pressed") === "true", "aria-pressed out of sync");
});

/* 19 — keyboard shortcuts */
await test(19, "keyboard shortcuts switch tabs and open/close the help panel", async () => {
  key("g"); await sleep(20);
  assert(d.querySelector("#pane-garden").classList.contains("active"), "'g' did not open the garden");
  key("h"); await sleep(20);
  assert(d.querySelector("#pane-home").classList.contains("active"), "'h' did not return home");
  key("?"); await sleep(20);
  assert(d.getElementById("helpModal").hidden === false, "help modal did not open with '?'");
  key("Escape"); await sleep(20);
  assert(d.getElementById("helpModal").hidden === true, "Escape did not close the help modal");
});

/* 20 — export / import round-trip */
await test(20, "JSON backup exports and imports (round-trip through the UI)", async () => {
  const payload = app().exportJSON();
  assert(payload.v === 1 && !!payload.settings && !!payload.stats && !isNaN(Date.parse(payload.exportedAt)), "export payload malformed");

  d.getElementById("exportBtn").click(); await sleep(20);
  let toasts = d.querySelectorAll("#toasts .toast");
  assert(toasts[toasts.length - 1].textContent === "Backup exported", "export toast missing");

  // feed the same payload back through the import UI
  const input = d.getElementById("importFile");
  Object.defineProperty(input, "files", {
    value: [new w.File([JSON.stringify(payload)], "serene-backup.json", { type: "application/json" })],
    configurable: true,
  });
  fire(input, "change");
  await sleep(800); // FileReader + the app's 600 ms reload delay
  const stored = JSON.parse(w.localStorage.getItem("serene.v1"));
  assert(stored && stored.settings.theme === payload.settings.theme, "import did not restore settings into localStorage");
  toasts = d.querySelectorAll("#toasts .toast");
  assert(toasts[toasts.length - 1].textContent === "Backup restored — reloading", "import toast missing");
});

/* ---------------- summary ---------------- */
console.log(`\n${pass} passed · ${fail} failed (of 20)`);
if (fail) console.log("Failures:\n" + failures.map(f => "  " + f).join("\n"));
process.exit(fail ? 1 : 0);
