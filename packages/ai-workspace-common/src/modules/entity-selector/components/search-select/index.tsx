import { useEffect, useRef, useState } from 'react';
import { Button, Divider, Input, Message, Select } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { SearchDomain } from '@refly/openapi-schema';
import { SelectProps } from '@arco-design/web-react/es/Select/interface';
import { DataFetcher } from '@refly-packages/ai-workspace-common/modules/entity-selector/utils';
import { useFetchOrSearchList } from '@refly-packages/ai-workspace-common/modules/entity-selector/hooks';
import { IconLoading, IconPlus } from '@arco-design/web-react/icon';
import { useDebouncedCallback } from 'use-debounce';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

interface SearchSelectProps extends SelectProps {
  domain: SearchDomain;
  fetchData?: DataFetcher;
  allowCreateNewEntity?: boolean;
}

export const SearchSelect = (props: SearchSelectProps) => {
  const { t } = useTranslation();
  const { domain, fetchData, allowCreateNewEntity = false, onChange, onSelect, ...selectProps } = props;

  const { loadMore, dataList, setDataList, isRequesting, handleValueChange, resetState, mode } = useFetchOrSearchList({
    domain,
    fetchData,
  });
  const refCanTriggerLoadMore = useRef(true);

  const [newEntityName, setNewEntityName] = useState('');

  const options = dataList?.map((item) => ({
    label: <span dangerouslySetInnerHTML={{ __html: item?.title }}></span>,
    value: item?.id,
  }));

  useEffect(() => {
    loadMore();
    return () => {
      resetState();
    };
  }, []);

  const popupScrollHandler = useDebouncedCallback((element: HTMLDivElement) => {
    // Don't trigger loadMore when in search mode
    if (mode === 'search') {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = element;
    const scrollBottom = scrollHeight - (scrollTop + clientHeight);

    if (scrollBottom < 10) {
      if (!isRequesting && refCanTriggerLoadMore.current) {
        loadMore();
        refCanTriggerLoadMore.current = false;
      }
    } else {
      refCanTriggerLoadMore.current = true;
    }
  }, 100);

  const [value, setValue] = useState<any>(undefined);
  const [popupVisible, setPopupVisible] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const handleCreateNewEntity = async () => {
    if (domain !== 'collection') {
      return;
    }

    setCreateLoading(true);
    const { data, error } = await getClient().createCollection({
      body: {
        title: newEntityName,
      },
    });
    setCreateLoading(false);

    if (!data || error) {
      Message.error(t('common.error.putErr'));
      return;
    }

    const { collectionId, title } = data.data;
    setDataList([{ id: collectionId, title, domain }, ...dataList]);
    setValue(collectionId);
    setPopupVisible(false);
    setNewEntityName('');
  };

  return (
    <Select
      size="large"
      allowClear
      showSearch
      placeholder={t(`entitySelector.placeholder.${domain}`)}
      filterOption={false}
      popupVisible={popupVisible}
      options={options}
      loading={isRequesting}
      onInputValueChange={(value) => {
        handleValueChange(value, [domain]);
      }}
      onClick={() => {
        if (props.disabled) return;
        setPopupVisible(!popupVisible);
      }}
      value={value}
      onChange={(value, option) => {
        setValue(value);
        if (props.mode !== 'multiple') {
          setPopupVisible(false);
        }
        if (onChange) {
          onChange(value, option);
        }
      }}
      onPopupScroll={popupScrollHandler}
      triggerProps={{ onClickOutside: () => setPopupVisible(false) }}
      dropdownRender={(menu) => (
        <div>
          {menu}
          {allowCreateNewEntity && (
            <>
              <Divider style={{ margin: 0 }} />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 12px',
                }}
              >
                <Input
                  allowClear
                  size="small"
                  style={{ marginRight: 8 }}
                  value={newEntityName}
                  onChange={(value) => setNewEntityName(value)}
                  onPressEnter={handleCreateNewEntity}
                />
                <Button
                  style={{ fontSize: 14, padding: '0 2px' }}
                  type="text"
                  size="mini"
                  onClick={handleCreateNewEntity}
                >
                  {createLoading ? <IconLoading /> : <IconPlus />}
                  {t(`entitySelector.createEntity.${domain}`)}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      {...selectProps}
    />
  );
};
