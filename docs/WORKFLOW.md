# LaunchWake — Uçtan Uca Ürün Workflow'u

*2026-07-03. Kaynak: kullanıcının çizdiği onboarding akışı + repo/docs analizi (PRD, ROADMAP, GROWTH_ANALYSIS_V3, mevcut `/lib` modülleri).*

## Çizimin analizi

Çizdiğin akış üç şeyi doğru yakalıyor:

1. **Girdi esnekliği** — repo VEYA açıklama; ikisi de proje profiline akmalı. Mevcut onboarding bunu kısmen yapıyor (URL veya GitHub).
2. **"Proje yayında mı?" dallanması** — bu, üründe bugün **olmayan** en değerli fikir. Mevcut ürün projenin canlı olduğunu varsayıyor; pre-launch kullanıcıyı (en aç, en ödemeye hazır segment) kapıda kaybediyoruz.
3. **Canlıysa commit/release analizi** — bu zaten yazılmış (`lib/github.ts` webhook → Ship, `lib/analysis.ts` buildPlan).

Eksik olan tek şey: HAYIR dalını "açıklamadan tanıtım hamleleri üret" diye tek kutu bırakmışsın. Aşağıda bunu para kazandıran tam bir **yaşam döngüsü durum makinesine** açıyorum.

---

## Durum makinesi (projenin yaşam döngüsü)

```
ONBOARDING → [yayında mı?] → PRE_LAUNCH → LAUNCH_DAY → LIVE (sürekli döngü)
                          └──────────── EVET ─────────────↗
```

Her durum farklı ekran seti, farklı görev üretimi, farklı satın alma anı demek. Proje modeline tek alan eklemek yeterli: `lifecycle: PRE_LAUNCH | LAUNCH_DAY | LIVE`.

---

## Faz 0 — Giriş ve profil çıkarma (onboarding)

**Hedef: time-to-first-plan < 3 dakika (golden rule #4).**

1. Girdi (herhangi biri yeter, ikisi birden daha iyi):
   - **Repo bağlandı** → `getRepoMeta` ile isim, açıklama, README, topics, homepage URL, son release/changelog otomatik çekilir. Kullanıcı sadece onaylar/düzeltir — form doldurmaz.
   - **Sadece açıklama + URL** → URL varsa landing page'den title/meta/OG scrape edilir; LLM açıklamayı zenginleştirir. Repo sonradan bağlanabilir (nudge: "repo bağla, ship'lerini otomatik yakalayalım").
2. **LLM profil çıkarımı** (`lib/llm.ts` üzerinden, zod-validated): kategori (devtool/SaaS/AI/consumer), hedef kitle (ICP), tek cümle pitch, karşılaştırılabilir ürünler. Bu profil hem plan kalitesini hem benchmark eşleşmesini besler.
3. **Yayında mı tespiti** — kullanıcıya sormadan önce otomatik tahmin et, sonra onaylat:
   - URL 200 dönüyor + signup/pricing sayfası var → muhtemelen LIVE
   - URL yok / "coming soon" / repo var ama site yok → muhtemelen PRE_LAUNCH
   - Tek soruluk onay: "LaunchWake nerede devreye girsin? ○ Henüz yayında değilim ○ Yayındayım"

**Fizibilite:** onboarding + repo meta mevcut; URL scrape + otomatik tespit küçük iş; profil çıkarımı `llm.ts` ile küçük iş.

---

## Faz A — PRE_LAUNCH modu (çizimindeki HAYIR dalı) ⭐ yeni, en büyük fırsat

Yayında olmayan founder'ın sorusu "nereye postlayayım?" değil, **"lansmana kadar ne yapayım?"**. Cevabı üç üründe topla:

### A1. Pre-launch distribution planı
Aynı plan motoru (`analysis.buildPlan`), katalogda `phase: PRE_LAUNCH` etiketli kanal alt kümesiyle:
- **Waitlist/ilgi toplama:** Product Hunt "Coming Soon", betalist, X/Bluesky build-in-public, IndieHackers ilerleme postları
- **Erken kayıt dizinleri:** AlternativeTo, SaaSHub vb. — lansman günü hazır olsun
- **Beta tester kanalları:** niş subreddit'ler (ban-risk notlu), ilgili Discord/Slack toplulukları
- Her öneri yine fit/ban-risk/timing/why formatında — hero ekran aynı, içerik faza göre değişiyor.

### A2. Launch-readiness checklist (D-day geri sayımı)
Kullanıcı hedef lansman tarihi seçer → `lib/queue.ts` mantığıyla **T-eksi görev planı** üretilir:
- T-14: landing + OG image + tracked signup pixel kur (attribution lansmandan ÖNCE hazır olsun)
- T-7: PH coming soon + dizin ön kayıtları + newsletter pitch taslakları (`lib/pitch.ts` hazır)
- T-3: HN/Reddit taslakları hazırla (`lib/drafts.ts` hazır), post-saat planı (`lib/launchday.ts` hazır)
- T-1: son kontrol (mevcut `lib/launchChecker.ts` kuralları burada yeniden kullanılır)
Haftalık digest'e (mevcut `lib/digest.ts`) "bu haftanın 3 pre-launch görevi" olarak düşer.

### A3. Waitlist attribution
Tracked link altyapısı (`lib/attribution.ts`) waitlist kayıtlarına bağlanır → founder lansmandan önce "build-in-public postum 23 waitlist kaydı getirdi" sayısını görür. **İlk "para veririm" anı burası** — henüz ürün yokken kanıt gösteriyoruz.

**Neden kullanıcı çeker / para verdirir:**
- Pre-launch founder'lar en yoğun arayışta olan segment ("how to launch on HN" aramalarının tamamı) — mevcut Launch Checker lead magnet'i doğrudan bu moda akar.
- **Launch Pass ($19, tek seferlik)** bu fazın doğal satın alma anı: 1 lansman, tam plan + countdown + cockpit + rapor. Sonra LIVE moduna geçince Pro'ya upgrade yolu. (V3 analizindeki paketleme önerisiyle birebir örtüşür.)

**Fizibilite:** kanal kataloğuna faz etiketi + countdown şablonu = orta iş. Motorların hepsi (plan, queue, pitch, drafts, launchday, attribution) mevcut — bu mod büyük ölçüde **mevcut parçaların yeniden dizilimi**.

---

## Geçiş — LAUNCH_DAY (T-0)

Countdown sıfırlanınca veya kullanıcı "bugün lansman" deyince:

1. `lib/launchday.ts` run-sheet'i saat sıralı checklist olarak açılır (erken → sabah → öğle...).
2. **Cockpit** (V3 #6): HN sıralaması/yorumlar canlı (HN API public), "ilk 30 dk'da şu yoruma cevap ver" koçluğu (`lib/coach.ts` mevcut), kanal kanal "postladım" işaretleme → tracked link üretimi.
3. Gün sonunda otomatik **Launch Report** (mevcut `lib/report.ts` / public report) — paylaşılabilir, viral yüzey.

**Fizibilite:** run-sheet + rapor mevcut; canlı HN takibi orta iş (radar polling altyapısı var).

---

## Faz B — LIVE modu (çizimindeki EVET dalı) — sürekli döngü

Çekirdek döngü (çoğu yazılmış durumda):

```
Ship tespiti → Analiz → Distribution Plan → Launch Kit → insan postlar
     ↑                                                        ↓
outcome re-ranking  ←  Results/attribution  ←  tracked links
```

1. **Ship tespiti**
   - Repo bağlı: webhook → release/commit → Ship (mevcut). Üzerine **anlamlılık filtresi** ekle: LLM sınıflandırması "bu ship duyurulmaya değer mi?" (typo-fix commit'lerle kullanıcıyı boğma). Küçük iş, retention'ı korur.
   - Repo yok: manuel ekleme + haftalık digest'te "bu hafta ne shipledin?" dürtmesi (`lib/reminders.ts` mevcut).
2. **Plan + drafts + tracked links + Results** — tamamı mevcut (hero).
3. **Sürekli değer katmanı** (lansmanlar arası churn'ü öldüren kısım — V3 öncelik sırası):
   - **Distribution Queue** (`lib/queue.ts` ✅): lansman sonrası 6 haftalık kampanya, haftalık 3 görev.
   - **Intent Radar** (`lib/intentRadar.ts` ✅): "senin ürününü arayan insanlar" → sıcak lead + ban-safe taslak cevap. En güçlü WTP tetiği.
   - **Newsletter Pitch Engine** (`lib/pitch.ts` ✅): küratöre kişisel pitch + takip hatırlatıcısı.
   - **Kategori benchmark'ları** (`lib/benchmarks.ts` ✅): Free'de bulanık/kilitli kart, Pro'da açık — paywall tetikleyicisi.
4. **Flywheel:** her attribution sonucu `ChannelStat`'a akar → benzer kategorideki ürünler için re-ranking (`lib/stats.ts`). Moat burası; zamanla kopyalanamaz hale gelir.

---

## Monetizasyon dokunuş noktaları (akışın içine gömülü)

| An | Tetik | Teklif |
|---|---|---|
| Public Launch Checker | 3 öneri gösterildi, gerisi kilitli | Signup |
| Pre-launch onboarding | Countdown planı oluşturuldu | **Launch Pass $19** |
| 2. plan limiti (Free) | En yüksek niyet anı | 7 günlük Pro trial, o anda |
| Kilitli kartlar (benchmark, radar, post-mortem) | Görünür ama bulanık | Pro $29 |
| Launch Day sonrası rapor | "Paylaş" anı | Rapor footer'ında viral link |
| Ajans / çoklu proje | 2. proje ekleme denemesi | Team (+white-label rapor) |

*(Fiyat rakamları mevcut plan yapından; fiyatlandırma kararları sana ait.)*

## Guardrails (her fazda geçerli — CLAUDE.md golden rules)

- **Asla auto-post yok.** Pre-launch dahil her görev "taslağı kopyala, kendin postla" biter.
- LLM kanal önerileri her fazda **seeded kataloğa kısıtlı** (uydurma subreddit = ban).
- Hero = plan + attribution; countdown ve cockpit bunları besler, scheduler'a dönüşmez.
- Her yeni ekran: empty/loading/loaded state + time-to-first-plan korunur.

## Yapım sırası önerisi (efor × etki)

1. **Lifecycle alanı + yayında-mı sorusu + otomatik tespit** (küçük) — çizimindeki dallanmayı ürüne sokar.
2. **PRE_LAUNCH kanal etiketleri + countdown queue** (orta) — mevcut queue/pitch/drafts/launchday parçalarının yeniden dizilimi.
3. **Launch Pass paketlemesi** (küçük) — pre-launch modunun para karşılığı.
4. **Ship anlamlılık filtresi** (küçük) — webhook gürültüsünü keser.
5. **Cockpit canlı HN takibi** (orta) — duygusal bağ + viral rapor.

İlk üçü birlikte, ürünü "launch aracı"ndan "lansmana hazırlanan VE yaşayan ürün" haline getirir — pre-launch kullanıcıyı yakalar, LIVE döngüsü (queue + radar) aboneliği ayakta tutar.
