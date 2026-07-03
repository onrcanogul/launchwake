import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/Icon";

/**
 * "Powered by LaunchWake" badge — the doorway back into the product. Rendered on
 * every public report; also available as an embeddable SVG at /api/badge.
 */
export function PoweredByLaunchWake({ refSource }: { refSource?: string }) {
  const href = refSource ? `/?ref=${encodeURIComponent(refSource)}` : "/";
  return (
    <Link href={href} className="poweredby" aria-label="Powered by LaunchWake">
      <Icon name="wave" />
      <span className="pb-lab">
        <span className="pb-sm">POWERED BY</span>
        <span className="pb-nm">LaunchWake</span>
      </span>
    </Link>
  );
}
