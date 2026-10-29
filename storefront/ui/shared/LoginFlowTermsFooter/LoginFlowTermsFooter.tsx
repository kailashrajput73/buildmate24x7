import { Footer, Link } from './LoginFlowTermsFooter.styles';

export function LoginFlowTermsFooter() {
  return (
    <Footer>
      By continuing, you agree to our{' '}
      {/* Flutter: TapGestureRecognizer()..onTap = () {} — no action. */}
      <Link role="link" tabIndex={0} onClick={() => {}}>
        Terms of Services &amp; Privacy Policy
      </Link>
    </Footer>
  );
}
