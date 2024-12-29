import { useEffect } from 'react';

import { Item } from './item';
import { RenderItem } from './type';
import classNames from 'classnames';

export function Home({
  data,
  activeValue,
  setValue,
}: {
  data: RenderItem[];
  displayMode: 'list' | 'search';
  activeValue: string;
  searchValue: string;
  setValue: (val: string) => void;
  showItemDetail: boolean;
}) {
  useEffect(() => {
    setValue('refly-built-in-ask-ai');
  }, []);

  return (
    <>
      {data?.map((item, index) => (
        <Item
          key={index}
          className={classNames(item?.isSelected ? 'selected' : '', 'search-res-item')}
          value={`${item?.data?.data?.title}__${item?.data?.data?.entityId}`}
          activeValue={activeValue}
          onSelect={() => {
            item?.onItemClick(item.data);
          }}
        >
          <span className="search-res-icon">{item?.icon}</span>
          <div className="search-res-container">
            <p
              className="search-res-title"
              dangerouslySetInnerHTML={{ __html: item?.data?.data?.title }}
              title={item?.data?.data?.title.replace(/<[^>]*>/g, '')}
            ></p>
          </div>
        </Item>
      ))}
    </>
  );
}
