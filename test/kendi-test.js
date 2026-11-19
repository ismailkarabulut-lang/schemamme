#!/usr/bin/env node
/* Şema Üretici — kendi testi.
   Uygulamanın JS gövdesini sema-uretici.html'den çıkarır, sahte bir DOM'da çalıştırır ve
   motora (fileGraph) ölçülebilir projeler verip sonucu karşılaştırır. Tarayıcı gerekmez.

   Çalıştırma:  node test/kendi-test.js
   Çıkış kodu :  0 = hepsi geçti · 1 = en az bir test düştü
*/
/* İskele ortak: lib/sandbox.js — CLI (cli.js) ile AYNI kodu kullanır, ikinci kopya yok. */
const path = require("path");
const { sandboxKur, sahteEl } = require("../lib/sandbox.js");

const KOK = path.join(__dirname, "..");
const { sandbox, calistir, HTML, GOVDE } = sandboxKur(path.join(KOK, "sema-uretici.html"));

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
    const belirsiz = N.filter(x => (x.belirsiz||0) > 0).map(x => ({ path: x.path, adet: x.belirsiz }));
    const katman = {}; N.forEach(x => { katman[x.path] = x.L; });
    return JSON.stringify({ kenar: kenar.sort(), rol, bagimsiz, gizli, belirsiz, katman, n: N.length });
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
    "main.js→api/client.js:import",
    "main.js→style.js:import",
    "main.js→view.js:import",
    "page.tsx→ui/button.tsx:import",
    "view.js→lib/format.js:import",
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
  if (!m.kenar.some((k) => k.startsWith("pkg/mod.py→pkg/helpers.py:import")))
    throw new Error("pkg/mod.py → pkg/helpers.py kesin bağı yok · gelen: " + JSON.stringify(m.kenar));
});

/* T3 — aynı adlı dosyalar: sıra bağımsız ve belirsizse 'tahmin' */
test("T3 aynı adlı dosyada bağ KURULMAZ, sıra sonucu değiştirmez", () => {
  const A = harita([["a/utils.py", "def f(): pass\n"], ["b/utils.py", "def g(): pass\n"], ["main.py", "from utils import f\n"]]);
  const B = harita([["main.py", "from utils import f\n"], ["b/utils.py", "def g(): pass\n"], ["a/utils.py", "def f(): pass\n"]]);
  esit(A.kenar, B.kenar, "iki sıra aynı sonucu vermeli");
  esit(A.kenar, [], "iki aday varsa bağ kurulmaz");
  esit(A.belirsiz, [{ path: "main.py", adet: 1 }], "belirsiz olarak sayılmalı");
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
  /* import satırı olduğu için en güçlü sınıf: "import" (yol eşleşmesi) */
  if (!m.kenar.some((k) => k === "Kullanan.kt→View.kt:import"))
    throw new Error("Kullanan → View import bağı yok · gelen: " + JSON.stringify(m.kenar));
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

/* T8 — not: yaz → dışa aktar → geri yükle → MD çıktısında görün */
test("T8 not yazılır · JSON'a girer · geri yüklenir · MD'de görünür", () => {
  harita([["a.py", "x = 1\n"], ["b.py", "y = 2\n"]]);
  calistir("notYaz('a.py','kredi akışını bozar, dokunmayın')");
  const disa = JSON.parse(calistir("JSON.stringify(grafVerisi())"));
  esit(disa.dosya.find((d) => d.yol === "a.py").not, "kredi akışını bozar, dokunmayın", "dışa aktarımda not");
  calistir("NOTLAR={}; notKaydet();");                       /* depo boş: not yalnız JSON'dan gelmeli */
  calistir("grafYukle(" + JSON.stringify(disa) + ")");
  esit(JSON.parse(calistir("JSON.stringify(G.find(x=>x.path==='a.py').not)")), "kredi akışını bozar, dokunmayın", "geri yüklemede not");
  if (!calistir("buildGuide()").includes("- Not: kredi akışını bozar, dokunmayın"))
    throw new Error("MD çıktısında not satırı yok");
});

/* T9 — alias import: sessizce yutulmaz, "belirsiz" sayılır; dış paket sayılmaz */
test("T9 alias import sessizce yutulmaz, belirsiz sayılır", () => {
  const m = harita([
    ["tsconfig.json", '{"compilerOptions":{"paths":{"@/*":["src/*"]}}}'],
    ["src/main.tsx", "import App from '@/App';\nimport React from 'react';\n"],
    ["src/App.tsx", "export default 1;\n"],
  ]);
  esit(m.kenar, [], "alias çözülmediği için bağ kurulmaz");
  esit(m.belirsiz, [{ path: "src/main.tsx", adet: 1 }], "yalnız projede adı olan alias sayılır; 'react' dış pakettir");
});

/* T10 — çok satırlı import: satır sonu bağı koparmaz (19.11: kokpitte kaçıyordu) */
test("T10 çok satırlı import bağ kurar", () => {
  const m = harita([
    ["src/App.tsx", "import {\n  Activity,\n  Cpu,\n} from './utils/telemetry';\n"],
    ["src/utils/telemetry.ts", "export const a = 1;\n"],
  ]);
  esit(m.kenar, ["src/App.tsx→src/utils/telemetry.ts:import"], "çok satırlı import bağı");
  esit(m.bagimsiz, [], "telemetry bağımsız sayılmamalı");
});

/* T11 — tek dosyalık uygulamada bağ import değil YOL ile kurulur: tırnak içindeki dosya adı */
test("T11 tırnak içindeki dosya adı 'kaynak' bağı kurar", () => {
  const m = harita([
    ["server.py", 'from pathlib import Path\nHERE=Path(__file__).parent\nbody=(HERE/"index.html").read_bytes()\n'],
    ["test-esikler.py", 'import importlib.util\nfrom pathlib import Path\nSRC=Path("/tmp/proje/server.py")\n'],
    ["index.html", "<html><body>kokpit</body></html>\n"],
  ]);
  const kaynak = m.kenar.filter(k => k.indexOf(":kaynak") > 0).sort();
  esit(kaynak, ["server.py→index.html:kaynak", "test-esikler.py→server.py:kaynak"], "iki yol bağı da kurulmalı");
});

/* T12 — yorumda geçen dosya adı bağ ÜRETMEZ (yalnız tırnak içi ölçülür) */
test("T12 yorumdaki dosya adı kaynak bağı üretmez", () => {
  const m = harita([
    ["a.py", "# index.html dosyasını okur\nprint(1)\n"],
    ["index.html", "<html></html>\n"],
  ]);
  esit(m.kenar, [], "yorum satırı bağ kurmamalı");
});

/* T13 — "from .modules import bt1, bt3": paket içindeki ALT MODÜLLER bağ olur */
test("T13 paket içi alt modül importları bağ kurar", () => {
  const m = harita([
    ["run.py", "from .modules import bt1, bt3\n"],
    ["modules/__init__.py", "\n"],
    ["modules/bt1.py", "from ..config import X\n"],
    ["modules/bt3.py", "print(1)\n"],
    ["config.py", "X=1\n"],
  ]);
  esit(m.kenar.includes("run.py\u2192modules/bt1.py:import"), true, "bt1 bağı kurulmalı");
  esit(m.kenar.includes("run.py\u2192modules/bt3.py:import"), true, "bt3 bağı kurulmalı");
  esit(m.kenar.includes("modules/bt1.py\u2192config.py:import"), true, "'..' iki nokta bir üst pakete çıkmalı");
  esit(m.belirsiz, [], "belirsiz kalmamalı");
});

/* T14 — İP-1: kartta hesaplanan özet MODEL METNİNE taşınır; özet yoksa "—" (uydurma yok) */
function modelMetniAl(dosyalar) {
  harita(dosyalar);
  const depo = {}, eski = sandbox.document.getElementById;
  /* sahte DOM her çağrıda YENİ eleman döndürüyor: aynı id aynı elemanı versin ki
     modelYaz()'ın yazdığı metni okuyabilelim. */
  sandbox.document.getElementById = (id) => depo[id] || (depo[id] = sahteEl());
  try { calistir("modelYaz()"); return depo.modelMetin ? depo.modelMetin.textContent : ""; }
  finally { sandbox.document.getElementById = eski; }
}
test("T14 model metni 'ne iş yapar' alanını taşır, olmayanda — yazar", () => {
  const metin = modelMetniAl([
    ["ingest.py", '"""Kaynak içe aktarma: Hermes state.db ve Telegram HTML export."""\nimport db\n'],
    ["db.py", "import os\n\ndef baglan():\n    pass\n"],
    ["bagli.py", "import db\n"],
  ]);
  if (!metin.includes("ne iş yapar")) throw new Error("sütun başlığında 'ne iş yapar' yok");
  const satir = (ad) => metin.split("\n").find((s) => s.startsWith(ad + " ")) || "";
  if (!satir("ingest.py")) throw new Error("ingest.py satırı metinde yok");
  if (!/Kaynak içe aktarma: Hermes state\.db/.test(satir("ingest.py")))
    throw new Error("docstring özeti metne taşınmamış · gelen: " + satir("ingest.py"));
  if (!satir("db.py").trim().endsWith("—"))
    throw new Error("özeti olmayan dosyada — yok · gelen: " + satir("db.py"));
  if (/Dosyada açıklama yazısı yok/.test(metin))
    throw new Error("yer tutucu metin modele sızdı (— olmalıydı)");
});

/* T15 — SIRA BAĞIMSIZLIĞI: aynı proje iki farklı girdi sırasıyla AYNI metni vermeli.
   (19.11 ölçümü: "riskli" ve "ilk 10" satırlarında eşit bağ sayılı dosyalar girdi
   sırasına göre değişiyordu — tarayıcı çıktısı ile cli.js çıktısı bu yüzden farklıydı.) */
test("T15 model metni girdi sırasından bağımsız", () => {
  const D = [
    ["main.py", "import a\nimport b\nimport c\n"],
    ["a.py", "x = 1\n"],
    ["b.py", "y = 2\n"],
    ["c.py", "z = 3\n"],
    ["d.py", "q = 4\n"],
    ["e.py", "r = 5\n"],
    ["f.py", "s = 6\n"],
  ];
  const A = modelMetniAl(D);
  const B = modelMetniAl(D.slice().reverse());
  if (!A) throw new Error("model metni boş");
  if (A !== B) {
    const sa = A.split("\n"), sb = B.split("\n");
    const i = sa.findIndex((s, k) => s !== sb[k]);
    throw new Error("sıra değişince metin değişti · ilk fark satır " + (i + 1) + ": [" + sa[i] + "] ≠ [" + sb[i] + "]");
  }
});

console.log("\n" + gecen + " geçti · " + dusen + " düştü");
process.exit(dusen ? 1 : 0);
