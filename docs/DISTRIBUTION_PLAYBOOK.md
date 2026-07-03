# LaunchWake'in Kendi Distribution Playbook'u

*Tarih: 2026-07-02. Amaç: LaunchWake'i lanslamak. Ana fikir: her adım ürünün kendi demosudur — planı LaunchWake'in içinde oluştur, tracked link'lerle yürüt, sonucu public Launch Report olarak yayınla. "Kanıtı benim" diyebilen tek rakip sen olursun.*

## Strateji tek cümlede

Büyük patlama yok; **beta → soft → big → sürekli** dört fazlı rampa. HN ve Product Hunt tek kurşunluk silahlar — elinde gerçek kullanıcı hikâyesi ve testimonial olmadan sıkma.

---

## Faz 0 — Hazırlık (taşımayla paralel, ~3 gün)

- LaunchWake'i LaunchWake'e proje olarak ekle; kendi distribution planını üret. Bu plan aşağıdaki takvimin gerçek hali olacak (ve ekran görüntüsü her postta kullanılacak).
- 60 saniyelik demo GIF/video: repo yapıştır → plan çıkar → ban riski gör. Hero'daki Launch Checker akışı yeterli; ekran kaydı + hızlandırma.
- 3 hazır cevap yaz (HN/Reddit eleştirilerine): "bu da mı AI wrapper?" (katalog + outcome data anlatısı), "insanlar bunu kendisi yapamaz mı?" (zaman + ban riski + attribution), "verilerime ne oluyor?" (public repo'da sadece metadata okuduğun).
- Attribution'ı kendi sitene kur: her kanal için tracked link — hangi taktiğin işlediğini kendi ürününle ölçeceksin.

## Faz 1 — Sessiz beta (1.-2. hafta): 15-20 gerçek kullanıcı

Hedef: HN'den önce gerçek outcome verisi + 3-5 testimonial + bug ayıklama.

- **WIP, Indie Hackers, r/SideProject**: "building this, looking for 10 founders about to launch — free Pro" mesajı. Satış değil, davet tonu.
- Kişisel ağ + yakın zamanda GitHub'da release atmış 20-30 indie maintainer'a elle, kişisel mesaj (her birine ürünleri için Launch Checker çıktısı ekle — mesajın kendisi demo olur; günde 10'u geçme).
- Her beta kullanıcısından iste: ilk planını uygula, sonucu paylaşmasına izin versin. **Bunlar ilk public Launch Report'ların olacak.**

## Faz 2 — Soft launch (2.-3. hafta): dizinler + sıcak topluluklar

Düşük risk, kalıcı backlink, damla trafik. Kendi kataloğundaki "Anytime (queued)" kanalları:

- **Dizinler (bir günde toplu):** Uneed, Peerlist Launchpad, DevHunt, MicroLaunch, Fazier, BetaList, SaaSHub, Launching Next, StackShare, AlternativeTo ("Buffer alternative for founders who won't auto-post" açısıyla).
- **Show IH (Indie Hackers):** hikâye formatı — "yan projemi 6 kez lansladım, 4'ünde sıfır kullanıcı. Sorunun post değil kanal seçimi olduğunu fark ettim, bunu yaptım."
- **r/SideProject:** rahat kurallar, sıcak kitle. Demo GIF + Launch Checker linki (login'siz olması burada altın değerinde).
- Beta verisiyle ilk **build-in-public** postları X'te başlasın: haftada 2-3, gerçek sayılar.

## Faz 3 — Big launch (4.-5. hafta)

### Show HN (4. hafta, Salı-Perşembe 08:00 ET)
- Başlık hikâye anlatmalı, ürün değil: **"Show HN: I kept getting banned promoting my side projects, so I built a ban-risk-aware launch planner"**. Kişisel acı + zanaat = HN formülü. "AI-powered" kelimesini başlıkta KULLANMA.
- İlk yorumu sen yaz (hazırda beklesin): neden auto-posting yapmadığın (ilkesel), kataloğun nasıl curate edildiği, stack, öğrendiklerin. Teknik derinlik HN'de yorum üretir; yorum sıralama getirir.
- İlk 3 saat başında kal, her yoruma cevap. Launch Checker'ın login'siz olması HN'in "duvarsız demo" beklentisini karşılıyor — bunu ilk yorumda söyle.
- Sonuç ne olursa olsun: **kendi Launch Report'unu ertesi gün yayınla ve X/IH'de paylaş.** "Show HN bize 214 tık, 31 signup getirdi — işte kanıtı" postu, lansmanın ikinci dalgasıdır.

### Product Hunt (5. hafta, Salı 00:01 PT)
- HN ile aynı haftaya koyma; iki ayrı zirve daha değerli. Galeri: plan ekranı, ban-risk kartları, attribution grafiği. Maker comment'te HN launch report'una link ver (kanıt döngüsü).

## Faz 4 — Sürekli motor (6. haftadan itibaren, haftada 4-6 saat)

Haftalık ritim — hepsi zaten kurduğun altyapıyı kullanır:

1. **Intent farming (en yüksek ROI):** r/SaaS, r/startups, r/Entrepreneur, r/SideProject'te sürekli sorulan "where should I post my startup?", "how did you get first 100 users?" sorularına **önce gerçekten cevap ver** (3-4 kanal öner, kural uyarısı yap), sonunda "bunu araca çevirdim" de. Kendi Intent Radar'ın bu soruları sana bulsun — ürünün kendi pazarlamasını beslemesi tam moat hikâyen. Haftada 5-10 kaliteli cevap.
2. **SEO bileşik faizi:** 100+ kanal sayfası yayında; Search Console'da hangi sorgular geliyor izle, ayda 2-3 yeni "Where to launch a [dev tool / AI app / mobile app]" rehber sayfası ekle (katalogdan otomatik üretilebilir).
3. **Newsletter pitch'leri (kendi Pitch Engine'inle):** Console.dev (devtool review formatı birebir uyuyor), Hacker Newsletter (HN'de iyi giderse otomatik aday), Ben's Bites (AI açısı), TLDR (sponsorluk — paralıysa beklet). Haftada 1-2 pitch.
4. **Her ship'te mini-lansman:** kendi ürün ilkeni uygula — her feature release'i bir dağıtım fırsatı. GitHub Action'ın release'lere plan yorumu bırakıyor; kendi repo'nda da açık olsun (görenler sorar).
5. **Ayda 1 veri içeriği:** attribution verinden anonim bulgular ("dizinlerden gelen tıklamaların %X'i signup oluyor, HN'in yarısı ama daha kalıcı"). Bu postlar hem içerik hem benchmark özelliğinin reklamı. Veri büyüyünce → State of Developer Launches raporu (yayın altyapısı hazır).

## 3. ay: Relaunch

- Show HN ikinci atış (yeni büyük özellikle — ör. Intent Radar; HN relaunch'a 2-3 ay arayla tolere eder).
- PH'de "shoutout" güncellemesi; dizinlerde changelog güncellemeleri.

---

## Ölçüm ve gerçekçi beklentiler

- Tek gösterge tablosu: kendi Results ekranın. Her taktiğin tracked link'i var; haftada bir "ne işledi" bak, işlemeyeni bırak.
- Gerçekçi hedefler: beta 15-20 kullanıcı → soft launch toplam 100-300 tık → iyi geçen bir Show HN 2-10k tık / 50-300 signup arası geniş bir dağılım (medyan mütevazı; front page garantisi yok). İlk ödeme yapan 10 kullanıcı, ilk 1000 ziyaretçiden değerlidir — beta kullanıcılarıyla konuşmaya devam et.
- En kötü senaryo planı: HN tutmazsa (çoğu tutmaz) — 2 hafta sonra farklı açıyla r/SideProject + IH'ye devam, 3. ay farklı başlıkla HN'e dön. Dağıtım tek atış değil, ritim.

**Altın kural (kendi ürününün ilkesi):** hiçbir kanalda bot/otomasyon yok, her post elle ve topluluk kurallarına uygun. LaunchWake'in pazarlaması, LaunchWake'in felsefesinin kanıtı olmak zorunda — aksi ürünü öldürür.
