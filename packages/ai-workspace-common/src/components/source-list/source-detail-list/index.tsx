// styles
import './index.scss';
import { HiOutlineSearch, HiOutlinePlus } from 'react-icons/hi';
import { Divider, Input, Skeleton } from 'antd';
import { useState } from 'react';
import { Source } from '@refly/openapi-schema';

// 组件
import { SourceDetailItemWrapper } from './source-detail-item';
import classNames from 'classnames';

interface SourceDetailListProps {
  sources: Source[];
  isFetching?: boolean;
  classNames?: string;
  placeholder: string;
  searchKey?: string;
  showDesc?: boolean;
  showAdd?: boolean;
  small?: boolean;
  handleItemClick: (source: Source) => void;
}

export const SourceDetailList = (props: SourceDetailListProps) => {
  const { showAdd, small } = props;
  const [searchVal, _setSearchVal] = useState('');
  const [_visible, setVisible] = useState(false);

  const AddResourceBtn = (props: { style?: React.CSSProperties }) => {
    return (
      <div className="add-resource-btn" style={props.style} onClick={() => setVisible(true)}>
        <HiOutlinePlus />
      </div>
    );
  };

  return (
    <div
      className={classNames('knowledge-base-resource-list-container', props.classNames)}
      style={small ? { minWidth: 72, width: 72 } : {}}
    >
      {small ? (
        <div className="knowledge-base-resource-list-container-small">
          {showAdd && <AddResourceBtn />}
          <Divider />
        </div>
      ) : (
        <div className="source-detail-list-search-container">
          <div className="knowledge-base-directory-search-container-inner">
            <Input
              placeholder={props?.placeholder || ''}
              allowClear
              className="knowledge-base-directory-search"
              style={{ height: 32, borderRadius: '8px' }}
              value={searchVal}
              prefix={<HiOutlineSearch />}
              onChange={() => {}}
            />
            {showAdd && <AddResourceBtn />}
          </div>
        </div>
      )}
      <div className="source-detail-inner-list" style={small ? { minWidth: 72, width: 72 } : {}}>
        {props?.isFetching ? (
          <div style={{ margin: '8px auto' }}>
            <Skeleton active style={{ marginTop: 24 }} />
            <Skeleton active style={{ marginTop: 24 }} />
            <Skeleton active style={{ marginTop: 24 }} />
          </div>
        ) : (
          (props?.sources || []).map((item, index) => (
            <SourceDetailItemWrapper
              key={index}
              index={index}
              item={item}
              showDesc={props.showDesc}
              small={small}
              handleItemClick={props.handleItemClick}
            />
          ))
        )}
      </div>
    </div>
  );
};
