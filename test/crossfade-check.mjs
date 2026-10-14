import { JSDOM } from "jsdom";
import fs from "node:fs";
const html = fs.readFileSync("index.html", "utf8");
const dom = new JSDOM(html);
const w = dom.window, d = w.document;
w.localStorage.clear?.();
const appSrc = fs.readFileSync("app.js", "utf8");
w.eval(appSrc);
const A = d.getElementById("sceneImg"), B = d.getElementById("sceneImg2");
const state = () => ({ front: (A.classList.contains("loaded") ? "A" : "B") + (A.classList.contains("loaded") ? "" : ""), aLoaded: A.classList.contains("loaded"), bLoaded: B.classList.contains("loaded"), aSrc: A.getAttribute("src"), bSrc: B.getAttribute("src") });
// initial: mistyPines -> loads into A
w.eval('selectScene("mistyPines", true)');
A.dispatchEvent(new w.Event("load"));
console.log("1 after pines load:", JSON.stringify(state()));
// switch to oceanDusk -> must go into B, A stays visible until B loads
w.eval('selectScene("oceanDusk")');
const mid = state();
console.log("2 mid-switch (B loading):", JSON.stringify(mid));
if (!(mid.aLoaded && !mid.bLoaded && mid.bSrc === "img/scene-ocean-dusk.jpg")) throw new Error("crossfade broken: old layer must stay visible while new one loads");
B.dispatchEvent(new w.Event("load"));
console.log("3 after ocean load:", JSON.stringify(state()));
if (state().bLoaded !== true || state().aLoaded !== false) throw new Error("swap failed");
// switch back to pines -> A is cached (src unchanged) -> instant visibility swap, no reload
w.eval('selectScene("mistyPines")');
const back = state();
console.log("4 back to pines:", JSON.stringify(back));
if (!(back.aLoaded && !back.bLoaded)) throw new Error("cached layer swap failed");
// fast double switch: ocean (into B) then immediately pines before B "loads"
w.eval('selectScene("oceanDusk")'); // into B, pending load
w.eval('selectScene("mistyPines")'); // instant cached swap to A, must invalidate B's pending reveal
B.dispatchEvent(new w.Event("load")); // stale event for ocean must not flip visibility back
const fast = state();
console.log("5 after stale load:", JSON.stringify(fast));
if (!(fast.aLoaded && !fast.bLoaded)) throw new Error("stale load event flipped the backdrop");
// aurora hides layer, then photo re-enables without errors
w.eval('selectScene("aurora")');
w.eval('selectScene("groveOwl")');
A.dispatchEvent(new w.Event("load")); B.dispatchEvent(new w.Event("load"));
console.log("6 owl scene:", JSON.stringify(state()));
console.log("ALL CROSSFADE CHECKS PASSED");
