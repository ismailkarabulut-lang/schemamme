#!/usr/bin/env node
/* Şema Üretici — kendi testi.
   Uygulamanın JS gövdesini sema-uretici.html'den çıkarır, sahte bir DOM'da çalıştırır ve
   motora (fileGraph) ölçülebilir projeler verip sonucu karşılaştırır. Tarayıcı gerekmez.

   Çalıştırma:  node test/kendi-test.js
   Çıkış kodu :  0 = hepsi geçti · 1 = en az bir test düştü
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const KOK = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(KOK, "sema-uretici.html"), "utf8");
const GOVDE = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1])
  .sort((a, b) => b.length - a.length)[0];

/* ---- sahte DOM: uygulama açılışta DOM'a dokunuyor, testte bu kadarı yetiyor ---- */
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
const depo = {};
const sandbox = {
  console, setTimeout: (f) => (typeof f === "function" ? 0 : 0), clearTimeout() {},
  performance: { now: () => Date.now() },
  localStorage: {
    getItem: (k) => (k in depo ? depo[k] : null),
    setItem: (k, v) => { depo[k] = String(v); },
    removeItem: (k) => { delete depo[k]; }, clear() { Object.keys(depo).forEach((k) => delete depo[k]); },
  },
  document: {
    getElementById() { return sahteEl(); }, querySelector() { return sahteEl(); }, querySelectorAll() { return []; },
    createElement() { return sahteEl(); }, body: sahteEl(), documentElement: sahteEl(),
    addEventListener() {}, readyState: "complete",
  },
  Blob: class { constructor(a) { this.size = (a && a[0] && a[0].length) || 0; } },
  URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
  FileReader: class { readAsText() {} },
  alert() {}, navigator: { userAgent: "node" },
  matchMedia: (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  requestAnimationFrame: (f) => 0, cancelAnimationFrame() {},
  addEventListener() {}, dispatchEvent() {},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(GOVDE, sandbox, { filename: "sema-uretici.html" });

const calistir = (kod) => vm.runInContext(kod, sandbox);

/* ---- yardımcı: dosya listesinden harita çıkar ---- */
function harita(dosyalar) {
  sandbox.__D = dosyalar.map(([p, t]) => ({ path: p, text: t, size: t.length }));
  return JSON.parse(calistir(`(() => {
    const N = fileGraph(__D);
    G = N; draw();                    /* katman (L) ve yerleşim draw() içinde hesaplanıyor */
    const kenar = [];
    N.forEach(a => a.out.forEach(b => kenar.push(a.path + "→" + N[b].path + ":" + (GUVEN.get(a.id + "-" + b) || "?"))));
    const rol = {}; N.forEach(x => { const s = roleOf(x).short; rol[x.path] = s; });
    const bagimsiz = N.filter(x => !x.inn.size && !x.out.size).map(x => x.path);
    const gizli = N.filter(x => x.okunmadi && x.nd === "sir").map(x => ({ path: x.path, metin: x.text }));
    const katman = {}; N.forEach(x => { katman[x.path] = x.L; });
    return JSON.stringify({ kenar: kenar.sort(), rol, bagimsiz, gizli, katman, n: N.length });
  })()`));
}

/* ---- mini test çerçevesi ---- */
let gecen = 0, dusen = 0;
function test(ad, fn) {
  try { fn(); gecen++; console.log("  ✓ " + ad); }
  catch (e) { dusen++; console.log("  ✗ " + ad + "\n      " + e.message); }
}
const esit = (gercek, beklenen, ne) => {
  const a = JSON.stringify(gercek), b = JSON.stringify(beklenen);
  if (a !== b) throw new Error((ne || "") + " beklenen " + b + " · gelen " + a);
};

console.log("ŞEMA ÜRETİCİ · kendi testi\n");

/* T1 — JS/TS importları: import · export-from · require · tsx */
test("T1 JS/TS importları kesin bağ kurar", () => {
  const m = harita([
    ["main.js", "import { greet } from './view';\nimport './style.js';\nconst api = require('./api/client');\n"],
    ["view.js", "export * from './lib/format';\nexport function greet() {}\n"],
    ["lib/format.js", "export const fmt = 1;\n"],
    ["style.js", "export const s = 1;\n"],
    ["api/client.js", "export function get() {}\n"],
    ["util.js", "export default 1;\n"],
    ["page.tsx", "import { Button } from './ui/button';\n"],
    ["ui/button.tsx", "export const Button = 1;\n"],
  ]);
  esit(m.n, 8, "dosya sayısı");
  esit(m.kenar, [
    "main.js→api/client.js:kesin",
    "main.js→style.js:kesin",
    "main.js→view.js:kesin",
    "page.tsx→ui/button.tsx:kesin",
    "view.js→lib/format.js:kesin",
  ], "bağlar");
  esit(m.bagimsiz, ["util.js"], "gerçekten bağımsız olan");
});

/* T2 — Python göreli import */
test("T2 Python 'from . import x' paket içinde çözülür", () => {
  const m = harita([
    ["pkg/__init__.py", ""],
    ["pkg/helpers.py", "def h(): pass\n"],
    ["pkg/mod.py", "from . import helpers\nfrom ..pkg import helpers\n"],
  ]);
  if (!m.kenar.some((k) => k.startsWith("pkg/mod.py→pkg/helpers.py:kesin")))
    throw new Error("pkg/mod.py → pkg/helpers.py kesin bağı yok · gelen: " + JSON.stringify(m.kenar));
});

/* T3 — aynı adlı dosyalar: sıra bağımsız ve belirsizse 'tahmin' */
test("T3 aynı adlı dosyada sonuç okuma sırasından bağımsız", () => {
  const A = harita([["a/utils.py", "def f(): pass\n"], ["b/utils.py", "def g(): pass\n"], ["main.py", "from utils import f\n"]]);
  const B = harita([["main.py", "from utils import f\n"], ["b/utils.py", "def g(): pass\n"], ["a/utils.py", "def f(): pass\n"]]);
  esit(A.kenar, B.kenar, "iki sıra aynı sonucu vermeli");
  esit(A.kenar, ["main.py→a/utils.py:tahmin"], "belirsiz eşleşme tahmin işaretlenmeli");
});

/* T4 — yorumda geçen ad bağ üretmez */
test("T4 yorumdaki ad sahte bağ üretmez", () => {
  const m = harita([
    ["Ayar.kt", "package x\n// Bu ekran AnaEkran:12 satırında çağrılıyor\nfun a() {}\n"],
    ["AnaEkran.kt", "package x\nclass AnaEkran { fun b() {} }\n"],
  ]);
  if (m.kenar.some((k) => k.startsWith("Ayar.kt→AnaEkran.kt")))
    throw new Error("yorumdan bağ üretildi: " + JSON.stringify(m.kenar));
});

/* T5 — uzantı fonksiyonu sembol tablosunu ele geçirmez */
test("T5 Kotlin uzantı alıcısı tanım sayılmaz", () => {
  const m = harita([
    ["View.kt", "package x\nclass View { fun a() {} }\n"],
    ["Bolum.kt", "package x\ninternal fun View.ek() {}\n"],
    ["Kullanan.kt", "package x\nimport x.View\nclass Kullanan { fun c(v: View) {} }\n"],
  ]);
  if (!m.kenar.some((k) => k === "Kullanan.kt→View.kt:kesin"))
    throw new Error("Kullanan → View kesin bağı yok · gelen: " + JSON.stringify(m.kenar));
  if (m.kenar.some((k) => k.startsWith("Kullanan.kt→Bolum.kt")))
    throw new Error("bağ bölüm dosyasına gitti: " + JSON.stringify(m.kenar));
});

/* T6 — sır dosyası okunmaz */
test("T6 sır dosyasının metni düğüme girmez", () => {
  const m = harita([["app/.env", "GEMINI_API_KEY=AIzaTEST123\n"], ["main.py", "print(1)\n"]]);
  esit(m.gizli, [{ path: "app/.env", metin: null }], "sır düğümü");
});

/* T7 — bağsız dosya ayrı katmana düşer */
test("T7 bağsız dosya en dip katmana gömülmez", () => {
  const m = harita([
    ["a.py", "import b\n"], ["b.py", "x = 1\n"], ["tek.py", "y = 2\n"],
  ]);
  if (!(m.katman["tek.py"] > Math.max(m.katman["a.py"], m.katman["b.py"])))
    throw new Error("bağsız katmanı ayrı değil: " + JSON.stringify(m.katman));
});

console.log("\n" + gecen + " geçti · " + dusen + " düştü");
process.exit(dusen ? 1 : 0);
