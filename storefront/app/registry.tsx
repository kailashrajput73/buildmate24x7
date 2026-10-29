'use client';
import { useServerInsertedHTML } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { ServerStyleSheet, StyleSheetManager } from 'styled-components';

/** Collects styled-components CSS during server rendering so pages arrive styled (Next.js app router recipe). */
export default function StyledComponentsRegistry({ children }: { children: ReactNode }) {
  const [sheet] = useState(() => new ServerStyleSheet());
  useServerInsertedHTML(() => {
    const styles = sheet.getStyleElement();
    sheet.instance.clearTag();
    return <>{styles}</>;
  });
  if (typeof window !== 'undefined') return <>{children}</>;
  return <StyleSheetManager sheet={sheet.instance}>{children}</StyleSheetManager>;
}
