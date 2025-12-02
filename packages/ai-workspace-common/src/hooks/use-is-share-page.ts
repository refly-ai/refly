import { useLocation } from 'react-router-dom';

export const usePublicAccessPage = () => {
  const location = useLocation();
  const isSharePage = location?.pathname?.startsWith('/share/') ?? false;
  const isPreviewPage = location?.pathname?.startsWith('/preview/') ?? false;
  const isArtifactGalleryPage = location?.pathname?.startsWith('/artifact-gallery') ?? false;
  const isUseCasesGalleryPage = location?.pathname?.startsWith('/use-cases-gallery') ?? false;
  const isAppPage = location?.pathname?.startsWith('/app/') ?? false;
  const isWorkflowTemplatePage =
    location?.pathname?.startsWith('/workflow-template/') ?? false;
  const isLoginPage = (location?.pathname ?? '') === '/login';
  return (
    isPreviewPage ||
    isSharePage ||
    isArtifactGalleryPage ||
    isUseCasesGalleryPage ||
    isAppPage ||
    isWorkflowTemplatePage ||
    isLoginPage
  );
};
