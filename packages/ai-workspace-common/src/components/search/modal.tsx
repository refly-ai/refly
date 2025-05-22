import { Modal } from 'antd';
import { Search } from './index';
import { useSearchStoreShallow } from '@refly-packages/ai-workspace-common/stores/search';
import { useEffect } from 'react';
import { bigSearchQuickOpenEmitter } from '@refly-packages/ai-workspace-common/utils/event-emitter/big-search-quick-open';

export const BigSearchModal = () => {
  const { isSearchOpen, setIsSearchOpen, resetState } = useSearchStoreShallow((state) => ({
    isSearchOpen: state.isSearchOpen,
    setIsSearchOpen: state.setIsSearchOpen,
    resetState: state.resetState,
  }));

  useEffect(() => {
    bigSearchQuickOpenEmitter.on('openSearch', () => {
      setIsSearchOpen(true);
    });

    bigSearchQuickOpenEmitter.on('closeSearch', () => {
      setIsSearchOpen(false);
    });
  }, [setIsSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) {
      resetState();
    }
  }, [isSearchOpen, resetState]);

  return (
    <Modal
      open={isSearchOpen}
      onCancel={() => setIsSearchOpen(false)}
      footer={null}
      closeIcon={null}
      styles={{
        mask: { background: 'transparent' },
        content: { background: 'transparent', top: '10%', width: 750 },
      }}
    >
      {isSearchOpen ? <Search showList /> : null}
    </Modal>
  );
};
