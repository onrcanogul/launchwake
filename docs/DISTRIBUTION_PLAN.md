# LaunchWake — Tarihli Distribution Planı

*Oluşturma: 2026-07-07. Durum: go-live tamam, yayındayız → doğrudan Faz 1'den başlıyoruz.*
*Strateji kaynağı: `DISTRIBUTION_PLAYBOOK.md` (dört fazlı rampa). Bu doküman onun takvime dökülmüş, uygulanabilir hali. Her hafta sonunda ilgili satırı işaretle ve Results ekranındaki gerçek sayıları yaz.*

**Altın kural:** hiçbir kanalda bot/otomasyon yok; her post elle, topluluk kurallarına uygun. LaunchWake'in pazarlaması ürünün ilkesinin kanıtıdır.

---

## Hafta 0 — Hazırlık artıkları (7–12 Temmuz, bu hafta)

Faz 0'ın taşımayla paralel yapılacak işleri. Beta davetleriyle çakışabilir; hepsi bu hafta bitmeli çünkü sonraki her faz bunları kullanıyor.

- [ ] **Dogfood:** LaunchWake'i LaunchWake'e proje olarak ekle, kendi distribution planını üret. Ekran görüntüsü her postta kullanılacak.
- [ ] **Demo GIF/video (60 sn):** repo yapıştır → plan çıkar → ban riskini gör. Launch Checker akışının ekran kaydı + hızlandırma yeterli.
- [ ] **3 hazır cevap** (HN/Reddit için): "AI wrapper mı?" (katalog + outcome data), "insan kendisi yapamaz mı?" (zaman + ban riski + attribution), "verilerime ne oluyor?" (sadece metadata).
- [ ] **Kendi attribution'ını kur:** kullanacağın her kanal için tracked link üret. Hangi taktiğin işlediğini kendi ürününle ölçeceksin.
- [ ] Smoke test'i tekrarla: signup (magic link + GitHub), plan üretimi, tracked link tıklaması (GO_LIVE §7'den; yayın sonrası bir kez daha).

## Faz 1 — Sessiz beta (7–19 Temmuz, 1.–2. hafta)

**Hedef: 15–20 gerçek kullanıcı, 3–5 testimonial, ilk public Launch Report adayları.**

- [ ] WIP, Indie Hackers, r/SideProject'e davet tonu mesaj: "building this, looking for 10 founders about to launch — free Pro".
- [ ] Yakın zamanda GitHub'da release atmış 20–30 indie maintainer'a **elle, kişisel** mesaj; her birine kendi ürünleri için Launch Checker çıktısı ekle (mesajın kendisi demo). **Günde 10'u geçme.**
- [ ] Her beta kullanıcısından: ilk planını uygulasın + sonucu paylaşma izni ver(sin). Bunlar ilk public Launch Report'lar.
- [ ] Bug ayıklama: beta geri bildirimleri > yeni özellik. HN'den önce akış pürüzsüz olmalı.

**Çıkış kriteri:** ≥15 aktif kullanıcı, ≥3 testimonial, ≥2 paylaşilabilir Launch Report. Sağlanmadıysa Faz 2'yi bir hafta kaydır — dizinler kaçmaz.

## Faz 2 — Soft launch (20–26 Temmuz, 3. hafta)

Düşük risk, kalıcı backlink, damla trafik.

- [ ] **Dizin günü (tek günde toplu):** Uneed, Peerlist Launchpad, DevHunt, MicroLaunch, Fazier, BetaList, SaaSHub, Launching Next, StackShare, AlternativeTo ("Buffer alternative for founders who won't auto-post" açısı). Her birine ayrı tracked link.
- [ ] **Show IH:** hikâye formatı — "yan projemi 6 kez lansladım, 4'ünde sıfır kullanıcı; sorun post değil kanal seçimiymiş."
- [ ] **r/SideProject:** demo GIF + Launch Checker linki (login'siz olması burada altın).
- [ ] X'te build-in-public başlasın: haftada 2–3 post, beta'dan gerçek sayılarla.

**Hedef:** toplam 100–300 tık (dizinler + IH + Reddit).

## Faz 3a — Show HN (28–30 Temmuz arası bir gün, 4. hafta)

Salı–Perşembe, 08:00 ET. Aday günler: **28, 29 veya 30 Temmuz.**

- [ ] Başlık (hikâye, ürün değil): "Show HN: I kept getting banned promoting my side projects, so I built a ban-risk-aware launch planner". Başlıkta "AI-powered" YOK.
- [ ] İlk yorum hazırda beklesin: neden auto-posting yok (ilke), katalog nasıl curate edildi, stack, öğrenilenler + Launch Checker'ın login'siz olduğu.
- [ ] İlk 3 saat başında kal; her yoruma cevap.
- [ ] **Ertesi gün ne olursa olsun:** kendi Launch Report'unu yayınla, X/IH'de paylaş ("Show HN bize X tık, Y signup getirdi — işte kanıtı"). Bu ikinci dalga.

## Faz 3b — Product Hunt (4 Ağustos Salı, 00:01 PT, 5. hafta)

- [ ] HN ile aynı haftaya koyma (bilinçli olarak bir hafta sonra).
- [ ] Galeri: plan ekranı, ban-risk kartları, attribution grafiği.
- [ ] Maker comment'te HN Launch Report'una link (kanıt döngüsü).

## Faz 4 — Sürekli motor (10 Ağustos'tan itibaren, haftada 4–6 saat)

Haftalık ritim — pazartesi 1 saat planla, hafta içine dağıt:

1. **Intent farming (en yüksek ROI):** Intent Radar'ın bulduğu "where should I post my startup?" sorularına önce gerçekten cevap ver, sonda "bunu araca çevirdim". Haftada 5–10 kaliteli cevap.
2. **SEO:** Search Console sorgularını izle; ayda 2–3 yeni "Where to launch a [X]" rehber sayfası (katalogdan üretilebilir).
3. **Newsletter pitch'leri (kendi Pitch Engine'inle):** Console.dev, Hacker Newsletter (HN iyi gittiyse), Ben's Bites, TLDR (paralıysa beklet). Haftada 1–2.
4. **Her ship'te mini-lansman:** her feature release bir dağıtım fırsatı; kendi repo'nda GitHub Action açık olsun.
5. **Ayda 1 veri içeriği:** attribution'dan anonim bulgular → büyüyünce State of Developer Launches.

## 3. ay — Relaunch (Ekim 2026)

- [ ] Show HN ikinci atış (yeni büyük özellikle, ör. Intent Radar; farklı başlık).
- [ ] PH "shoutout" güncellemesi; dizin changelog'ları.

---

## Ölçüm

Tek gösterge: **kendi Results ekranın.** Her taktiğin tracked link'i var; her cuma "ne işledi" bak, işlemeyeni bırak.

| Faz | Gerçekçi hedef | Gerçekleşen |
|---|---|---|
| Beta (19 Tem) | 15–20 kullanıcı, 3–5 testimonial | |
| Soft launch (26 Tem) | 100–300 tık | |
| Show HN (30 Tem) | 2–10k tık / 50–300 signup (medyan mütevazı) | |
| Product Hunt (4 Ağu) | ikinci zirve + kalıcı backlink | |
| Ağustos sonu | ilk 10 ödeme yapan kullanıcı | |

**En kötü senaryo:** HN tutmazsa (çoğu tutmaz) → 2 hafta sonra farklı açıyla r/SideProject + IH; Ekim'de farklı başlıkla HN'e dön. Dağıtım tek atış değil, ritim.
