import { Helmet } from 'react-helmet';

/**
 * Global SEO component that sets default TDK (Title, Description, Keywords)
 * for all pages. Individual pages can override these values using their own Helmet components.
 */
export const GlobalSEO = () => {
  return (
    <Helmet>
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
      {/* Twitter Card meta tags */}
      <meta name="twitter:title" content="Refly.ai-Vibe Workflow for Non-Technical Users" />
      <meta
        name="twitter:description"
        content="Refly.ai is the vibe workflow platform for non-technical users. Build, reuse, and share powerful AI workflows by prompt or visual canvas, with no coding required."
      />
    </Helmet>
  );
};
