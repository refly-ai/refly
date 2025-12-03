import { Helmet } from 'react-helmet';
import { useMemo } from 'react';

/**
 * Global SEO component that sets default TDK (Title, Description, Keywords)
 * for all pages. Individual pages can override these values using their own Helmet components.
 */
export const GlobalSEO = () => {
  // Build canonical and og:url from current location to avoid incorrect canonicalization.
  const { canonicalUrl, ogUrl } = useMemo(() => {
    const url = typeof window !== 'undefined' ? window?.location : undefined;
    const origin = url?.origin ?? 'https://refly.ai';
    const pathname = url?.pathname ?? '/';
    const canonical = `${origin}${pathname}`;
    return { canonicalUrl: canonical, ogUrl: canonical };
  }, []);

  const alternates = useMemo(() => {
    // Optional multi-language support via window.ENV.HREFLANGS
    // Expected: [{ lang: 'en', href: 'https://refly.ai/' }, { lang: 'zh-cn', href: 'https://refly.ai/zh/' }]
    const fromEnv = typeof window !== 'undefined' ? ((window as any)?.ENV?.HREFLANGS ?? []) : [];
    return Array.isArray(fromEnv) ? fromEnv : [];
  }, []);

  return (
    <Helmet>
      <link rel="canonical" href={canonicalUrl} />
      {alternates?.length > 0 &&
        alternates.map(
          (alt: { lang?: string; href?: string }, idx: number) =>
            alt?.lang &&
            alt?.href && (
              <link key={`alt-${idx}`} rel="alternate" hrefLang={alt.lang} href={alt.href} />
            ),
        )}
      <title>Refly.ai-Vibe Workflow for Non-Technical Users</title>
      <meta
        name="description"
        content="Refly.ai is the vibe workflow platform for non-technical users. Build, reuse, and share powerful AI workflows by prompt or visual canvas, with no coding required."
      />
      <meta
        name="keywords"
        content="Vibe workflow, Refly.ai, workflow template, no-code, AI automation"
      />
      {/* Open Graph meta tags */}
      <meta property="og:title" content="Refly.ai-Vibe Workflow for Non-Technical Users" />
      <meta
        property="og:description"
        content="Refly.ai is the vibe workflow platform for non-technical users. Build, reuse, and share powerful AI workflows by prompt or visual canvas, with no coding required."
      />
      <meta property="og:url" content={ogUrl} />
      {/* Twitter Card meta tags */}
      <meta name="twitter:title" content="Refly.ai-Vibe Workflow for Non-Technical Users" />
      <meta
        name="twitter:description"
        content="Refly.ai is the vibe workflow platform for non-technical users. Build, reuse, and share powerful AI workflows by prompt or visual canvas, with no coding required."
      />
    </Helmet>
  );
};
