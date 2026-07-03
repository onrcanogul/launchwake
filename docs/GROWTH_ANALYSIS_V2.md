# LaunchWake — Büyüme Analizi v2: Sonraki Dalga + Kullanıcı Kazanım Playbook'u

*Tarih: 2026-07-02. v1'deki (GROWTH_ANALYSIS.md) maddelerin denetiminden sonra yazıldı.*

## 0. Denetim sonucu: v1'den kalan işler

Önce acil bir not: **local branch origin/main'den 5 commit geride.** Launch Checker, public kanal SEO sayfaları, Launch Day checklist, Stripe gelir atıfı, Team tier ve 105 kanallık katalog origin/main'de hazır ama local'de yok. İlk iş: merge + deploy.

v1'den hâlâ eksik olanlar (hepsi düşük efor, yüksek kaldıraç):

1. **Public Launch Report + "Powered by LaunchWake" rozeti** — viral döngünün kalbi, henüz yok. En öncelikli eksik.
2. **Bağımsız /pricing ve /changelog sayfaları** — pricing landing içinde gömülü; ayrı URL'ler hem SEO hem reklam hedef sayfası için gerekli.
3. **Plan başına OG image** — paylaşılan her plan/rapor linki Twitter/LinkedIn'de zengin kart olarak açılmalı (`@vercel/og` ile ucuz).
4. **Team invite UI** — seat modeli hazır, davet akışı yok; Team tier satılamaz durumda.

---

## 1. Yeni ürün eklemeleri (v2 dalgası)

### 1.1 GitHub Action + Marketplace listing (dağıtım kanalı olarak ürün)
Release atıldığında PR/release'e otomatik yorum: "Distribution plan hazır → link". İki değeri var: ürünü developer iş akışının içine gömer (retention) ve **GitHub Marketplace'in kendisi bir kullanıcı kazanım kanalıdır** — hedef kitle (release atan founder'lar) tam orada. Webhook altyapısı zaten var; Action ince bir sarmalayıcı.

### 1.2 Launch post-mortem ("neden tutmadı?")
Plan sonrası ikinci LLM analizi: post metni + tıklama/signup verisi + kanal kuralları → "başlığın soru formatında olsaydı", "yanlış saat", "ilk yorumu sen yazmadın" gibi somut teşhis. Attribution verisi zaten toplanıyor; bu onu koçluğa çevirir. Pro'yu gerekçelendiren en güçlü özellik adayı — rakiplerin kopyalayamayacağı kısım outcome verisi.

### 1.3 Rakip lansman radarı
Kullanıcının kategorisindeki ürünlerin HN/PH/Reddit lansmanlarını izle: "rakibin X dün Show HN'de 180 puan aldı, şu açıyla gitti". Haftalık digest e-postasına girer (bkz. 1.4). Veri kaynağı: HN/PH public API'leri — ucuz.

### 1.4 Haftalık "Distribution Digest" e-postası (retention motoru)
Her pazartesi: geçen haftanın tıklama/signup özeti + "bu hafta ne yapmalısın" (yeni ship yoksa: eski postu güncelle, şu kanalda follow-up at). SaaS'ta churn sessizlikten gelir; digest kullanıcıyı geri getirir. `lib/notify.ts` + cron yeterli.

### 1.5 "State of Developer Launches" veri raporu (yıllık içerik varlığı)
Anonim aggregate veri: hangi kanal hangi kategoride kaç signup getiriyor, en iyi saatler, ban oranları. Yılda 1-2 kez rapor → backlink mıknatısı, basın malzemesi, SEO otoritesi. 105 kanallık katalog + attribution verisi bunun hammaddesi.

### 1.6 Şablon/starter entegrasyonları
Vercel template, Supabase launch week örneği, `create-t3-app` topluluğu gibi founder'ların ürün kurduğu yerlere hazır entegrasyon örnekleri. Düşük öncelik ama bedava görünürlük.

---

## 2. Kullanıcı kazanım playbook'u ("nasıl kullanıcı farmlarız")

Sıralama önemli: önce dönüşüm hunisi sağlam olmalı (landing ✓, Launch Checker ✓ — deploy edilince), sonra trafik.

### Hafta 1-2: Kendi ilacını iç
- LaunchWake'i **LaunchWake ile** lansla. Ürün kendi planını üretsin: Show HN, Product Hunt, r/SaaS, Indie Hackers, dev.to. Sonuçları public Launch Report olarak yayınla → hem case study hem viral örnek.
- Her kanalda hikâye aynı: "Auto-posting yasağı olan, ban'dan koruyan distribution co-pilot" — karşı-konumlandırma (anti-spam) dikkat çeker.

### Sürekli: Ücretsiz araç dağıtımı (Launch Checker)
- Checker linkini imza gibi kullan: Indie Hackers / r/SideProject / HN "what are you working on" başlıklarında **yardım ederken** paylaş (link spam değil — önce soruya cevap, sonra araç).
- Checker çıktısının sonuna e-posta yakalama zaten var → huni: araç → e-posta → onboarding dripi (3 e-posta: plan örneği, ban hikâyesi, Pro teklifi).

### Sürekli: Programatik SEO
- 105 kanal sayfası canlıya alınınca Google Search Console + sitemap. Hedef sorgular: "how to post on r/SaaS without getting banned", "best time to post Show HN".
- Ek sayfa şablonları: "Where to launch a [dev tool / SaaS / mobile app]" (kategori × kanal matrisi — katalogdan otomatik üretilebilir).

### Tek seferlik: Dizin taraması
Product Hunt, BetaList, Uneed, Peerlist, DevHunt, AlternativeTo, SaaSHub, There's An AI For That + 50 kadar küçük dizin. Bir günlük iş, kalıcı backlink + damla trafik. (Bu listeyi LaunchWake kataloğuna da ekle — ürün kendi kanalını önersin.)

### Sürekli: Build in public
Haftada 2-3 X/Twitter + Indie Hackers postu: gerçek metrikler ("bu hafta 3 kanaldan 47 signup, en iyisi sürpriz şekilde Lobsters"). Attribution verin zaten bu içeriği üretiyor — digest e-postasından public post üretmek tek tık olabilir (ürün özelliği fikri: "share this week").

### Dikkatli: Sıcak outreach
GitHub'da yeni release atan open-source/indie maintainer'lara kişiselleştirilmiş mesaj: ürünleri için hazır mini plan linki ("v2.1'in için 3 kanal önerisi çıkardım, bak istersen"). Günde 10-15, elle, samimi. Spam'e kaçarsa marka anti-spam konumlandırmasıyla çelişir — ölçülü tut.

### Yapısal: Viral döngüler
- Public Launch Report + rozet (bkz. §0.1) — her paylaşılan rapor reklam.
- Referral: davet başına +1 plan/ay (Free kullanıcıya). Basit, entitlement sistemi zaten var.

### Ölçüm (haftalık bakılacak 4 sayı)
1. Checker kullanımı → signup dönüşümü (huni sağlığı)
2. Time-to-first-plan (aktivasyon)
3. Hafta 2 geri dönüş oranı (retention — digest'in işi)
4. Kanal bazlı signup (kendi attribution'ınla — hangi farming taktiği işliyor)

---

## 3. Öncelik sırası

| # | İş | Tür | Etki | Efor |
|---|---|---|---|---|
| 1 | origin/main'i merge + deploy | Altyapı | Bloklayıcı | Çok düşük |
| 2 | Public Launch Report + rozet + OG image | Viral | Çok yüksek | Orta |
| 3 | Kendi lansmanın (dogfood) + case study | Acquisition | Çok yüksek | Düşük |
| 4 | /pricing, /changelog ayrı sayfalar | SEO/Ads | Yüksek | Düşük |
| 5 | Dizin taraması (~60 dizin) | Acquisition | Orta | Düşük |
| 6 | Haftalık digest e-postası | Retention | Yüksek | Orta |
| 7 | GitHub Action + Marketplace | Kanal | Yüksek | Orta |
| 8 | Launch post-mortem | Ürün/Pro | Yüksek | Orta-yüksek |
| 9 | Team invite UI | Gelir | Orta | Orta |
| 10 | Rakip radarı + State of Launches raporu | İçerik | Orta | Yüksek |

**Golden rules uyumu:** hiçbir madde auto-posting içermiyor; GitHub Action yalnızca plan linki yorumlar, post atmaz. Outreach önerisi elle ve kişisel — bot değil.
