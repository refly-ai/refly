import { CheckSquare, Code, Heading1, ImageIcon, List, Text, TextQuote } from 'lucide-react';
import { createSuggestionItems, Command, renderItems } from '../core/extensions';
import { createUploadFn } from './image-upload';
import Magic from './ui/icons/magic';
import { editorEmitter } from '@refly-packages/utils/event-emitter/editor';
import { Editor, Range } from '@tiptap/core';
import i18next from 'i18next';
import { IconTable } from '@refly-packages/ai-workspace-common/components/common/icon';

export const configureSuggestionItems = (param: { entityId: string; entityType: string }) => {
  const t = (key: string) => i18next.t(key);
  const createBlockAfterCurrent = (editor: Editor, range: Range, createNodeType: () => void) => {
    const { $from } = editor.state.selection;
    let endPos = $from.end();
    const currentNode = $from.node();
    const isEmptyParagraph =
      currentNode.type.name === 'paragraph' && currentNode.content.size === range.to - range.from;

    // 1. 删除 slash command
    editor.chain().focus().deleteRange(range).run();

    if (isEmptyParagraph) {
      createNodeType();
    } else {
      // 2. 在当前 block 后插入新的空 paragraph
      endPos -= range.to - range.from;
      editor
        .chain()
        .focus()
        .insertContentAt(endPos, {
          type: 'paragraph',
          content: [{ type: 'text', text: '\u200B' }], // 使用零宽空格
        })
        .setTextSelection(endPos + 2) // +2 是因为需要跳过新插入的 paragraph 开始位置和零宽空格
        .run();

      // 3. 在新行应用格式
      setTimeout(() => {
        createNodeType();
      }, 0);
    }
  };

  return createSuggestionItems([
    {
      title: t('editor.command.askAi'),
      description: t('editor.command.askAiDescription'),
      searchTerms: ['ai', 'assistant'],
      icon: <Magic className="w-5 h-5" />,
      command: ({ editor, range }) => {
        createBlockAfterCurrent(editor, range, () => {
          setTimeout(() => {
            editorEmitter.emit('activeAskAI', { value: true, docId: param.entityId });
          }, 0);
        });
      },
    },
    {
      title: t('editor.command.text'),
      description: t('editor.command.textDescription'),
      searchTerms: ['p', 'paragraph'],
      icon: <Text size={18} />,
      command: ({ editor, range }) => {
        createBlockAfterCurrent(editor, range, () => {
          editor.chain().focus().setNode('paragraph').run();
        });
      },
    },
    {
      title: t('editor.command.heading1'),
      description: t('editor.command.heading1Description'),
      searchTerms: ['title', 'big', 'large'],
      icon: <Heading1 size={18} />,
      command: ({ editor, range }) => {
        createBlockAfterCurrent(editor, range, () => {
          editor.chain().focus().setNode('heading', { level: 1 }).run();
        });
      },
    },
    {
      title: t('editor.command.toDoList'),
      description: t('editor.command.toDoListDescription'),
      searchTerms: ['todo', 'task', 'list', 'check', 'checkbox'],
      icon: <CheckSquare size={18} />,
      command: ({ editor, range }) => {
        createBlockAfterCurrent(editor, range, () => {
          editor.chain().focus().toggleTaskList().run();
        });
      },
    },
    {
      title: t('editor.command.bulletList'),
      description: t('editor.command.bulletListDescription'),
      searchTerms: ['unordered', 'point'],
      icon: <List size={18} />,
      command: ({ editor, range }) => {
        createBlockAfterCurrent(editor, range, () => {
          editor.chain().focus().toggleBulletList().run();
        });
      },
    },
    {
      title: t('editor.command.quote'),
      description: t('editor.command.quoteDescription'),
      searchTerms: ['blockquote'],
      icon: <TextQuote size={18} />,
      command: ({ editor, range }) => {
        createBlockAfterCurrent(editor, range, () => {
          editor.chain().focus().toggleBlockquote().run();
        });
      },
    },
    {
      title: t('editor.command.code'),
      description: t('editor.command.codeDescription'),
      searchTerms: ['codeblock'],
      icon: <Code size={18} />,
      command: ({ editor, range }) => {
        createBlockAfterCurrent(editor, range, () => {
          editor.chain().focus().toggleCodeBlock().run();
        });
      },
    },
    {
      title: t('editor.command.image'),
      description: t('editor.command.imageDescription'),
      searchTerms: ['photo', 'picture', 'media'],
      icon: <ImageIcon size={18} />,
      command: ({ editor, range }) => {
        if (!editor) return;

        createBlockAfterCurrent(editor, range, () => {
          // upload image
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';

          const uploadFn = createUploadFn(param);

          input.onchange = async () => {
            if (input.files?.length) {
              const file = input.files[0];
              const pos = editor.view?.state?.selection?.from;
              if (pos) {
                uploadFn(file, editor.view, pos);
              }
            }
          };
          input.click();
        });
      },
    },
    {
      title: t('editor.command.table'),
      description: t('editor.command.tableDescription'),
      searchTerms: ['table'],
      icon: <IconTable size={18} />,
      command: ({ editor, range }) => {
        if (!editor) return;

        createBlockAfterCurrent(editor, range, () => {
          editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run();
        });
      },
    },
  ]);
};

export const configureSlashCommand = (param: { entityId: string; entityType: string }) => {
  return Command.configure({
    suggestion: {
      items: () => configureSuggestionItems(param),
      render: renderItems,
    },
  });
};
