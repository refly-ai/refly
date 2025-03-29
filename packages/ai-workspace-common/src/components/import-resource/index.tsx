import { Menu, Divider, Splitter, Modal } from 'antd';
import { HiLink } from 'react-icons/hi';
import {
  ImportResourceMenuItem,
  useImportResourceStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/import-resource';

import { ImportFromWeblink } from './intergrations/import-from-weblink';
import { ImportFromText } from './intergrations/import-from-text';
import { ImportFromExtension } from './intergrations/import-from-extension';
import { useTranslation } from 'react-i18next';

import './index.scss';
import { useEffect, memo } from 'react';
import { getRuntime } from '@refly/utils/env';
import MultilingualSearch from '@refly-packages/ai-workspace-common/modules/multilingual-search';
import { TbClipboard, TbWorldSearch, TbBrowserPlus, TbFile } from 'react-icons/tb';
import { IconImportResource } from '@refly-packages/ai-workspace-common/components/common/icon';
import { ImportFromFile } from '@refly-packages/ai-workspace-common/components/import-resource/intergrations/import-from-file';

const MenuItem = Menu.Item;

export const ImportResourceModal = memo(() => {
  const { t } = useTranslation();
  const {
    importResourceModalVisible,
    setImportResourceModalVisible,
    selectedMenuItem,
    setSelectedMenuItem,
    setInsertNodePosition,
  } = useImportResourceStoreShallow((state) => ({
    importResourceModalVisible: state.importResourceModalVisible,
    setImportResourceModalVisible: state.setImportResourceModalVisible,
    selectedMenuItem: state.selectedMenuItem,
    setSelectedMenuItem: state.setSelectedMenuItem,
    setInsertNodePosition: state.setInsertNodePosition,
  }));

  const runtime = getRuntime();
  const isWeb = runtime === 'web';

  useEffect(() => {
    return () => {
      setInsertNodePosition(null);
    };
  }, [setInsertNodePosition]);

  return (
    <Modal
      open={importResourceModalVisible}
      centered
      footer={null}
      onCancel={() => {
        setImportResourceModalVisible(false);
      }}
      className="import-resource-modal"
      height={'70%'}
      width={'65%'}
      style={{
        minHeight: 500,
        maxHeight: 660,
        minWidth: '300px',
        maxWidth: '1050px',
      }}
    >
      <div className="import-resource-container">
        <Splitter>
          <Splitter.Panel collapsible={false} resizable={false} defaultSize={180}>
            {isWeb ? (
              <div className="import-resource-left-panel">
                <div className="left-panel-header">
                  <div className="left-panel-header-title">
                    <IconImportResource className="text-2xl" />
                    <span className="left-panel-header-title-text">
                      {t('resource.import.title')}
                    </span>
                  </div>
                  <Divider style={{ margin: '12px 0' }} />
                  <Menu
                    selectedKeys={[selectedMenuItem]}
                    onClick={(info) => {
                      setSelectedMenuItem(info.key as ImportResourceMenuItem);
                    }}
                  >
                    <MenuItem key="import-from-web-search">
                      <span className="flex items-center justify-center mr-2">
                        <TbWorldSearch className="text-base" />
                      </span>
                      {t('resource.import.fromWebSearch')}
                    </MenuItem>
                    <MenuItem key="import-from-file">
                      <span className="flex items-center justify-center mr-2">
                        <TbFile className="text-base" />
                      </span>
                      {t('resource.import.fromFile')}
                    </MenuItem>
                    <MenuItem key="import-from-weblink">
                      <span className="flex items-center justify-center mr-2">
                        <HiLink className="text-base" />
                      </span>
                      {t('resource.import.fromWeblink')}
                    </MenuItem>
                    <MenuItem key="import-from-paste-text">
                      <span className="flex items-center justify-center mr-2">
                        <TbClipboard className="text-base" />
                      </span>
                      {t('resource.import.fromText')}
                    </MenuItem>
                    <MenuItem key="import-from-extension">
                      <span className="flex items-center justify-center mr-2">
                        <TbBrowserPlus className="text-base" />
                      </span>
                      {t('resource.import.fromExtension')}
                    </MenuItem>
                  </Menu>
                </div>
              </div>
            ) : null}
          </Splitter.Panel>
          <Splitter.Panel collapsible={false} resizable={false}>
            <div className="import-resource-right-panel">
              {selectedMenuItem === 'import-from-weblink' ? <ImportFromWeblink /> : null}
              {selectedMenuItem === 'import-from-paste-text' ? <ImportFromText /> : null}
              {selectedMenuItem === 'import-from-web-search' ? <MultilingualSearch /> : null}
              {selectedMenuItem === 'import-from-extension' ? <ImportFromExtension /> : null}
              {selectedMenuItem === 'import-from-file' ? <ImportFromFile /> : null}
            </div>
          </Splitter.Panel>
        </Splitter>
      </div>
    </Modal>
  );
});

ImportResourceModal.displayName = 'ImportResourceModal';
