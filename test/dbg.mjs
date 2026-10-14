import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const htmlPath = path.join(process.cwd(), "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => console.log("JSDOM ERROR:", e.message));

const dom = new JSDOM(html, {
  url: pathToFileURL(htmlPath).href,
  runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(window) {
    const makeCtx = () => ({ clearRect(){}, fillRect(){}, strokeRect(){}, beginPath(){}, closePath(){}, arc(){}, fill(){}, stroke(){}, moveTo(){}, lineTo(){}, quadraticCurveTo(){}, bezierCurveTo(){}, save(){}, restore(){}, setTransform(){}, createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }), measureText: () => ({ width: 0 }), globalAlpha: 1, lineWidth: 1, strokeStyle: "", fillStyle: "" });
    window.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
    class Param { constructor(v=0){ this.value=v; } setValueAtTime(){} linearRampToValueAtTime(){} exponentialRampToValueAtTime(){} setTargetAtTime(){} }
    class Anode { constructor(){ this.connect=()=>{}; this.disconnect=()=>{}; this.start=()=>{}; this.stop=()=>{}; this.type=""; this.loop=false; this.buffer=null; } }
    window.AudioContext = class { constructor(){ this.sampleRate=44100; this.currentTime=0; this.state="running"; this.destination={}; } createGain(){ const n=new Anode(); n.gain=new Param(1); return n; } createOscillator(){ const n=new Anode(); n.frequency=new Param(440); return n; } createBiquadFilter(){ const n=new Anode(); n.frequency=new Param(600); n.Q=new Param(1); return n; } createBuffer(ch,len){ const b={numberOfChannels:ch,length:len,sampleRate:44100}; b.getChannelData=()=>new Float32Array(len); return b; } createBufferSource(){ return new Anode(); } createStereoPanner(){ const n=new Anode(); n.pan=new Param(0); return n; } resume(){ return Promise.resolve(); } };
    window.webkitAudioContext = window.AudioContext;
    if (!window.matchMedia) window.matchMedia = (q) => ({ matches:false, media:q, addEventListener(){}, removeEventListener(){} });
    window.scrollTo = () => {};
    window.HTMLAnchorElement.prototype.scrollIntoView = function () {};
    window.Notification = class { constructor(){} static get permission(){ return "granted"; } static requestPermission(){ return Promise.resolve("granted"); } };
  },
});

const w = dom.window, d = w.document;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
await new Promise(r => w.addEventListener("load", r));
await sleep(150);

const mp = d.getElementById("moodPick");
console.log("moodPick exists:", !!mp, "children:", mp ? mp.children.length : "-");
if (mp) for (const c of mp.children) console.log("  btn data-mood:", JSON.stringify(c.dataset.mood), [ ...c.dataset.mood || "" ].map(ch => "U+" + ch.codePointAt(0).toString(16).toUpperCase()).join(" "));
console.log('selector test:', d.querySelector('#moodPick [data-mood="😌"]') ? "FOUND" : "NULL");
const all = [...mp.children].map(c => c.getAttribute("data-mood"));
console.log("attrs:", JSON.stringify(all), all.map(a => a && [...a].map(ch => "U+" + ch.codePointAt(0).toString(16).toUpperCase()).join(" ")));
process.exit(0);
