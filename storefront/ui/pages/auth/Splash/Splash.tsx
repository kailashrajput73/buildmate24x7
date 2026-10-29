import { useEffect } from 'react';
import { useNavigate } from '@/ui/router';
import { useTheme } from 'styled-components';
import { CircularProgress } from '../../../shared/CircularProgress';
import { AppRoutes } from '../../../routes/appRoutes';
import { useSession } from '../../../session/SessionContext';
import mockData from '../../../mocks/mockData.json';
import splashMock from './Splash.mock.json';
import { Screen, Content, Spacer, Logo, Tagline, TaglineEmphasis, Version } from './Splash.styles';

const { appVersion, taglinePrefix, taglineEmphasis, splashDurationMs } = mockData.appConstants;

export function Splash() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { isLoggedIn } = useSession();

  // Flutter: wait splashDuration, then pushReplacementNamed(next).
  useEffect(() => {
    const timer = setTimeout(() => {
      const nextRoute = isLoggedIn ? AppRoutes.main : AppRoutes.login;
      navigate(nextRoute, { replace: true });
    }, splashDurationMs);
    return () => clearTimeout(timer);
    // Runs once, like initState().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen>
      <Content>
        <Spacer />
        <Logo src={splashMock.logo.src} alt={splashMock.logo.alt} />
        <Tagline>
          {taglinePrefix} <TaglineEmphasis>{taglineEmphasis}</TaglineEmphasis>
        </Tagline>
        <Spacer />
        <CircularProgress
          size={theme.spacing.space8}
          strokeWidth={3}
          color={theme.colors.primary}
          trackColor={theme.colors.primaryContainer}
        />
        <Version>{appVersion}</Version>
      </Content>
    </Screen>
  );
}
