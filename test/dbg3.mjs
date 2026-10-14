import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = path.join(root, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const vc = new VirtualConsole(); const cerr=[]; vc.on("error",(...a)=>cerr.push(a.join(" ")));
const dom = new JSDOM(html, { url: pathToFileURL(htmlPath).href, runScripts:"dangerously", resources:"usable", pretendToBeVisual:true, virtualConsole:vc,
  beforeParse(w){
    const grad=()=>({addColorStop(){}});
    const m=()=>({clearRect(){},fillRect(){},strokeRect(){},beginPath(){},closePath(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){},quadraticCurveTo(){},bezierCurveTo(){},save(){},restore(){},setTransform(){},createRadialGradient:grad,createLinearGradient:grad,measureText:()=>({width:0}),globalAlpha:1,lineWidth:1,strokeStyle:"",fillStyle:""});
    w.HTMLCanvasElement.prototype.getContext=function(){return m();};
    class P{constructor(v=0){this.value=v;}setValueAtTime(){}linearRampToValueAtTime(){}exponentialRampToValueAtTime(){}setTargetAtTime(){}}
    class A{constructor(){this.connect=()=>{};this.disconnect=()=>{};this.start=()=>{};this.stop=()=>{};this.type="";this.loop=false;this.buffer=null;}}
    w.AudioContext=class{constructor(){this.sampleRate=44100;this.currentTime=0;this.state="running";this.destination={};}createGain(){const n=new A();n.gain=new P(1);return n;}createOscillator(){const n=new A();n.frequency=new P(440);return n;}createBiquadFilter(){const n=new A();n.frequency=new P(600);n.Q=new P(1);return n;}createBuffer(c,l){const b={numberOfChannels:c,length:l,sampleRate:44100};b.getChannelData=()=>new Float32Array(l);return b;}createBufferSource(){return new A();}createStereoPanner(){const n=new A();n.pan=new P(0);return n;}resume(){return Promise.resolve();}};
    w.webkitAudioContext=w.AudioContext; if(!w.matchMedia)w.matchMedia=q=>({matches:false,media:q,addEventListener(){},removeEventListener(){}}); w.scrollTo=()=>{}; w.HTMLAnchorElement.prototype.scrollIntoView=function(){}; w.Notification=class{constructor(){}static get permission(){return "granted";}static requestPermission(){return Promise.resolve("granted");}}; },
});
const w=dom.window,d=w.document; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await new Promise(r=>w.addEventListener("load",r)); await sleep(120);
const app=w.sereneApp;
d.querySelector('[data-tab="sounds"]').click(); await sleep(30);
d.querySelector('[data-sound="rain"]').click(); await sleep(40);
console.log("after rain click activeSounds:", JSON.stringify(app.settings.activeSounds));
try { d.querySelector('[data-preset="rainynight"]').click(); } catch(e){ console.log("rainynight threw:", e.message); }
await sleep(40);
console.log("after rainynight activeSounds:", JSON.stringify(app.settings.activeSounds), "| fire aria:", d.querySelector('[data-sound="fire"]').getAttribute("aria-pressed"));
try { d.querySelector('[data-preset="oceandrift"]').click(); } catch(e){ console.log("oceandrift threw:", e.message, "\n", e.stack); }
await sleep(40);
console.log("after oceandrift activeSounds:", JSON.stringify(app.settings.activeSounds));
console.log("  ocean aria:", d.querySelector('[data-sound="ocean"]').getAttribute("aria-pressed"), "| fire aria:", d.querySelector('[data-sound="fire"]').getAttribute("aria-pressed"), "| chimes aria:", d.querySelector('[data-sound="chimes"]').getAttribute("aria-pressed"));
console.log("window errors:", cerr.length? cerr : "(none)");
