'use client';
import { useEffect, useState } from 'react';
import { Frame, Img, Placeholder } from './CategoryImage.styles';

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
  /**
   * Show a neutral placeholder (background + [fallbackIcon]) when the backend has no image or it fails to load.
   * Used for categories and types. Without it the frame stays blank (product images, unchanged).
   */
  placeholder?: boolean;
}

/**
 * Shows only the image supplied by the backend — never local artwork or another item's image. Missing or
 * unavailable images stay blank, or show a neutral placeholder when [placeholder] is set.
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
  placeholder = false,
}: CategoryImageProps) {
  const usable = !!imageAsset && !imageAsset.includes('/files/mock/');
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [imageAsset]);
  const showImage = usable && !failed;
  return (
    <Frame $width={width} $height={height} $radius={radius} style={placeholder && !showImage ? { background: fallbackBackground } : undefined}>
      {showImage && <Img src={imageAsset} alt="" $fit={fit} onError={() => setFailed(true)} />}
      {placeholder && !showImage && (
        <Placeholder className="category-image-placeholder" aria-hidden="true">
          <i className={`pi ${fallbackIcon}`} style={{ color: fallbackIconColor, fontSize: iconSize ?? 20 }} />
        </Placeholder>
      )}
    </Frame>
  );
}
