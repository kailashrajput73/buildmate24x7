import { useState } from 'react';
import { Frame, Img, Fallback } from './CategoryImage.styles';

interface CategoryImageProps {
  imageAsset: string;
  /** primeicons class used when the image is missing or fails to load. */
  fallbackIcon: string;
  fallbackIconColor: string;
  fallbackBackground: string;
  /** Omit to fill the parent. */
  width?: number;
  height?: number;
  iconSize?: number;
  radius?: number;
  fit?: 'contain' | 'cover';
}

/**
 * Flutter `CategoryImage` (local asset + icon fallback). Remote `imageUrl`
 * support is not ported — no screen converted so far uses it.
 */
export function CategoryImage({
  imageAsset,
  fallbackIcon,
  fallbackIconColor,
  fallbackBackground,
  width,
  height,
  iconSize,
  radius = 0,
  fit = 'cover',
}: CategoryImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showFallback = !imageAsset || failedSrc === imageAsset;

  return (
    <Frame $width={width} $height={height} $radius={radius}>
      {showFallback ? (
        <Fallback $background={fallbackBackground} $color={fallbackIconColor} $size={iconSize}>
          <i className={`pi ${fallbackIcon}`} aria-hidden="true" />
        </Fallback>
      ) : (
        <Img src={imageAsset} alt="" $fit={fit} onError={() => setFailedSrc(imageAsset)} />
      )}
    </Frame>
  );
}
