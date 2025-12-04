import { useLocation } from 'react-router-dom';

/**
 * Check if a pathname is a public access page
 * This pure function can be used in async contexts where hooks cannot be called
 */
export const isPublicAccessPageByPath = (pathname: string): boolean => {
  const isSharePage = pathname?.startsWith('/share/') ?? false;
  const isPreviewPage = pathname?.startsWith('/preview/') ?? false;
  const isArtifactGalleryPage = pathname?.startsWith('/artifact-gallery') ?? false;
  const isUseCasesGalleryPage = pathname?.startsWith('/use-cases-gallery') ?? false;
  const isAppPage = pathname?.startsWith('/app/') ?? false;
  const isWorkflowTemplatePage = pathname?.startsWith('/workflow-template/') ?? false;
  const isLoginPage = (pathname ?? '') === '/login';
  const isPricingPage = pathname === '/pricing';
  return (
    isPreviewPage ||
    isSharePage ||
    isArtifactGalleryPage ||
    isUseCasesGalleryPage ||
    isAppPage ||
    isWorkflowTemplatePage ||
    isLoginPage ||
    isPricingPage
  );
};

export const usePublicAccessPage = () => {
  const location = useLocation();
  return isPublicAccessPageByPath(location.pathname);
};
