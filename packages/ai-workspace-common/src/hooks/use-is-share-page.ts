import { useLocation } from 'react-router-dom';

export const usePublicAccessPage = () => {
  const location = useLocation();
  const isSharePage = location?.pathname?.startsWith('/share/') ?? false;
  const isArtifactGalleryPage = location?.pathname?.startsWith('/artifact-gallery') ?? false;
  const isUseCasesGalleryPage = location?.pathname?.startsWith('/use-cases-gallery') ?? false;
  return isSharePage || isArtifactGalleryPage || isUseCasesGalleryPage;
};
