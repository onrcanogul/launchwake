# LaunchWake — Go-Live / Domain Taşıma Checklist'i

*Tarih: 2026-07-02. Sıralama önemli: domain → entegrasyon URL'leri → e-posta → SEO → duyuru.*

## 0. Ön not
Local repo yine origin/main'den 14 commit geride — taşımaya başlamadan `git pull`. Deploy edilen kod zaten remote'ta olduğu için taşıma açısından sorun değil, ama local'de çalışırken şaşırtır.

## 1. Domain
- launchwake.com ilk tercih; yoksa .dev veya .sh (hedef kitle developer, ikisi de saygın). Satın al, WHOIS gizliliği aç.
- Vercel → Project → Domains: apex + www ekle. `launchwake.vercel.app` → yeni domaine 308 redirect (Vercel otomatik yönetir; eski paylaşılmış linkler ve tracked link'ler kırılmaz).

## 2. Uygulama konfigürasyonu (sırayla, yoksa login/billing kırılır)
1. **`APP_URL`** env'ini yeni domaine çek → redeploy. (Canonical, sitemap, OG image URL'leri, tracked link üretimi, magic link'ler buradan besleniyor.)
2. **GitHub OAuth App**: Homepage URL + Authorization callback URL'yi güncelle (`https://<domain>/api/auth/callback/github`). Bunu atlarsan GitHub login anında kırılır.
3. **`AUTH_URL`/`NEXTAUTH_URL`** (kullanılıyorsa) yeni domain.
4. **Stripe**: yeni domain için webhook endpoint ekle (eskisini bir hafta silme — geçiş sırasında iki endpoint birden dinlesin), `STRIPE_WEBHOOK_SECRET`'ı yeni endpoint'inkiyle güncelle. Checkout success/cancel URL'leri `APP_URL`'den geliyorsa otomatik düzelir, hardcoded ise tara.
5. **GitHub webhook'ları**: kullanıcı projelerine kayıtlı mevcut webhook'lar eski URL'i işaret ediyor olabilir — kayıtlı webhook URL'lerini güncelleyen küçük bir migration/script gerekir (şimdilik kullanıcı sayısı azken elle de olur).
6. **GitHub Action**: action'ın çağırdığı API base URL'i yeni domaine güncelle + yeni sürüm tag'le.

## 2.5 Veritabanı: schema migrate + katalog seed (ATLAMA — atlanınca "boş katalog" hatası verir)
Prod DB'de migration'lar uygulanmış olsa bile **katalog seed'i ayrı bir adımdır** ve unutulursa onboarding sonrası "Build distribution plan" şu hatayı verir: *"The channel catalog is empty — run `pnpm db:seed`"*.

1. **Migrate**: `pnpm db:migrate:deploy` (`prisma migrate deploy`) — yalnızca uygulanmamış migration'ları uygular, idempotent.
2. **Katalog seed'i (kritik)**: `Channel` tablosu ürünün intelligence asset'i (fixture değil). `seed.ts` upsert kullanır → tekrar çalıştırmak güvenli.
   ```bash
   # Pooler (pgbouncer, port 6543) DEĞİL, direct connection (port 5432) kullan.
   DATABASE_URL="<prod-direct-5432-url>" pnpm db:seed
   ```
   Not: seed'in Prisma client'ı `DATABASE_URL`'i okur (schema'daki `directUrl` yalnızca Prisma Migrate/CLI içindir), o yüzden **direct** URL'i doğrudan `DATABASE_URL`'e ver. ~105 kanal / 6 kategori yazar.
3. **Doğrula**: prod DB'de `SELECT count(*) FROM "Channel";` > 0 (≈105, platformlara yayılmış).
4. **Tek adım**: `pnpm db:release` = `prisma migrate deploy && tsx prisma/seed.ts`. Idempotent; her prod deploy'dan sonra elle çalıştırılabilir.

> **Neden Vercel build adımına otomatik seed koymadık:** Production ve Preview aynı `DATABASE_URL`'i paylaşıyor — seed'i `build`'e koymak, her preview deploy'unun da prod DB'ye yazmasına ve deploy başarısının DB erişilebilirliğine bağlanmasına yol açardı. Ayrıca migration'lar bilinçli olarak manuel tutuluyor. Bu yüzden seed, kontrollü bir manuel release adımı (bu madde) olarak kalıyor.

## 3. E-posta (magic link auth için kritik)
- Gönderimi kendi domaininden yap: `EMAIL_FROM` → `hello@<domain>`.
- DNS'e SPF + DKIM + DMARC kayıtlarını ekle (sağlayıcın — Resend/SES/SMTP — hepsinin kaydını verir). Bunsuz magic link'ler ve Monday digest spam'e düşer; login e-postayla olduğu için bu doğrudan aktivasyon problemi.
- `support@<domain>` veya `hello@<domain>` kutusunu gerçekten oku (Stripe dispute'ları da buraya gelsin).

## 4. SEO taşıması
- Search Console'a yeni domain property'si ekle, sitemap'i gönder.
- vercel.app zaten indexlendiyse 308 redirect otoriteyi taşır; ayrıca Search Console'da "Change of Address" kullanmaya gerek yok (vercel.app senin property'n değilse zaten yapamazsın — redirect yeter).
- `robots.txt` ve sitemap'in yeni domaini gösterdiğini deploy sonrası kontrol et (APP_URL'den türüyorsa otomatik).

## 5. Yasal / güven (Stripe live mode için fiilen şart)
- **Terms of Service + Privacy Policy** sayfaları (footer'a link). Stripe live aktivasyonu ve kullanıcı güveni için gerekli. KVKK/GDPR: analytics first-party olduğu için işin görece kolay; yine de privacy'de belirt.
- Stripe'ı test mode'dan **live mode**'a al: canlı API key'ler + canlı webhook secret + ürün/fiyatları live'da yeniden oluştur.

## 6. Operasyon güvenliği (ilk kullanıcılardan önce)
- **DB yedeği**: Postgres sağlayıcında (Neon/Vercel Postgres/Supabase her neyse) otomatik backup + point-in-time recovery açık mı, kontrol et.
- **Uptime monitor**: UptimeRobot/BetterStack ile `/` ve `/api/health` (yoksa basit bir health route ekle).
- **Sentry** hâlâ yoksa ekle — özellikle webhook ve LLM parse hataları için.
- Cron'ların yeni domainde çalıştığını Vercel → Crons ekranından ilk pazartesi doğrula.

## 7. Taşıma sonrası ilk hafta
1. Smoke test: signup (magic link + GitHub), plan üretimi, tracked link tıklaması, Stripe test alışverişi (canlıda küçük gerçek ödeme + refund).
2. Kendi lansmanını başlat — GROWTH_ANALYSIS_V2 §2'deki playbook: LaunchWake'i LaunchWake ile lansla, sonucu public Launch Report yap.
3. Dizin taraması (Uneed, Peerlist, DevHunt, SaaSHub...) — artık nihai domain'le.

---
**Özet sıra:** git pull → domain al/bağla → APP_URL + OAuth + Stripe + e-posta DNS → ToS/Privacy + Stripe live → smoke test → duyuru. Bu listede 1 günlük iş var; en riskli adımlar OAuth callback ve e-posta DNS'i (ikisi de login akışını etkiler).
