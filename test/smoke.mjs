/* Serene smoke test — loads the real page in jsdom and exercises every feature. */
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = path.join(root, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");

const virtualConsole = new VirtualConsole();
const consoleErrors = [];
virtualConsole.on("error", (...a) => consoleErrors.push(a.join(" ")));

let dom;
try {
  dom = new JSDOM(html, {
    url: pathToFileURL(htmlPath).href,
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      // --- canvas 2D stub (fireflies + zen garden) ---
      const makeCtx = () => {
        const grad = { addColorStop() {} };
        return {
          clearRect() {}, fillRect() {}, strokeRect() {},
          beginPath() {}, closePath() {}, arc() {}, fill() {}, stroke() {},
          moveTo() {}, lineTo() {}, quadraticCurveTo() {}, bezierCurveTo() {},
          save() {}, restore() {}, setTransform() {},
          createRadialGradient: () => grad, createLinearGradient: () => grad,
          measureText: () => ({ width: 0 }),
          globalAlpha: 1, lineWidth: 1, strokeStyle: "", fillStyle: "",
        };
      };
      window.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };

      // --- Web Audio stub (sound engine) ---
      class Param { constructor(v = 0) { this.value = v; } setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} setTargetAtTime() {} }
      class Anode { constructor() { this.connect = () => {}; this.disconnect = () => {}; this.start = () => {}; this.stop = () => {}; this.type = ""; this.loop = false; this.buffer = null; } }
      window.AudioContext = class {
        constructor() { this.sampleRate = 44100; this.currentTime = 0; this.state = "running"; this.destination = {}; }
        createGain() { const n = new Anode(); n.gain = new Param(1); return n; }
        createOscillator() { const n = new Anode(); n.frequency = new Param(440); return n; }
        createBiquadFilter() { const n = new Anode(); n.frequency = new Param(600); n.Q = new Param(1); return n; }
        createBuffer(ch, len) { const b = { numberOfChannels: ch, length: len, sampleRate: 44100 }; b.getChannelData = () => new Float32Array(len); return b; }
        createBufferSource() { const n = new Anode(); return n; }
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
const errors = [];
w.addEventListener("error", (ev) => errors.push(String(ev.message || ev.error)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
function ok(cond, label, extra = "") {
  if (cond) { pass++; console.log("PASS  " + label); }
  else { fail++; console.log("FAIL  " + label + (extra ? "  -> " + extra : "")); }
}

await new Promise((resolve) => w.addEventListener("load", resolve));
await sleep(120);

ok(typeof w.sereneApp === "object" && !!w.sereneApp, "app boots and exposes sereneApp");
ok(d.querySelector("#pane-home").classList.contains("active"), "home pane active by default");
ok(d.getElementById("greeting").textContent.length > 3, "time-of-day greeting rendered");
ok(d.getElementById("quote").textContent.length > 5, "daily quote rendered");

// --- tab navigation ---
const soundsTab = d.querySelector('[data-tab="sounds"]');
soundsTab.click();
await sleep(30);
ok(d.querySelector("#pane-sounds").classList.contains("active"), "tab switch to Sounds works");
ok(d.getElementById("soundGrid").querySelectorAll(".sound-card").length === 8, "all 8 sound cards rendered");

// --- ambience engine (via UI) ---
const rainCard = d.querySelector('[data-sound="rain"]');
rainCard.click();
await sleep(40);
ok(rainCard.getAttribute("aria-pressed") === "true", "clicking Rain turns it on");
ok(d.getElementById("nowPlaying").textContent.includes("Rain"), "now-playing reflects active sound");
const presetBtn = d.querySelector('[data-preset="rainynight"]');
presetBtn.click();
await sleep(40);
const fireCard = d.querySelector('[data-sound="fire"]');
ok(fireCard.getAttribute("aria-pressed") === "true", "Rainy Night preset enables Rain + Fireplace");
d.querySelector("[data-preset=\"oceandrift\"]").click();
await sleep(20);
ok(d.querySelector('#soundGrid [data-sound="ocean"]').getAttribute("aria-pressed") === "true" && fireCard.getAttribute("aria-pressed") === "false", "preset switch swaps ambience");

// master volume
const master = d.getElementById("masterVol");
master.value = "40";
master.dispatchEvent(new w.Event("input", { bubbles: true }));
ok(d.getElementById("masterVal").textContent === "40%", "master volume slider updates readout");

// --- focus timer ---
const app = w.sereneApp;
app.selectFocusPreset("sprint");
await sleep(20);
ok(d.getElementById("timeLeft").textContent === "15:00", "Sprint preset loads 15:00");
app.startPause();
await sleep(1200);
const mid = d.getElementById("timeLeft").textContent;
ok(mid !== "15:00" && mid.length === 5, "timer counts down while running (" + mid + ")");
app.startPause(); // pause
ok(d.getElementById("startPause").textContent === "Resume", "pause shows Resume");

// full work+break cycle with 1-minute custom preset
d.getElementById("customWork").value = "1";
d.getElementById("customBreak").value = "1";
app.selectFocusPreset("custom");
await sleep(20);
const sessionsBefore = app.stats.sessions.length;
app.startPause(); // start work; auto-starts the break when work finishes
app.timer.endAt = w.performance.now() + 500; // fast-forward: finish the 1-min work phase in ~0.5s
await sleep(1400);
ok(app.stats.sessions.length === sessionsBefore + 1, "completed work session recorded in stats");
ok(d.getElementById("focusMeta").textContent.includes("1 min"), "focus meta line updated after session");
app.timer.endAt = w.performance.now() + 500; // fast-forward the auto-started break too
await sleep(1400); // break completes -> back to work, paused
ok(d.getElementById("timerPhase").textContent === "Work" && d.getElementById("timeLeft").textContent === "01:00", "break auto-completes and returns to a fresh 1:00 work block");
app.resetTimer();
ok(d.getElementById("timeLeft").textContent === "01:00", "reset restores full work duration");

// --- breathing coach ---
app.startBreathing();
await sleep(400);
ok(d.getElementById("phaseLabel").textContent === "Inhale" || d.getElementById("phaseLabel").textContent === "Hold", "breathing cycle started (phase label live: " + d.getElementById("phaseLabel").textContent + ")");
const cyclesBefore = app.stats.breathCycles;
app.selectBreathPattern("coherent");
app.startBreathing(); // selectBreathPattern stops it — restart so the coherent cycle actually ticks
await sleep(12000); // 5+5 pattern -> at least one full cycle completes within 12s
ok(app.stats.breathCycles > cyclesBefore, "completed breath cycle counted in stats (" + app.stats.breathCycles + ")");
app.stopBreathing();
ok(d.getElementById("phaseLabel").textContent === "Ready", "breathing stop resets the orb");

// --- zen garden ---
app.addRipple(120, 80);
w.dispatchEvent(new w.Event("resize"));
await sleep(30);
let gardenOk = true;
try { app.garden.reset(); } catch (e) { gardenOk = false; }
ok(gardenOk, "zen garden ripples + reset run without errors");

// --- mood check-in + stats ---
// jsdom's nwsapi can't match the non-BMP emoji in an attribute value, so scan by dataset
const calmBtn = [...d.querySelectorAll("#moodPick [data-mood]")].find(b => b.dataset.mood === "😌");
calmBtn.click();
await sleep(20);
ok(d.getElementById("statMoods").textContent === "1", "mood check-in logged (stats show 1)");
ok(d.getElementById("moodStrip").textContent.includes("😌"), "7-day mood strip shows today's mood");

// --- themes ---
const oceanSwatch = d.querySelector('[data-theme="ocean"]');
oceanSwatch.click();
await sleep(20);
ok(d.documentElement.dataset.theme === "ocean", "theme switch to Ocean applies");
ok(oceanSwatch.classList.contains("active"), "active swatch highlighted");

// --- settings: sleep mode + idle select ---
const sleepSwitch = d.getElementById("sleepSwitch");
sleepSwitch.checked = false;
sleepSwitch.dispatchEvent(new w.Event("change", { bubbles: true }));
ok(!w.sereneApp.settings.sleepMode, "sleep mode toggle persists to settings");
d.getElementById("idleSelect").value = "60";
d.getElementById("idleSelect").dispatchEvent(new w.Event("change", { bubbles: true }));
ok(w.sereneApp.settings.idleSeconds === 60, "idle timeout setting persisted");

// --- keyboard shortcuts ---
w.dispatchEvent(new w.KeyboardEvent("keydown", { key: "g", bubbles: true }));
await sleep(20);
ok(d.querySelector("#pane-garden").classList.contains("active"), "pressing 'g' opens the garden");
w.dispatchEvent(new w.KeyboardEvent("keydown", { key: "h", bubbles: true }));
await sleep(20);
ok(d.querySelector("#pane-home").classList.contains("active"), "pressing 'h' returns home");

// --- JSON export ---
const exported = app.exportJSON();
ok(exported && exported.v === 1 && !!exported.settings && !!exported.stats, "JSON export returns a settings + stats payload");

// --- summary + exit code ---
console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail ? 1 : 0);
