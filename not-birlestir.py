#!/usr/bin/env python3
"""Şema Üretici · not birleştirici — model döngüsünün ikinci yarısı.

NEDEN VAR
  Harita artık her dosyaya `not` taşıyor (panelde yazılıyor, JSON'da `not` alanı).
  Eksik olan halka buydu: modelin ürettiği açıklamanın haritaya GERİ dönmesi.
  Bu betik modelin çıktısını alır, harita JSON'una işler; uygulama o JSON'u açınca
  notlar yerinde olur (grafYukle `not` alanını okur ve kalıcı depoya alır).

NASIL ÇALIŞIR
  girdi : --harita  sema-graph.json  (uygulamanın "JSON indir" çıktısı)
          --gelen   model çıktısı: .json ya da .md
  kural : elle yazılmış not EZİLMEZ. Boş alan doldurulur, aynı not iki kez yazılmaz.
  çıktı : --cikti (verilmezse haritanın kendisi, .yedek alınarak) + değişiklik raporu

MODEL ÇIKTISI OLARAK KABUL EDİLEN BİÇİMLER (.json)
  {"dosya":[{"yol":"a.py","not":"..."}]}      · harita biçimi
  {"notlar":{"a.py":"..."}}                    · yol → not
  {"a.py":"..."}                               · düz eşleme
  [{"path":"a.py","not":"..."}]                · liste
  (.md)  "### yol" başlığı altında "- Not: ..." satırı

KENDİ TESTİ
  python3 not-birlestir.py --kendini-test
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import tempfile


# ---------------------------------------------------------------- çıktı okuma
def md_notlari(metin: str) -> dict:
    """'### yol' başlıkları altındaki '- Not: ...' satırlarını toplar."""
    notlar, yol = {}, None
    for satir in metin.splitlines():
        b = re.match(r"^#{2,4}\s+(.+?)\s*$", satir)
        if b and not satir.strip().startswith("- "):
            yol = b.group(1).strip("` ")
            continue
        n = re.match(r"^\s*[-*]\s*Not\s*:\s*(.+?)\s*$", satir, re.IGNORECASE)
        if n and yol:
            notlar[yol] = (notlar.get(yol, "") + " " + n.group(1)).strip()
    return notlar


def json_notlari(veri) -> dict:
    """Bilinen dört biçimi tek sözlüğe indirger: {yol: not}."""
    if isinstance(veri, list):
        return {str(d.get("yol") or d.get("path") or d.get("ad")): str(d.get("not") or "").strip()
                for d in veri if isinstance(d, dict) and (d.get("not") or "").strip()}
    if isinstance(veri, dict):
        if isinstance(veri.get("notlar"), dict):
            return {str(k): str(v).strip() for k, v in veri["notlar"].items() if str(v).strip()}
        if isinstance(veri.get("dosya"), list):
            return {str(d.get("yol") or d.get("ad")): str(d.get("not") or "").strip()
                    for d in veri["dosya"] if isinstance(d, dict) and (d.get("not") or "").strip()}
        duz = {str(k): str(v).strip() for k, v in veri.items()
               if isinstance(v, str) and v.strip() and k not in ("surum", "surumAd", "kaynak")}
        if duz:
            return duz
    raise ValueError("gelen dosyada not bulunamadı (bilinen biçimlerin hiçbirine uymuyor)")


def geleni_oku(yol: str) -> dict:
    with open(yol, encoding="utf-8") as f:
        metin = f.read()
    if yol.lower().endswith(".md"):
        return md_notlari(metin)
    try:
        return json_notlari(json.loads(metin))
    except json.JSONDecodeError:
        return md_notlari(metin)          # uzantı yanlışsa MD gibi dene


# ---------------------------------------------------------------- birleştirme
def birlestir(harita: dict, notlar: dict) -> tuple[dict, dict]:
    """Haritayı yerinde günceller; özet sayaç döndürür. Elle yazılan not ezilmez."""
    dosyalar = harita.get("dosya") or []
    yolunan = {str(d.get("yol") or d.get("ad")): d for d in dosyalar if isinstance(d, dict)}
    rapor = {"eklenen": [], "korunan": [], "ayni": [], "yok": [], "bos": []}
    for yol, not_ in notlar.items():
        not_ = (not_ or "").strip()
        if not not_:
            continue
        d = yolunan.get(yol)
        if d is None:
            rapor["yok"].append(yol)
            continue
        mevcut = str(d.get("not") or "").strip()
        if not mevcut:
            d["not"] = not_
            rapor["eklenen"].append(yol)
        elif not_ in mevcut:
            rapor["ayni"].append(yol)
        else:
            # elle yazılmış not korunur; model notu rapora düşer, dosyaya yazılmaz
            rapor["korunan"].append(yol)
    return harita, rapor


def rapor_bas(rapor: dict, gelen_sayisi: int) -> None:
    print(f"gelen not      : {gelen_sayisi}")
    for anahtar, ad in (("eklenen", "eklendi       "), ("korunan", "korundu (elle)"),
                        ("ayni", "zaten vardı   "), ("yok", "haritada yok  ")):
        yol_liste = rapor[anahtar]
        print(f"{ad} : {len(yol_liste)}")
        for y in yol_liste[:10]:
            print(f"    · {y}")
        if len(yol_liste) > 10:
            print(f"    · … {len(yol_liste) - 10} tane daha")


def yaz(hedef: str, veri: dict, yedek: bool = True) -> None:
    if yedek and os.path.exists(hedef):
        shutil.copy2(hedef, hedef + ".yedek")
    gecici = hedef + ".tmp"
    with open(gecici, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, indent=1)
        f.write("\n")
    os.replace(gecici, hedef)


# ---------------------------------------------------------------- kendi testi
def kendini_test() -> int:
    gecen = dusen = 0

    def kontrol(ad, kosul, ayrinti=""):
        nonlocal gecen, dusen
        if kosul:
            gecen += 1
            print(f"  ✓ {ad}")
        else:
            dusen += 1
            print(f"  ✗ {ad} {ayrinti}")

    print("NOT BİRLEŞTİRİCİ · kendi testi\n")
    with tempfile.TemporaryDirectory() as td:
        # 1 · boş alan doldurulur
        h = {"dosya": [{"yol": "a.py", "not": ""}, {"yol": "b.py", "not": "elle yazdım"}]}
        h2, r = birlestir(h, {"a.py": "model notu", "b.py": "model notu"})
        kontrol("boş not doldurulur", h2["dosya"][0]["not"] == "model notu")
        kontrol("elle yazılan not korunur", h2["dosya"][1]["not"] == "elle yazdım")
        kontrol("korunan raporda görünür", r["korunan"] == ["b.py"])

        # 2 · haritada olmayan yol dosya uydurmaz
        h3, r3 = birlestir({"dosya": [{"yol": "a.py", "not": ""}]}, {"hayalet.py": "x"})
        kontrol("olmayan yol eklenmez", len(h3["dosya"]) == 1 and r3["yok"] == ["hayalet.py"])

        # 3 · aynı not iki kez yazılmaz (iki kez koşum)
        h4 = {"dosya": [{"yol": "a.py", "not": ""}]}
        h4, _ = birlestir(h4, {"a.py": "tek not"})
        h4, r4 = birlestir(h4, {"a.py": "tek not"})
        kontrol("tekrar koşunca çoğalmaz", h4["dosya"][0]["not"] == "tek not" and r4["ayni"] == ["a.py"])

        # 4 · MD biçimi okunur
        md = "## Dosya kartları\n\n### app/src/A.kt\n- Rol: başlatıcı\n- Not: giriş noktası\n\n### B.kt\n- Not: ikinci\n"
        md_yol = os.path.join(td, "m.md")
        open(md_yol, "w", encoding="utf-8").write(md)
        gelen = geleni_oku(md_yol)
        kontrol("MD'den not okunur", gelen == {"app/src/A.kt": "giriş noktası", "B.kt": "ikinci"}, str(gelen))

        # 5 · JSON biçimleri
        for ad, veri in (
            ("notlar sözlüğü", {"notlar": {"a.py": "n1"}}),
            ("dosya listesi", {"dosya": [{"yol": "a.py", "not": "n1"}]}),
            ("düz eşleme", {"a.py": "n1"}),
            ("liste", [{"path": "a.py", "not": "n1"}]),
        ):
            kontrol(f"JSON biçimi: {ad}", json_notlari(veri) == {"a.py": "n1"}, str(json_notlari(veri)))

        # 6 · dosyaya yazma + yedek
        hedef = os.path.join(td, "sema-graph.json")
        yaz(hedef, {"dosya": [{"yol": "a.py", "not": ""}]})
        yaz(hedef, {"dosya": [{"yol": "a.py", "not": "yeni"}]})
        geri = json.load(open(hedef, encoding="utf-8"))
        kontrol("yazma çalışır", geri["dosya"][0]["not"] == "yeni")
        kontrol("yedek alınır", os.path.exists(hedef + ".yedek"))

    print(f"\n{gecen} geçti · {dusen} düştü")
    return 0 if dusen == 0 else 1


# ---------------------------------------------------------------- ana akış
def main() -> int:
    ap = argparse.ArgumentParser(description="Modelin ürettiği notları Şema Üretici haritasına birleştirir.")
    ap.add_argument("--harita", help="sema-graph.json (uygulamanın JSON çıktısı)")
    ap.add_argument("--gelen", help="modelin çıktısı: .json ya da .md")
    ap.add_argument("--cikti", help="birleşmiş haritanın yazılacağı dosya (verilmezse --harita güncellenir)")
    ap.add_argument("--kuru", action="store_true", help="dosyaya yazma, yalnız rapor bas")
    ap.add_argument("--kendini-test", action="store_true", help="betiğin kendi testlerini koş")
    a = ap.parse_args()

    if a.kendini_test:
        return kendini_test()
    if not a.harita or not a.gelen:
        ap.error("--harita ve --gelen zorunlu (ya da --kendini-test)")

    harita = json.load(open(a.harita, encoding="utf-8"))
    if not isinstance(harita, dict) or "dosya" not in harita:
        print("HATA: harita biçimi beklenenden farklı ('dosya' anahtarı yok).", file=sys.stderr)
        return 2
    notlar = geleni_oku(a.gelen)
    if not notlar:
        print("HATA: gelen dosyada not bulunamadı.", file=sys.stderr)
        return 2

    harita, rapor = birlestir(harita, notlar)
    rapor_bas(rapor, len(notlar))

    hedef = a.cikti or a.harita
    if a.kuru:
        print(f"\nkuru koşum: {hedef} dosyasına YAZILMADI")
        return 0
    yaz(hedef, harita, yedek=(hedef == a.harita))
    print(f"\nyazıldı: {hedef}" + ("  (yedek: .yedek)" if hedef == a.harita else ""))
    print("Şema Üretici'de bu JSON'u aç → notlar haritada ve panelde görünür.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
