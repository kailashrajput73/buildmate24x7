import { Badge, ImageCircle, Image, IconCircle } from './LoginFlowIconBadge.styles';

/** Flutter asserts `icon != null || imageAsset != null`. */
type LoginFlowIconBadgeProps = { size?: number } & (
  | { imageSrc: string; imageAlt?: string; icon?: never }
  | { icon: string; imageSrc?: never; imageAlt?: never }
);

/**
 * Rounded accent icon badge used to soften headers across the auth flow.
 * `icon` is a PrimeIcons class (e.g. `pi pi-user`).
 */
export function LoginFlowIconBadge({
  imageSrc,
  imageAlt = '',
  icon,
  size = 64,
}: LoginFlowIconBadgeProps) {
  return (
    <Badge $size={size}>
      {imageSrc !== undefined ? (
        <ImageCircle $size={size}>
          <Image src={imageSrc} alt={imageAlt} />
        </ImageCircle>
      ) : (
        <IconCircle $size={size}>
          <i className={icon} aria-hidden="true" />
        </IconCircle>
      )}
    </Badge>
  );
}
