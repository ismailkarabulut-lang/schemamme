#!/usr/bin/env node
/* Şema Üretici — BAŞSIZ (tarayıcısız) giriş.
   Kullanım:
     node cli.js <klasör>            → model metni (modele verilecek metin)
     node cli.js <klasör> --md       → SEMA-HARITASI.md içeriği
     node cli.js <klasör> --json     → sema-graph.json içeriği
     node cli.js <klasör> --sessiz   → yalnız tek satır özet (ölçüm/karşılaştırma için)
   Seçenekler:
     --sinir <N>   metni N karakterde kes (çıktı boru hattında taşmasın)
   Motor: sema-uretici.html (aynı üç kutu, aynı dürüstlük kuralları). İkinci motor YOK.
   Okuma kapısı da uygulamanın kendisinden: sirMi · okunabilirUzanti · boyut · ikili. */
const fs = require("fs");
const path = require("path");
const { sandboxKur } = require("./lib/sandbox.js");

const KOK_DIZIN = path.join(__dirname);
const YARDIM = `Şema Üretici · başsız kullanım
  node cli.js <klasör> [--md | --json | --sessiz] [--sinir N]

  <klasör>     taranacak proje klasörü (mutlak ya da göreli yol)
  --md         SEMA-HARITASI.md içeriğini basar
  --json       sema-graph.json içeriğini basar
  --sessiz     yalnız "N dosya · M bağ · K özet" satırı
  --sinir N    çıktıyı N karakterde kes (varsayılan: sınırsız)

Çıkış kodu: 0 başarılı · 1 kullanım hatası · 2 okunacak dosya yok`;

function argAyikla(argv) {
  const a = { klasor: "", md: false, json: false, sessiz: false, sinir: 0 };
  const kalan = [];
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (s === "--md") a.md = true;
    else if (s === "--json") a.json = true;
    else if (s === "--sessiz") a.sessiz = true;
    else if (s === "--sinir") { a.sinir = parseInt(argv[++i], 10) || 0; }
    else if (s === "-h" || s === "--yardim" || s === "--help") a.yardim = true;
    else kalan.push(s);
  }
  a.klasor = kalan[0] || "";
  return a;
}

function dosyalariTara(dir, taban, out, sinir) {
  for (const ad of fs.readdirSync(dir).sort()) {
    if (out.length >= sinir) return out;
    const tam = path.join(dir, ad), rel = taban ? taban + "/" + ad : ad;
    let st;
    try { st = fs.statSync(tam); } catch (e) { continue; }      /* izin yok / kırık bağ */
    if (st.isDirectory()) dosyalariTara(tam, rel, out, sinir);
    else out.push(rel);
  }
  return out;
}

async function main() {
  const a = argAyikla(process.argv.slice(2));
  if (a.yardim || !a.klasor) {
    console.log(YARDIM);
    process.exit(a.klasor ? 0 : 1);
  }
  const kok = path.resolve(a.klasor.replace(/^~(?=\/|$)/, process.env.HOME || "~"));
  if (!fs.existsSync(kok) || !fs.statSync(kok).isDirectory()) {
    console.error("hata: klasör bulunamadı → " + kok);
    process.exit(1);
  }

  const { sandbox, calistir } = sandboxKur(path.join(KOK_DIZIN, "sema-uretici.html"));
  /* Uygulamaya kök bilgisi: tarayıcıda yok, başsız çalışmada var. Uygulama görürse yazar. */
  calistir("if(typeof KOK_AD!=='undefined')KOK_AD=" + JSON.stringify(path.basename(kok)));
  calistir("if(typeof KOK_YOL!=='undefined')KOK_YOL=" + JSON.stringify(kok));

  /* Uygulamanın kendi kapıları: hangi dosya hiç taranmaz (SKIP). */
  const hepsi = dosyalariTara(kok, "", [], 40000);
  const giren = hepsi.filter((p) => !calistir("SKIP.test(" + JSON.stringify(p) + ")"));

  const E = [];
  for (const p of giren) {
    const b = fs.readFileSync(path.join(kok, p));
    const metin = b.toString("utf8");
    /* metinAl = uygulamanın okuma kapısı (sır / uzantı / boyut / ikili). Aynı kod, aynı hüküm. */
    sandbox.__metin = () => metin;
    const r = await calistir("metinAl(" + JSON.stringify(p) + "," + b.length + ",__metin)");
    E.push({ path: p, size: b.length, text: r.t, okunmadi: r.okunmadi, neden: r.neden });
  }
  delete sandbox.__metin;

  if (!E.length) {
    console.error("uye: " + kok + " içinde okunacak dosya yok (hepsi atlanan klasör/uzantı)");
    process.exit(2);
  }

  sandbox.__D = E;
  calistir("G=fileGraph(__D); draw();");

  /* Metni yakalamak için sahte DOM'da aynı id aynı elemanı vermeli. */
  const elemanlar = {};
  const eski = sandbox.document.getElementById;
  const { sahteEl } = require("./lib/sandbox.js");
  sandbox.document.getElementById = (id) => elemanlar[id] || (elemanlar[id] = sahteEl());
  let cikti = "";
  if (a.json) cikti = JSON.stringify(JSON.parse(calistir("JSON.stringify(grafVerisi())")), null, 1);
  else if (a.md) cikti = calistir("buildGuide()");
  else {
    calistir("modelYaz()");
    cikti = elemanlar.modelMetin ? elemanlar.modelMetin.textContent : "";
  }
  sandbox.document.getElementById = eski;

  if (a.sessiz) {
    const satirlar = cikti.split("\n");
    console.log(satirlar[0]);
  } else {
    if (a.sinir && cikti.length > a.sinir) cikti = cikti.slice(0, a.sinir) + "\n… (kesildi: --sinir " + a.sinir + ")";
    process.stdout.write(cikti.endsWith("\n") ? cikti : cikti + "\n");
  }
}

main().catch((e) => {
  console.error("hata: " + (e && e.message ? e.message : e));
  process.exit(1);
});
