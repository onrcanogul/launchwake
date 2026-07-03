import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TEAM_PRICE_PER_SEAT_CENTS, TEAM_MIN_SEATS } from "@/lib/billing";

const TEAM_FROM = (TEAM_PRICE_PER_SEAT_CENTS * TEAM_MIN_SEATS) / 100;
const TEAM_PER_SEAT = TEAM_PRICE_PER_SEAT_CENTS / 100;

/**
 * The Free / Pro / Team cards — one source of truth, shared by the landing hero
 * and the standalone /pricing page so they never drift. Copy is localized; the
 * prices/seat math come from `lib/billing`.
 */
export async function PricingCards({ ctaHref = "/login" }: { ctaHref?: string }) {
  const t = await getTranslations("PricingCards");
  const freeFeatures = t.raw("free.features") as string[];
  const proFeatures = t.raw("pro.features") as string[];
  const teamFeatures = t.raw("team.features") as string[];

  return (
    <div className="lp-price">
      <div className="lp-pc">
        <div className="lp-pc-name">{t("free.name")}</div>
        <div className="lp-p">
          {t("free.price")} <small>{t("free.period")}</small>
        </div>
        <p className="lp-pc-desc">{t("free.desc")}</p>
        <ul>
          {freeFeatures.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <Link href={ctaHref} className="btn btn-s btn-lg">
          {t("free.cta")}
        </Link>
      </div>
      <div className="lp-pc hi">
        <span className="lp-pc-badge">{t("pro.badge")}</span>
        <div className="lp-pc-name">{t("pro.name")}</div>
        <div className="lp-p">
          {t("pro.price")} <small>{t("pro.period")}</small>
        </div>
        <p className="lp-pc-desc">{t("pro.desc")}</p>
        <ul>
          {proFeatures.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <Link href={ctaHref} className="btn btn-p btn-lg">
          {t("pro.cta")}
        </Link>
      </div>
      <div className="lp-pc">
        <div className="lp-pc-name">{t("team.name")}</div>
        <div className="lp-p">
          ${TEAM_FROM} <small>{t("team.period")}</small>
        </div>
        <p className="lp-pc-desc">
          {t("team.desc", { perSeat: TEAM_PER_SEAT, minSeats: TEAM_MIN_SEATS })}
        </p>
        <ul>
          {teamFeatures.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <Link href={ctaHref} className="btn btn-s btn-lg">
          {t("team.cta")}
        </Link>
      </div>
    </div>
  );
}
