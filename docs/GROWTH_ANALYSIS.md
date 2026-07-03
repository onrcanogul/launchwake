# LaunchWake — Büyüme ve Fonksiyonellik Analizi

*Tarih: 2026-07-01. Amaç: ürünü hem daha pazarlanabilir hem daha fonksiyonel hale getirip satışı kolaylaştıracak eklemeleri belirlemek.*

## Mevcut durum (özet)

MVP tamamlanmış ve production'a hazır: GitHub OAuth + magic link auth, "Where to Post" planı (fit skoru, ban riski, zamanlama), Launch Kit taslakları, attribution (takipli linkler → tıklama → signup), Stripe billing (Free / Pro $29), webhook ile ship algılama, hatırlatıcılar. Kod temiz, testler var.

Ürün güçlü ama **satılabilirliğin önündeki asıl engel ürün değil, gösterim katmanı**: pazarlama sitesi yok, sosyal kanıt yok ve moat'ı oluşturan veri (outcome data) kullanıcıya görünmüyor.

---

## A. Satışı kolaylaştıracak / reklamı yapan eklemeler

### 1. Gerçek bir landing page (en kritik eksik)
Kök sayfa `/app`'e yönlendiriyor; pazarlama sayfası sadece `mock/launchwake.html`. Yapılacaklar:

- `app/(marketing)/page.tsx`: hero'da ürünün asıl çıktısı — gerçek bir distribution planı ekran görüntüsü/canlı demo.
- Alt sayfalar: `/pricing`, `/changelog`, karşılaştırma sayfaları ("LaunchWake vs Buffer/Typefully" — "biz scheduler değiliz" konumlandırması SEO'da ayrıştırır).
- OG image otomasyonu: her plan için paylaşılabilir kart (aşağıdaki #3 ile birleşir).

### 2. Ücretsiz, login'siz "lead magnet" araçlar
Ürünün çekirdeği zaten var; ince bir dilimini açık web'e koy:

- **"Launch Checker"**: GitHub repo URL'si yapıştır → 3 kanallık mini plan + ban riski önizlemesi (LLM maliyeti düşük, rate-limitli). E-posta ile tam planı gönder → signup hunisi.
- **"Ban Risk Lookup"**: kanal kataloğundan kural/ban-riski sayfaları (`/channels/hacker-news`, `/channels/r-saas`). Her kanal bir SEO sayfası olur; "can I post my startup on r/SaaS" aramalarını yakalar. Katalog + `bansafety.ts` zaten mevcut — sadece public sayfa gerekiyor.

### 3. Ürünün kendisi reklam olsun (viral döngü)
- **Public "Launch Report"**: kullanıcı isterse plan sonuçlarını (kanal bazlı tıklama/signup grafiği) tek linkle paylaşabilsin — "Show HN'den 214 signup geldi" kartı. Founder'lar bu veriyi zaten Twitter'da paylaşmayı seviyor; her paylaşım logolu reklam.
- **"Powered by LaunchWake"** rozeti takipli linklerin yönlendirme sayfasında (Free planda).

### 4. Sosyal kanıt altyapısı
- Uygulama içi "başarı anı" tetikleyicisi: bir plan ilk 10 signup'ı geçince testimonial/tweet isteği göster.
- Landing'de gerçek aggregate metrik: "X planla Y signup atfedildi" (attribution verisi zaten var).

### 5. Kendi ilacını iç (dogfooding)
LaunchWake'in kendi lansmanını LaunchWake ile planla ve bunu case study olarak yayınla. En inandırıcı pazarlama materyali bu olur.

---

## B. Fonksiyonelliği artıracak eklemeler (satın alma gerekçesini güçlendirir)

### 1. Outcome-based re-ranking'i tamamla (moat burada)
`ChannelStat` dolduruluyor ama LLM önerileri geçmiş performansa göre yeniden ağırlıklandırmıyor ve `outcomeNote` UI'da görünmüyor. Bu, CLAUDE.md'de tanımlı moat'ın ta kendisi:

- `lib/channels.ts` re-ranking'i analysis prompt'una bağla ("bu kanaldan geçen sefer 40 tık / 0 signup geldi → düşür").
- UI'da "Neden bu kanal?" kartına geçmiş sonuç kanıtını ekle. **Satış cümlesi:** "Her lansmanda daha akıllanan plan."

### 2. Kanal kataloğunu büyüt (20 → 100+)
20 kanal demo için yeter, ödeme için dar. Discord/Slack toplulukları, newsletter'lar (TLDR, Hacker Newsletter), dizinler (AlternativeTo, BetaList), niş subredditler. Admin/seed pipeline'ı ekle. Katalog genişliği doğrudan fiyatlandırılabilir değer.

### 3. "Launch Day" görünümü
Plan var, taslak var — ama lansman günü kullanıcı ne yapacağını tek ekranda görmüyor. Zaman sıralı checklist: saat + kanal + taslağı kopyala + "postladım" işareti → reminder'larla entegre. Aktivasyonu ve retention'ı en çok artıracak ekran muhtemelen bu.

### 4. Attribution'ı derinleştir
- Signup webhook'una ek olarak kolay entegrasyonlar: Stripe (gelir atıfı — "bu kanal $X MRR getirdi" en güçlü satış grafiğidir), PostHog/GA import.
- Plan bazlı ROI özeti: "2 saatlik iş → 340 tık → 41 signup".

### 5. Rakip/benzer ürün sinyali
"Senin kategorindeki ürünler en çok şu kanallardan signup aldı" (anonim aggregate). Veri ağı etkisi: kullanıcı arttıkça öneri kalitesi artar → churn düşer.

### 6. Ekip planı (yeni fiyat kademesi)
Multi-user ertelenmiş; ama ajanslar ve DevRel ekipleri doğal ICP genişlemesi. Basit "seat" modeli + $79-99 Team tier, ARPU'yu yükseltir.

---

## Öncelik sırası (etki / efor)

| # | İş | Etki | Efor |
|---|---|---|---|
| 1 | Landing page + pricing | Çok yüksek | Düşük (mock zaten var) |
| 2 | Outcome re-ranking + kanıt UI | Çok yüksek (moat) | Orta |
| 3 | Public kanal/ban-risk SEO sayfaları | Yüksek | Düşük (veri hazır) |
| 4 | Launch Day ekranı | Yüksek (retention) | Orta |
| 5 | Login'siz Launch Checker | Yüksek (huni) | Orta |
| 6 | Paylaşılabilir Launch Report | Orta-yüksek (viral) | Orta |
| 7 | Katalog 100+ kanal | Orta | Orta |
| 8 | Stripe gelir atıfı | Orta | Orta |
| 9 | Team tier | Orta | Yüksek |

**Golden rules ile uyum:** Önerilerin hiçbiri auto-posting gerektirmiyor; hepsi "intelligence + attribution" hero'sunu güçlendiriyor. Lead magnet'ler ve SEO sayfaları mevcut katalog verisini yeniden kullanıyor — yeni moat riski yok.
