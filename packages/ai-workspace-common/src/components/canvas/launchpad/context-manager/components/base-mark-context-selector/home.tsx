import { useEffect } from 'react';

import { Item } from './item';
import { RenderItem } from './type';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import classNames from 'classnames';

export function Home({
  data,
  activeValue,
  setValue,
}: {
  data: RenderItem[];
  activeValue: string;
  setValue: (val: string) => void;
  showItemDetail: boolean;
}) {
  useEffect(() => {
    setValue('refly-built-in-ask-ai');
  }, [setValue]);

  return (
    <>
      {data?.map((item) => (
        <Item
          key={item.data.entityId}
          className={classNames(
            item?.isSelected ? 'selected' : '',
            'search-res-item dark:text-gray-200 dark:hover:bg-gray-700 items-center',
          )}
          value={`${item?.data?.title}__${item?.data?.entityId}`}
          activeValue={activeValue}
          onSelect={() => {
            item?.onItemClick?.(item.data);
          }}
        >
          <NodeIcon type={item.type} filename={item?.data?.title} filled={false} iconSize={14} />
          <div className="search-res-container">
            <p
              className="search-res-title dark:!text-gray-200"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: trust server highlights
              dangerouslySetInnerHTML={{ __html: item?.data?.title ?? '' }}
              title={item?.data?.title?.replace(/<[^>]*>/g, '')}
            />
          </div>
        </Item>
      ))}
    </>
  );
}
