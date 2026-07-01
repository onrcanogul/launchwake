import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";

type Variant = "primary" | "secondary" | "ghost";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "btn-p",
  secondary: "btn-s",
  ghost: "btn-gh",
};

type CommonProps = {
  variant?: Variant;
  large?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  children?: ReactNode;
  className?: string;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps & { href: string };

function classes(
  variant: Variant,
  large: boolean | undefined,
  className: string | undefined,
) {
  return ["btn", VARIANT_CLASS[variant], large ? "btn-lg" : "", className]
    .filter(Boolean)
    .join(" ");
}

export function Button(props: ButtonAsButton | ButtonAsLink) {
  if ("href" in props && props.href !== undefined) {
    const { variant = "secondary", large, icon, iconRight, children, className } =
      props;
    return (
      <Link href={props.href} className={classes(variant, large, className)}>
        {icon && <Icon name={icon} />}
        {children}
        {iconRight && <Icon name={iconRight} />}
      </Link>
    );
  }

  const {
    variant = "secondary",
    large,
    icon,
    iconRight,
    children,
    className,
    ...rest
  } = props;
  return (
    <button className={classes(variant, large, className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
      {iconRight && <Icon name={iconRight} />}
    </button>
  );
}
