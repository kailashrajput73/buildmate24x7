import type { ReactNode } from 'react';
import mockData from '../../mocks/mockData.json';
import layoutMock from './AuthWebLayout.mock.json';
import {
  Shell,
  Main,
  BrandPanel,
  Orb,
  BrandHeader,
  BrandLogo,
  BrandName,
  BrandBody,
  Eyebrow,
  Tagline,
  TaglineEmphasis,
  Highlights,
  Highlight,
  HighlightIcon,
  HighlightTitle,
  HighlightSubtitle,
  BrandFooter,
} from './AuthWebLayout.styles';

const { appName, appVersion, taglinePrefix, taglineEmphasis } = mockData.appConstants;
const brandPanel = layoutMock._webBrandPanel;

interface AuthWebLayoutProps {
  children: ReactNode;
}

/**
 * Web-only (≥ md) frame for the auth screens: decorative brand panel on the
 * left, the screen itself on the right. Below md it renders the screen alone,
 * so the mobile layout is unchanged. No behaviour.
 */
export function AuthWebLayout({ children }: AuthWebLayoutProps) {
  return (
    <Shell>
      <BrandPanel aria-hidden="true">
        <Orb $size={420} $top="-140px" $left="55%" />
        <Orb $size={260} $top="70%" $left="-80px" />
        <BrandHeader>
          <BrandLogo src={brandPanel.logo} alt="" />
          <BrandName>{appName}</BrandName>
        </BrandHeader>
        <BrandBody>
          <Eyebrow>{brandPanel.eyebrow}</Eyebrow>
          <Tagline>
            {taglinePrefix}
            <TaglineEmphasis>{taglineEmphasis}</TaglineEmphasis>
          </Tagline>
          <Highlights>
            {brandPanel.highlights.map((item) => (
              <Highlight key={item.title}>
                <HighlightIcon>
                  <i className={item.icon} />
                </HighlightIcon>
                <div>
                  <HighlightTitle>{item.title}</HighlightTitle>
                  <HighlightSubtitle>{item.subtitle}</HighlightSubtitle>
                </div>
              </Highlight>
            ))}
          </Highlights>
        </BrandBody>
        <BrandFooter>
          © {appName} · {appVersion}
        </BrandFooter>
      </BrandPanel>
      <Main>{children}</Main>
    </Shell>
  );
}
