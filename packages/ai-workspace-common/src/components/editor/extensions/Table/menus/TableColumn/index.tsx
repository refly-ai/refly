import { BubbleMenu as BaseBubbleMenu } from '@tiptap/react';
import React, { useCallback } from 'react';
import * as PopoverMenu from '../../ui/PopoverMenu';

import { Toolbar } from '../../ui/Toolbar';
import { isColumnGripSelected } from './utils';
import { Icon } from '../../ui/Icon';
import { MenuProps, ShouldShowProps } from '../../menus/types';
import { useTranslation } from 'react-i18next';

export const TableColumnMenu = React.memo(({ editor, appendTo }: MenuProps): JSX.Element => {
  const { t } = useTranslation();
  const shouldShow = useCallback(
    ({ view, state, from }: ShouldShowProps) => {
      if (!state) {
        return false;
      }

      return isColumnGripSelected({ editor, view, state, from: from || 0 });
    },
    [editor],
  );

  const onAddColumnBefore = useCallback(() => {
    editor.chain().focus().addColumnBefore().run();
  }, [editor]);

  const onAddColumnAfter = useCallback(() => {
    editor.chain().focus().addColumnAfter().run();
  }, [editor]);

  const onDeleteColumn = useCallback(() => {
    editor.chain().focus().deleteColumn().run();
  }, [editor]);

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="tableColumnMenu"
      updateDelay={0}
      tippyOptions={{
        appendTo: () => {
          return appendTo?.current;
        },
        placement: 'auto',
        popperOptions: {
          modifiers: [{ name: 'flip', enabled: false }],
        },
      }}
      shouldShow={shouldShow}
    >
      <Toolbar.Wrapper isVertical>
        <PopoverMenu.Item
          iconComponent={<Icon name="ArrowLeftToLine" />}
          label={t('editor.table.addColumnBefore')}
          onClick={onAddColumnBefore}
        />
        <PopoverMenu.Item
          iconComponent={<Icon name="ArrowRightToLine" />}
          label={t('editor.table.addColumnAfter')}
          onClick={onAddColumnAfter}
        />
        <PopoverMenu.Item
          icon="Trash"
          label={t('editor.table.deleteColumn')}
          className="!text-red-500"
          onClick={onDeleteColumn}
        />
      </Toolbar.Wrapper>
    </BaseBubbleMenu>
  );
});

TableColumnMenu.displayName = 'TableColumnMenu';

export default TableColumnMenu;
