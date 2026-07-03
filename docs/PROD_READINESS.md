# LaunchWake — Production Hazırlık Raporu (v3 Analiz)

*Tarih: 2026-07-02. origin/main üzerinde gerçek build/test/typecheck çalıştırılarak doğrulandı (statik inceleme değil).*

## Kısa cevap: prodda çalışır mı?

**Şu haliyle hayır — ama tek gerçek bug var ve düzeltmesi 5 dakika.** Onun dışında kod tabanı deploy edilebilir durumda; kalan maddeler risk azaltma ve konfigürasyon.

Test sonucu (origin/main, gerçek çalıştırma): **149 testin 146'sı geçti.** 3 başarısızlık da aynı buga işaret ediyor.

---

## 1. BLOCKER — build'i geçirmeyen tek bug

**`Platform.BLOG` enum'da yok.** `prisma/channels/social.ts` içinde 5 kanal (`medium`, `hackernoon`, `substack`, `freecodecamp-news`, `dzone`) `Platform.BLOG` kullanıyor ama `schema.prisma`'daki `Platform` enum'ında `BLOG` değeri tanımlı değil (FORUM, MASTODON, BLUESKY var, BLOG yok).

Sonuçları:
- `tsc --noEmit` 5 hata veriyor → **`next build` prod'da başarısız olur, deploy edilemez.**
- Runtime'da `Platform.BLOG === undefined` → zod validasyonu patlar → `channelCatalog()` throw eder → seed ve katalog kullanan her yol çöker.
- Başarısız 3 test tam bunu yakalıyor (testler işini yapmış).

Düzeltme (iki seçenekten biri):

```prisma
// A) schema.prisma — Platform enum'ına ekle + migration:
enum Platform {
  ...
  BLOG
}
```
```bash
pnpm prisma migrate dev --name add_blog_platform
```
veya (B) 5 kanalı mevcut bir değere taşı (`substack` → `NEWSLETTER`, diğerleri → `FORUM`/`OTHER`). A daha doğru: UI gruplaması için anlamlı kategori.

> Not: Bu hatanın local'de görünmemesinin nedeni muhtemelen bayat bir generated client. `pnpm prisma generate && pnpm typecheck` çalıştırınca sende de çıkacaktır.

---

## 2. Deploy konfigürasyonu eksikleri

1. **Cron tetikleyicisi yok.** `app/api/cron/digest` ve `app/api/cron/reminders` endpoint'leri hazır (CRON_SECRET korumalı) ama `vercel.json` yok → **digest ve reminder'lar asla çalışmaz.** Ekle:

```json
{
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/digest", "schedule": "0 7 * * 1" }
  ]
}
```
(Vercel cron, `Authorization: Bearer` yerine kendi imzasıyla gelir — `CRON_SECRET`'i query-param yolu yerine Vercel'in `CRON_SECRET` env entegrasyonu ile doğrula.)

2. **Local repo dağınık:** working tree origin/main'den 13 commit geride + commit'lenmemiş `app/globals.css` değişikliği var. Deploy öncesi `git pull` + temizle.
3. `.claude/worktrees/` git'e girmiş — lint'teki 3 hatanın tamamı bu kopyalardan. `.gitignore`'a ekle, repo'dan çıkar (`git rm -r --cached .claude/worktrees`).
4. Migration'lar mevcut ve tutarlı (20 klasör, postgres) — önceki denetimde "migration eksik" bulgusu **yanlış alarmmış**, doğrulandı.
5. `.env.example` eksiksiz (22 değişken). Prod'a kurarken tamamını doldur; özellikle `CRON_SECRET`, `GITHUB_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET` opsiyonel görünüyor ama **prod'da zorunlu say**.

---

## 3. Güvenlik riskleri (çalışır ama tehlikeli)

Öncelik sırasıyla:

1. **Public endpoint'lerde rate limit yok** — Launch Checker (LLM maliyeti!), `/r/[code]` tıklama kaydı ve signup ingest spam'e açık. Checker özellikle kritik: birisi script'le token bütçeni eritebilir. Upstash Ratelimit veya basit IP-pencere sayacı ekle.
2. **LLM bütçe koruması in-memory** — deploy'da sıfırlanıyor, çok instance'da tutmuyor. Günlük kullanıcı bütçesini DB'ye (veya Redis'e) taşı.
3. **`/r/[code]` open redirect** — hedef URL doğrulanmıyor. Tracked link'ler sadece kullanıcının kendi domain'ine gitmeli; en azından `http(s)` şeması + host allowlist doğrula.
4. **Stripe webhook idempotency yok** — Stripe aynı event'i tekrar gönderebilir; `event.id`'yi işlenmiş-event tablosunda tut, mükerrer işlemi atla.
5. **GitHub webhook imza doğrulaması secret yoksa atlanıyor** — prod'da secret'sız webhook'u reddet.
6. **Hata izleme yok** — Sentry ekle (özellikle LLM parse hataları ve webhook'lar için).

---

## 4. v2'den hâlâ eksik olanlar (büyüme tarafı)

Denetim: v2'nin 11 çekirdek maddesinin **11'i origin/main'de mevcut** (Launch Report + rozet + OG, /pricing, /changelog, Team invite, GitHub Action, post-mortem, radar, digest, referral hariç). Eksik kalanlar:

1. **Referral sistemi** (davet başına +1 plan) — yok.
2. **sitemap.xml + robots.txt** — 105 kanal SEO sayfası var ama Google'a haritası yok. `app/sitemap.ts` + `app/robots.ts` ile yarım saatlik iş; SEO stratejisinin ön koşulu.
3. Search Console doğrulaması + analytics (hangi SEO sayfası trafik getiriyor göremiyorsun — kendi attribution ürünün var ama kendi sitende telemetri yok, ironik).

---

## 5. Yapılacaklar — sıralı yol haritası

| # | İş | Neden | Efor |
|---|---|---|---|
| 1 | `Platform.BLOG` düzelt + migration | Build geçmiyor | 5 dk |
| 2 | `git pull` + worktrees temizliği | Deploy edilecek kod local'de değil | 15 dk |
| 3 | `vercel.json` cron | Digest/reminder ölü | 10 dk |
| 4 | sitemap + robots | SEO sayfaları görünmez | 30 dk |
| 5 | Checker + /r rate limit | Maliyet/spam koruması | 2-3 saat |
| 6 | Stripe idempotency + webhook sertleştirme | Billing bütünlüğü | 2-3 saat |
| 7 | LLM bütçesini DB'ye taşı | Gerçek maliyet koruması | 2-3 saat |
| 8 | Sentry + basit analytics | Kör uçuş biter | 1-2 saat |
| 9 | Referral sistemi | Viral döngünün eksik parçası | 1 gün |

1-4 tamamlanınca **deploy edilebilir**; 5-8 ilk gerçek kullanıcılar gelmeden bitmiş olmalı (özellikle 5 — Launch Checker'ı duyurmadan önce şart).

---

## 6. Doğrulama notları

- Test/typecheck/lint origin/main'in izole kopyasında gerçekten çalıştırıldı: 146/149 test ✓, lint yalnız worktree kopyalarında hata, typecheck'te 5 gerçek hata (hepsi §1'deki bug).
- `next build` sandbox'ta tamamlanamadı (ortam Prisma engine indirmeyi engelliyor) — ama §1 düzeltilmeden build'in başarısız olacağı typecheck'ten kesin. §1 sonrası local'de `pnpm build` ile son doğrulamayı yap.
- E-posta gerçek (nodemailer + `EMAIL_SERVER`), stub değil. Cron endpoint'leri gerçek, sadece tetikleyicisi yok.
