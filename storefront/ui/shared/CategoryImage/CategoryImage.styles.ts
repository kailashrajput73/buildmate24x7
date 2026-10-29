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

export const Fallback = styled.div<{ $background: string; $color: string; $size?: number }>`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $background }) => $background};
  color: ${({ $color }) => $color};

  i {
    font-size: ${({ $size, theme }) => $size ?? theme.spacing.space6}px;
  }
`;
