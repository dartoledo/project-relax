import { JSDOM } from "jsdom";
const dom = new JSDOM(`<div id="moodPick"><button data-mood="😌">calm</button></div>`);
const d = dom.window.document;
console.log("plain jsdom selector:", d.querySelector('#moodPick [data-mood="😌"]') ? "FOUND" : "NULL");
console.log("dataset scan:", [...d.querySelectorAll("#moodPick button")].find(b => b.dataset.mood === "😌") ? "FOUND" : "NULL");
process.exit(0);
