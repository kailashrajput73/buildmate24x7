import styled from 'styled-components';

export const Frame = styled.div<{ $width?: number; $height?: number; $radius: number }>`
  width: ${({ $width }) => ($width != null ? `${$width}px` : '100%')};
  height: ${({ $height }) => ($height != null ? `${$height}px` : '100%')};
  border-radius: ${({ $radius }) => $radius}px;
  overflow: hidden;
  flex-shrink: 0;
`;

export const Img = styled.img<{ $fit: 'contain' | 'cover' }>`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: ${({ $fit }) => $fit};
`;

/** Neutral placeholder shown when a category / type has no image of its own. */
export const Placeholder = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  opacity: 0.7;
`;
