# SCHEMAMME · Şema Üretici

**Bir klasörü veriyorsun, kodun haritasını alıyorsun.** Yerel çalışır, dosyalar hiçbir yere gönderilmez.

![Akış](docs/akis.gif)

Ekranda olan biten — gerçek uygulama, gerçek bir Kotlin projesi:

![Uygulama](docs/uygulama.gif)

---

## Neden var

Bir projeye dışarıdan bakınca ilk sorular şunlar oluyor: *hangi dosya neyi çağırıyor, hangisine dokunmak riskli, hangisi kimse tarafından kullanılmıyor?* Bu sorular genelde kafada tutuluyor ve yanlış hatırlanıyor. Şema Üretici bunu **ölçüyor**:

- Her dosya bir **kutu**; kutu **rengi** dosyanın rolünü, kutu **hacmi** satır sayısını gösterir.
- Dosyalar arası **bağ** üç sınıfa ayrılır — güven sırasıyla: `import` (yol eşleşmesi) · `ad` (ad kodda geçiyor, tanım tek dosyada) · `kaynak` (dosya adı metin sabitinde). Zayıf sınıflar **kesikli** çizilir.
- Katmanlar çağrı zincirinden hesaplanır: en üstte giriş noktaları, en altta ortak temel parçalar.
- Bir kutuya tıklayınca **panel** açılır: rolü, riski, çağırdıkları, onu çağıranlar, içindeki fonksiyon/sınıflar **satır numarasıyla**, ve modele verilecek hazır **görev tarifi**.

## Haritada soru sormak

- **Erişim (focus & reach)** — bir kutuya tıkla, panelde **↓ erişim: çağırdıkları** ya da **↑ erişim: onu çağıranlar** düğmesine bas: zincirin **tamamı** yanar, gerisi söner. *"Bunu silersem ne kırılır"* sorusunun cevabı. `import` ve `ad` sınıfları zincire girer; **`kaynak` sınıfı girmez** (dosya adı yalnız bir metin sabitinde geçiyor, çağrı kanıtı yok — örn. `build.gradle.kts → proguard-rules.pro`). Bağ haritada ve bağ listesinde **durur**, yalnız etki hesabına sayılmaz; panel düğmesindeki sayı da bu süzgeçten geçer. Düğmeye tekrar basmak ya da kartı kapatmak erişimi sıfırlar.
- **Kaynak kartı** — paneldeki **fonksiyon/sınıf** düğmesine tıkla: dosyanın **gerçek satırları** numaralı açılır, seçtiğin satır vurgulanır (üstte 4, altta 10 satır çevre). `baştan göster` dosyanın başını açar. Metni okunmayan dosyada kart **hiç açılmaz** (sır · ikili · 4 MB+): içerik yoksa uydurma da yok.

## Roller

| Rol | Ne demek | Risk |
|---|---|---|
| **başlatıcı** | Kimse onu çağırmıyor, o başkalarını çağırıyor (veya manifestte bildirilen giriş) | orta |
| **aracı** | Hem çağrılıyor hem çağırıyor — zincirin orta halkası | bağ sayısına göre |
| **temel parça** | Kimseyi çağırmıyor ama herkes onu kullanıyor (veri, tema, ortak yardımcı) | 3+ çağıran = yüksek |
| **bölüm** | Kendi sınıfı yok; başka bir sınıfı genişleten fonksiyonlar tanımlıyor | orta |
| **test** | Test dosyası; çağrılmaması normaldir, giriş noktası değildir | düşük |
| **bağsız** | Bu haritada bağ bulunamadı — **"kullanılmıyor" hükmü değil** | düşük |
| **yapılandırma** | Derleme/bağımlılık/ayar tanımı. Kod bağı kurmaz, **"kullanılmıyor" hükmü verilmez** | orta |
| **belge** | Kod dosyası değil; kod bağı ve risk hükmü verilmez | — |
| **okunmadı** | Uzantı okunmuyor · 4 MB üzeri · ikili içerik · sır dosyası. Rol ve bağ **hesaplanmaz** | ölçülmedi |

Bu ayrım keyfi değil: **veri yokluğu hüküm değildir.** Okunamayan bir dosya "bağımsız" diye yazılsaydı, haritayı okuyan model onu silinebilir sanırdı.

## Çıktılar

| Yer | Ne üretir | Ne işe yarar |
|---|---|---|
| 🧠 **Model modu** (`m` tuşu) | ekranda metin | Modele verilecek metin: künye, dosya tablosu (rol · satır · bağ sayıları · **etki** · risk · durum · *ne iş yapar*), okuma sırası. **etki** = "bunu değiştirirsem kaç dosya etkilenir" (zincir boyunca, `kaynak` sınıfı sayılmaz) |
| 📘 **Harita (MD)** | `SEMA-HARITASI.md` | İnsan için uzun belge: katmanlar, sembol dizini (ad → dosya:satır), dosya kartları |
| 💾 **JSON** | `sema-graph.json` | Başka araçlar için: `dosya[]` + `kenar[]` |
| 🖼 **PNG** | `proje-haritasi.png` | Haritanın resmi — harici kütüphane yok, canvas ile çizilir |

**Harita diske yazılmaz, arşivlenmez.** Her oturumda kaynaktan yeniden üretilir: kaydedilmiş harita bayat bilgidir ve yeni bir model onu "güncel" sanıp hatayı katlar.

## Başsız kullanım (tarayıcısız)

Aynı motor, terminalden — modelin kendisi tarayıcı açmadan harita üretebilsin diye:

```bash
sema <klasör>                   # model metni (stdout) — tarayıcısız kısayol
sema <klasör> --md              # SEMA-HARITASI.md içeriği
sema <klasör> --json            # sema-graph.json içeriği
sema <klasör> --sessiz          # yalnız künye satırı
node cli.js <klasör>            # aynısı, kısayol kurulmadan
```

Motor tektir: `cli.js` ve testler `sema-uretici.html` içindeki gövdeyi `lib/sandbox.js`
üzerinden çalıştırır. Okuma kapısı da uygulamanın kendisinden gelir (sır · okunabilir uzantı · boyut · ikili) — ikinci bir uygulama yok, iki farklı cevap çıkmaz.

## Girdi biçimleri

- **Klasör** — sürükle-bırak, *Klasör* düğmesi ya da `cli.js`
- **Dosyalar** — çoklu seçim veya sürükleme
- **Zip** — arşiv içinden harita (zip okuyucu **yereldir**, internet gerekmez)
- **Tek not dosyası** (`.md` / `.txt`) — dosya değil **başlık** haritası çıkar: üst başlık → alt başlık

Atlananlar: `node_modules` · `.git` · `__pycache__` · `.venv` · `build` · `dist` · `.gradle` · `.idea` · `gradlew`/`mvnw` · resim/ses/video/apk/jar/zip.

## Çalıştırma

```bash
./baslat.sh                     # Electron varsa kendi penceresinde, yoksa tarayıcıda
xdg-open sema-uretici.html      # tek dosya, sunucu gerekmez
node cli.js <klasör>            # tarayıcısız (modele doğrudan metin)
```

Gereken: bir Chromium tabanlı tarayıcı (Chrome/Chromium/Electron). Electron isteğe bağlı — yoksa tarayıcıda açılır. **Sunucu yok, hesap yok.**

Masaüstü kısayolu:

```ini
[Desktop Entry]
Name=Şema Üretici
Exec=/tam/yol/baslat.sh
Icon=/tam/yol/icon.png
Terminal=false
```

## Nasıl çalışıyor (kısa)

1. **Okuma** — her dosya metin olarak okunur; okunmayan dört durum ayrı etiketlenir (sır / uzantı / 4 MB / ikili bayt).
2. **Rol ve bağ** — Python `import` · `from … import`, JS/TS `import … from` · `export … from` · `require` · `import()`, Kotlin `import` + proje paketi eşleşmesi, `class/object/fun` tanımları, metin sabitindeki dosya adı. Çözülemeyen import **bağ kurmaz**, `belirsiz` sayılır.
3. **Katman** — kenar grafiğinde en uzun yol; döngü kırılır.
4. **Yerleşim** — katman başına satır, çakışma yok; sınır `LIMIT` (2.500 kutu), üstünde en çok bağlı olanlar çizilir ve uyarı çıkar (hesap, arama, JSON · MD tüm dosyaları kapsar).
5. **Kalıcılık yok** — harita saklanmaz; notlar yalnız sekme ömrü boyunca (`sessionStorage`) durur. Kalıcı bir şey isteniyorsa JSON çıktısı elle indirilir.

## Dürüstlük kuralları

- Her haritanın başında **KABA (ön izleme — kesin değil)** yazar. Harita yön verir, **kod karar verir**.
- `bağ yok` = bu haritada bulunamadı; "kullanılmıyor" hükmü değil.
- `belirsiz` = import yazılmış ama hedefi çözülememiş (göreli yol haritada yok, iki aday var, alias çözülmüyor).
- `—` = ölçüm yok/boş. Model metnindeki *ne iş yapar* sütunu dosyanın **kendi** başlık yorumundan alıntıdır; başlık yorumu yoksa ilk tanım satırı `[tanım]` etiketiyle alıntılanır, o da yoksa `—` yazar. Hiçbir durumda cümle uydurulmaz.
- `amaç` / `çalıştır` da **alıntıdır** ve kaynağı köşeli parantezde yazar (`[README]`, `[package.json]`, `[__main__.py]`). Bulunamayan `—` kalır.
- **Sır dosyaları** (`.env`, `*.pem`, `id_rsa`, `secrets*`…): haritada görünür, metni okunmaz, hiçbir çıktıya yazılmaz.

## Bilinen sınırlar

- Bağlar **tahmindir**: dinamik çağrılar (`getattr`, reflection, string ile yükleme) görülmez.
- Uzantı listesi sabittir; listede olmayan uzantı okunmaz — "ölçülmedi" diye etiketlenir, hüküm verilmez.
- 4 MB üzeri dosyanın içeriği okunmaz (tarayıcı belleği); haritada görünür, bağı hesaplanmaz.
- Çizim sınırı 2.500 kutu; üstünde hesap tam, çizim kısmi. Süs (animasyon/gölge/ok ucu) büyük haritada kapanır.
- Yazı tipleri Google Fonts'tan gelir; internet yoksa yedek fontla çizilir (işlev bozulmaz).

## Kendi testi

```bash
node test/kendi-test.js      # hepsi geçmeli · çıkış kodu 0
```

Testler uygulamanın JS gövdesini HTML'den çıkarıp sahte bir DOM'da çalıştırır; tarayıcı
gerekmez. Kapsam: JS/TS importları, Python göreli import, aynı adlı dosyada sıra
bağımsızlığı, yorumdan bağ üretilmemesi, Kotlin uzantı alıcısının sembol tablosunu ele
geçirmemesi, sır dosyasının okunmaması, bağsız dosyanın ayrı katmana düşmesi, not
döngüsü, alias/belirsizlik, çok satırlı import, tırnak içi dosya adı bağı, model metninin
*ne iş yapar* alanı.

## Depo yapısı

```
sema-uretici.html       ← uygulamanın tamamı (tek dosya)
cli.js                  ← başsız giriş: tarayıcısız model metni / MD / JSON
sema                    ← kısayol betiği (~/.local/bin/sema → buraya bağlanır)
lib/sandbox.js          ← ortak iskele (HTML gövdesini sahte DOM'da çalıştırır)
main.js                 ← Electron kabuğu (pencere açar, dış bağlantıları tarayıcıya devreder)
baslat.sh               ← Electron varsa onu, yoksa tarayıcıyı açar
jszip.min.js            ← zip okuyucu, yerel (JSZip 3.10.1, MIT)
not-birlestir.py        ← modelin notlarını harita JSON'una birleştirir (kendi testi var)
icon.png                ← simge
test/kendi-test.js      ← motor testleri (node, tarayıcısız)
docs/                   ← akis.gif · uygulama.gif · harita.png · akis.svg · kareler/
```

## Lisans

MIT. `jszip.min.js` için: JSZip 3.10.1, MIT, © Stuart Knightley ve katkıda bulunanlar.
