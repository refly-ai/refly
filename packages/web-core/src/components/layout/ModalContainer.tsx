import { useState, useEffect, memo } from 'react';
import {
  useAuthStoreShallow,
  useSearchStoreShallow,
  useSubscriptionStoreShallow,
  useImportResourceStoreShallow,
  useCanvasOperationStoreShallow,
  useUserStoreShallow,
} from '@refly/stores';
import { InvitationCodeModal } from '../invitation-code-modal';
import { FormOnboardingModal } from '../form-onboarding-modal';
import { PureCopilotModal } from '../pure-copilot-modal';
import { LazyModal } from './LazyModal';

/**
 * ModalContainer - Isolated container for all app-level modals
 *
 * This component is intentionally separated from AppLayout to prevent
 * modal state changes from triggering re-renders of the main content area.
 *
 * Benefits:
 * - Modal state updates (like Ctrl+K for search) won't cause Canvas/content re-renders
 * - All modals are co-located for easier management
 */
export const ModalContainer = memo(() => {
  // Get global modal visibility states for lazy loading
  const { isSearchOpen } = useSearchStoreShallow((state) => ({ isSearchOpen: state.isSearchOpen }));
  const { loginModalOpen, verificationModalOpen, resetPasswordModalOpen } = useAuthStoreShallow(
    (state) => ({
      loginModalOpen: state.loginModalOpen,
      verificationModalOpen: state.verificationModalOpen,
      resetPasswordModalOpen: state.resetPasswordModalOpen,
    }),
  );
  const { subscribeModalVisible, claimedVoucherPopupVisible, earnedVoucherPopupVisible } =
    useSubscriptionStoreShallow((state) => ({
      subscribeModalVisible: state.subscribeModalVisible,
      claimedVoucherPopupVisible: state.claimedVoucherPopupVisible,
      earnedVoucherPopupVisible: state.earnedVoucherPopupVisible,
    }));
  const { importResourceModalVisible } = useImportResourceStoreShallow((state) => ({
    importResourceModalVisible: state.importResourceModalVisible,
  }));
  const { modalVisible, modalType } = useCanvasOperationStoreShallow((state) => ({
    modalVisible: state.modalVisible,
    modalType: state.modalType,
  }));

  const { showOnboardingSuccessAnimation } = useUserStoreShallow((state) => ({
    showOnboardingSuccessAnimation: state.showOnboardingSuccessAnimation,
  }));

  // Modal pre-load flags (triggered by keyboard shortcuts or specific interactions)
  const [shouldLoadBigSearch, setShouldLoadBigSearch] = useState(false);

  // Combine store visibility and preloading for each modal
  const isBigSearchShown = isSearchOpen || shouldLoadBigSearch;
  const isCanvasRenameShown = modalVisible && modalType === 'rename';
  const isCanvasDeleteShown = modalVisible && modalType === 'delete';
  const isDuplicateCanvasShown = modalVisible && modalType === 'duplicate';

  // Listen for keyboard events to preload BigSearchModal (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        setShouldLoadBigSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {/* Pre-loaded modals - load code when page loads */}
      <InvitationCodeModal />
      <FormOnboardingModal />
      <PureCopilotModal />

      {/* Lazy-loaded modals - only load code when needed */}
      <LazyModal
        visible={isBigSearchShown}
        loader={() =>
          import('@refly-packages/ai-workspace-common/components/search/modal').then((m) => ({
            default: m.BigSearchModal,
          }))
        }
      />

      <LazyModal
        visible={loginModalOpen}
        loader={() =>
          import('../../components/login-modal').then((m) => ({ default: m.LoginModal }))
        }
      />

      <LazyModal
        visible={verificationModalOpen}
        loader={() =>
          import('../../components/verification-modal').then((m) => ({
            default: m.VerificationModal,
          }))
        }
      />

      <LazyModal
        visible={showOnboardingSuccessAnimation}
        loader={() =>
          import('../onboarding-success-modal').then((m) => ({
            default: m.OnboardingSuccessModal,
          }))
        }
      />

      <LazyModal
        visible={resetPasswordModalOpen}
        loader={() =>
          import('../../components/reset-password-modal').then((m) => ({
            default: m.ResetPasswordModal,
          }))
        }
      />

      <LazyModal
        visible={subscribeModalVisible}
        loader={() =>
          import('@refly-packages/ai-workspace-common/components/settings/subscribe-modal').then(
            (m) => ({ default: m.SubscribeModal }),
          )
        }
      />

      <LazyModal
        visible={claimedVoucherPopupVisible}
        loader={() =>
          import('@refly-packages/ai-workspace-common/components/voucher').then((m) => ({
            default: m.ClaimedVoucherPopup,
          }))
        }
      />

      <LazyModal
        visible={earnedVoucherPopupVisible}
        loader={() =>
          import('@refly-packages/ai-workspace-common/components/voucher').then((m) => ({
            default: m.EarnedVoucherPopup,
          }))
        }
      />

      <LazyModal
        visible={importResourceModalVisible}
        loader={() =>
          import('@refly-packages/ai-workspace-common/components/import-resource').then((m) => ({
            default: m.ImportResourceModal,
          }))
        }
      />

      <LazyModal
        visible={isCanvasRenameShown}
        loader={() =>
          import('@refly-packages/ai-workspace-common/components/canvas/modals/canvas-rename').then(
            (m) => ({ default: m.CanvasRenameModal }),
          )
        }
      />

      <LazyModal
        visible={isCanvasDeleteShown}
        loader={() =>
          import('@refly-packages/ai-workspace-common/components/canvas/modals/canvas-delete').then(
            (m) => ({ default: m.CanvasDeleteModal }),
          )
        }
      />

      <LazyModal
        visible={isDuplicateCanvasShown}
        loader={() =>
          import(
            '@refly-packages/ai-workspace-common/components/canvas/modals/duplicate-canvas-modal'
          ).then((m) => ({ default: m.DuplicateCanvasModal }))
        }
      />
    </>
  );
});

ModalContainer.displayName = 'ModalContainer';
