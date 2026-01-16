import { useState, useEffect, memo } from 'react';
import {
  useAuthStoreShallow,
  useSearchStoreShallow,
  useSubscriptionStoreShallow,
  useImportResourceStoreShallow,
  useCanvasOperationStoreShallow,
  useSiderStoreShallow,
  useUserStoreShallow,
} from '@refly/stores';
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
  const { showCanvasListModal, setShowCanvasListModal, showLibraryModal, setShowLibraryModal } =
    useSiderStoreShallow((state) => ({
      showCanvasListModal: state.showCanvasListModal,
      setShowCanvasListModal: state.setShowCanvasListModal,
      showLibraryModal: state.showLibraryModal,
      setShowLibraryModal: state.setShowLibraryModal,
    }));

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

  const {
    showOnboardingFormModal,
    showOnboardingSuccessAnimation,
    showInvitationCodeModal,
    hidePureCopilotModal,
    userProfile: profileForOnboarding,
  } = useUserStoreShallow((state) => ({
    showOnboardingFormModal: state.showOnboardingFormModal,
    showOnboardingSuccessAnimation: state.showOnboardingSuccessAnimation,
    showInvitationCodeModal: state.showInvitationCodeModal,
    hidePureCopilotModal: state.hidePureCopilotModal,
    userProfile: state.userProfile,
  }));

  const needOnboarding = profileForOnboarding?.preferences?.needOnboarding;
  const isPureCopilotVisible = !hidePureCopilotModal && !!needOnboarding;

  // 模态框预加载状态 (键盘快捷键或特定交互触发)
  const [shouldLoadBigSearch, setShouldLoadBigSearch] = useState(false);
  const [shouldLoadCanvasRename, setShouldLoadCanvasRename] = useState(false);
  const [shouldLoadCanvasDelete, setShouldLoadCanvasDelete] = useState(false);
  const [shouldLoadDuplicateCanvas, setShouldLoadDuplicateCanvas] = useState(false);

  // Combine store visibility and preloading for each modal
  const isBigSearchShown = isSearchOpen || shouldLoadBigSearch;
  const isCanvasRenameShown = (modalVisible && modalType === 'rename') || shouldLoadCanvasRename;
  const isCanvasDeleteShown = (modalVisible && modalType === 'delete') || shouldLoadCanvasDelete;
  const isDuplicateCanvasShown =
    (modalVisible && modalType === 'duplicate') || shouldLoadDuplicateCanvas;

  // 监听键盘事件，预加载 BigSearchModal (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        setShouldLoadBigSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 监听 CanvasListModal 和 LibraryModal 的状态变化
  useEffect(() => {
    if (showCanvasListModal || showLibraryModal) {
      // 当用户打开这些模态框时，预加载其他可能会用到的模态框
      setShouldLoadCanvasRename(true);
      setShouldLoadCanvasDelete(true);
      setShouldLoadDuplicateCanvas(true);
    }
  }, [showCanvasListModal, showLibraryModal]);

  return (
    <>
      {/* 懒加载模态框 - 只在需要时才加载代码 */}
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
        visible={showOnboardingFormModal}
        loader={() =>
          import('../form-onboarding-modal').then((m) => ({
            default: m.FormOnboardingModal,
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
        visible={showInvitationCodeModal}
        loader={() =>
          import('../invitation-code-modal').then((m) => ({
            default: m.InvitationCodeModal,
          }))
        }
      />

      <LazyModal
        visible={isPureCopilotVisible}
        loader={() =>
          import('../pure-copilot-modal').then((m) => ({ default: m.PureCopilotModal }))
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
        visible={showCanvasListModal}
        loader={() =>
          import('@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal').then(
            (m) => ({ default: m.CanvasListModal }),
          )
        }
        setVisible={setShowCanvasListModal}
      />

      <LazyModal
        visible={showLibraryModal}
        loader={() =>
          import('@refly-packages/ai-workspace-common/components/workspace/library-modal').then(
            (m) => ({ default: m.LibraryModal }),
          )
        }
        setVisible={setShowLibraryModal}
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
