import { type ReactElement, type ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface RedirectRule {
  when: () => boolean;
  redirectTo: string;
}

// use case for auto redirect
const REDIRECT_RULES: RedirectRule[] = [
  {
    when: () => /^\/pricing/.test(window.location.pathname),
    redirectTo: '/home',
  },
];

export function RedirectSuspense({ children }: { children: ReactNode }): ReactElement {
  const navigate = useNavigate();
  const redirectRule = REDIRECT_RULES.find((rule) => rule.when());
  useEffect(() => {
    if (!redirectRule) {
      return;
    }
    navigate(redirectRule.redirectTo);
  }, [redirectRule, navigate]);

  if (redirectRule) {
    return <></>;
  }
  return <>{children}</>;
}
