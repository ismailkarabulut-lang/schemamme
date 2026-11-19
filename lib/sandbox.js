/* Şema Üretici — başsız çalıştırma iskelesi (tarayıcısız).
   Tek işi var: sema-uretici.html içindeki uygulama gövdesini sahte bir DOM'da çalıştırmak.
   Böylece CLI (cli.js) ve testler (test/kendi-test.js) AYNI motoru kullanır — ikinci bir
   uygulama yazılmaz. Motor tek: sema-uretici.html. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function sahteEl() {
  const e = {
    style: {}, dataset: {}, hidden: false, textContent: "", innerHTML: "", value: "", checked: false,
    offsetWidth: 800, offsetHeight: 600, clientHeight: 600, scrollHeight: 600, scrollTop: 0,
    clientWidth: 800, scrollWidth: 800, offsetLeft: 0, offsetTop: 0, children: [], childNodes: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
    setAttribute() {}, getAttribute() { return null; }, focus() {}, scrollIntoView() {},
    querySelector() { return sahteEl(); }, querySelectorAll() { return []; }, closest() { return null; },
    getBoundingClientRect() { return { x: 0, y: 0, width: 0, height: 0 }; },
    getContext() { return {}; }, toDataURL() { return "data:,"; },
  };
  e.parentElement = { clientWidth: 1120, clientHeight: 600, getBoundingClientRect() { return { x: 0, y: 0, width: 1120, height: 600 }; } };
  return e;
}

/* Uygulamanın <script> gövdesini HTML'den çıkarır. Birden çok script varsa en büyüğü
   uygulamadır (jszip gibi kütüphaneler ayrı dosyada duruyor). */
function govdeCikar(html) {
  const parcalar = [...String(html).matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (!parcalar.length) throw new Error("sema-uretici.html içinde <script> gövdesi bulunamadı");
  return parcalar.sort((a, b) => b.length - a.length)[0];
}

/* Sahte DOM + uygulama gövdesi. Dönen: {sandbox, calistir, sahteEl, HTML, GOVDE} */
function sandboxKur(htmlYolu) {
  const HTML = htmlYolu
    ? fs.readFileSync(htmlYolu, "utf8")
    : fs.readFileSync(path.join(__dirname, "..", "sema-uretici.html"), "utf8");
  const GOVDE = govdeCikar(HTML);
  const depo = {};
  const sandbox = {
    console, setTimeout: (f) => (typeof f === "function" ? 0 : 0), clearTimeout() {},
    performance: { now: () => Date.now() },
    localStorage: {
      getItem: (k) => (k in depo ? depo[k] : null),
      setItem: (k, v) => { depo[k] = String(v); },
      removeItem: (k) => { delete depo[k]; },
      clear() { Object.keys(depo).forEach((k) => delete depo[k]); },
    },
    sessionStorage: {
      getItem: (k) => (k in depo ? depo[k] : null),
      setItem: (k, v) => { depo[k] = String(v); },
      removeItem: (k) => { delete depo[k]; },
      clear() { Object.keys(depo).forEach((k) => delete depo[k]); },
    },
    document: {
      getElementById() { return sahteEl(); }, querySelector() { return sahteEl(); }, querySelectorAll() { return []; },
      createElement() { return sahteEl(); }, createElementNS() { return sahteEl(); },
      body: sahteEl(), documentElement: sahteEl(), addEventListener() {}, readyState: "complete",
    },
    Blob: class { constructor(a) { this.size = (a && a[0] && a[0].length) || 0; } },
    URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
    FileReader: class { readAsText() {} },
    alert() {}, prompt() {}, navigator: { userAgent: "node" },
    matchMedia: (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    requestAnimationFrame: () => 0, cancelAnimationFrame() {}, addEventListener() {}, dispatchEvent() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(GOVDE, sandbox, { filename: "sema-uretici.html" });
  const calistir = (kod) => vm.runInContext(kod, sandbox);
  return { sandbox, calistir, sahteEl, HTML, GOVDE };
}

module.exports = { sandboxKur, sahteEl, govdeCikar };
