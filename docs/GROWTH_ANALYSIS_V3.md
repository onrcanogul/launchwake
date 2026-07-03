# LaunchWake — v3: "Buna Para Veririm" Dedirtecek Feature Analizi

*Tarih: 2026-07-02. Canlı site (launchwake.vercel.app) + repo incelemesi sonrası. MVP sağlam; bu doküman satın alma kararını tetikleyecek özelliklere odaklanır.*

## Temel teşhis: değer "patlamalı", abonelik "sürekli"

MVP'nin asıl ticari zayıflığı özellik eksikliği değil, **değer ritmi**. LaunchWake'in değeri lansman günlerinde patlıyor; ama $29/ay abonelik her ay değer ister. Bir founder yılda 4-6 kez lansman yapar — aradaki haftalarda ürünü açmıyorsa 2. ayda iptal eder. Bu yüzden aşağıdaki önerilerin ortak hedefi: **patlamalı değeri sürekli değere çevirmek** ve **karar anında kanıt göstermek**. İnsanlar analize değil, cevabını başka yerden alamadıkları sayılara ve zamandan tasarrufa para verir.

---

## 1. Intent Radar — "senin ürününü arayan insanlar" (en güçlü aday)

Reddit/HN/X'te kullanıcının ürününü tarif eden soruları yakala: "is there a tool that tracks which channel drove signups?", "alternative to X?". Eşleşince bildirim + insan-yazımı taslak cevap (ban-safe: kullanıcı kendi yazıp yanıtlar).

- **Neden para verdirir:** her uyarı = sıcak lead. "Bu ay Intent Radar'dan 4 müşteri geldi" cümlesi $29'u önemsizleştirir. GummySearch tarzı araçların tek başına $29-59/ay aldığı kanıtlanmış bir kategori.
- **Neden LaunchWake'e uygun:** launch radar altyapısı (HN/Reddit polling) zaten yazıldı; buna sorgu-eşleştirme + digest entegrasyonu eklemek görece küçük iş. Kanal istihbaratı moat'ının doğal uzantısı.
- **Paketleme:** Pro'ya dahil (3 sorgu), Team'de sınırsız. Landing'e ayrı bölüm: "Launches end. Conversations don't."
- Bonus: değeri **sürekli** — abonelik problemi tam kalbinden çözülür.

## 2. Kategori benchmark'ları — kilitli kanıt (paywall tetikleyicisi)

"Senin kategorindeki (devtool/SaaS/AI) ürünler medyan 34 signup aldı Show HN'den; r/SaaS'tan 6." Anonim aggregate outcome verisi — Free kullanıcıya bulanık/kilitli göster, Pro'da aç.

- **Neden para verdirir:** karar anında ("bu kanala mı yatırayım?") başka hiçbir yerde olmayan sayı. Kilitli veri, soyut "unlimited plans"ten çok daha güçlü paywall tetikleyicisidir.
- **Soğuk başlangıç çözümü:** ilk aylarda birinci parti veri az — HN/PH public API'lerinden (puan, yorum, ürün kategorisi) bootstrap et; kendi attribution verin biriktikçe harmanla. State of Launches raporu için toplanan veri zaten bu.

## 3. Distribution Queue — lansmanı 6 haftalık kampanyaya çevir

Tek "launch day" yerine otomatik sıralı kuyruk: 1. hafta dizinler (AlternativeTo, SaaSHub...), 2. hafta newsletter pitch'leri, 3. hafta niş subreddit, 3. ay Show HN relaunch, her release'te changelog kanalları. Haftalık digest'e "bu haftanın 3 görevi" olarak düşer.

- **Neden para verdirir:** "lansmanım bitti, şimdi ne yapacağım?" sorusunun cevabı sürekli üretilir; kullanıcı her hafta geri gelir → churn düşer → LTV artar. Katalogdaki 40+ "Anytime (queued)" kanalı zaten bu tasarımı çağırıyor.

## 4. Newsletter Pitch Engine

Katalogda 20+ newsletter var (TLDR, JS Weekly, Console.dev...) ama newsletter'a "post atılmaz", küratöre pitch atılır. Özellik: küratöre kişiselleştirilmiş pitch e-postası üret (ürün + o newsletter'ın formatına göre), gönderim takibi + takip hatırlatıcısı.

- **Neden para verdirir:** newsletter'lar devtool'lar için en yüksek kaldıraçlı kanal ama pitch yazmak herkesin ertelediği iş. "TLDR'a çıktım" tek başına aboneliği amorti eder. Draft altyapısı mevcut; kanal başına pitch şablonu eklemek orta iş.

## 5. Launch-Day Cockpit — lansman gününün canlı ekranı

Post yayına girince: HN sıralaması/yorum akışı canlı, "ilk 30 dakikada şu yoruma cevap ver, thread'in kaderini o belirliyor" koçluğu, saat bazlı görev listesi.

- **Neden para verdirir:** yılın en stresli gününde elinden tutan ürün duygusal bağ kurar; ekran görüntüsü paylaşılabilir (viral). Post-mortem koçluğunun (mevcut) canlı versiyonu — HN API ile fizibil.

## 6. Team/Ajans için white-label rapor

Public Launch Report zaten var; ajans logosuyla, müşteriye gönderilebilir haftalık PDF/link versiyonu. Team tier'ın ($87) gerçek satın alma gerekçesi olur: ajans bunu kendi müşterisine "bizim raporumuz" diye gönderir — LaunchWake ajansın arkasındaki motor olur.

---

## Paketleme / dönüşüm hızlı kazanımları (kod değil, kazanç)

1. **Kilitli özellikleri ürün içinde göster:** Free kullanıcı post-mortem'i, benchmark'ı, radar'ı bulanık kart olarak GÖRSÜN ("Unlock with Pro"). Görünmeyen özellik satmaz.
2. **Launch Pass ($19, tek seferlik):** abonelik istemeyen "tek lansmanlık" kullanıcıyı yakala — 1 ship, tam plan + cockpit + rapor, 30 gün. Sonra Pro'ya upgrade yolu. (Fiyatlandırma kararı sana ait; ben finansal danışman değilim, bu bir ürün-paketleme gözlemi.)
3. **Yıllık plan** (2 ay hediye) — bursty kullanım probleminin finansal sigortası.
4. **ROI dilini fiyat sayfasına taşı:** "Tek başarılı Show HN, bir yıllık Pro'dan fazlasını getirir" + gerçek launch report linki.
5. Pro deneme tetikleyicisi: 2. plan limitine takılan kullanıcıya o an 7 günlük Pro trial teklif et (limit anı = en yüksek niyet anı).

## Öncelik sırası (WTP etkisi × efor)

| # | Özellik | WTP tetiği | Süreklilik | Efor |
|---|---|---|---|---|
| 1 | Kilitli özellik görünürlüğü + trial tetiği | Yüksek | — | Düşük |
| 2 | Intent Radar | Çok yüksek | Çok yüksek | Orta (radar altyapısı hazır) |
| 3 | Distribution Queue | Yüksek | Çok yüksek | Orta |
| 4 | Newsletter Pitch Engine | Yüksek | Orta | Orta |
| 5 | Kategori benchmark (kilitli) | Çok yüksek | Orta | Orta-yüksek (veri bootstrap) |
| 6 | Launch-Day Cockpit | Orta-yüksek | Düşük (ama viral) | Orta |
| 7 | White-label rapor | Team tier için yüksek | Orta | Düşük-orta |
| 8 | Launch Pass + yıllık plan | Dönüşüm | — | Düşük |

**Önerilen sıra:** 1 → 2 → 3. Intent Radar "para veririm" anını yaratır, Queue aboneliği ayakta tutar, görünürlük düzeltmeleri ikisini de satar. Hepsi golden rules ile uyumlu: hiçbiri auto-posting değil, hepsi intelligence + attribution hero'sunu büyütüyor.
