// packages/ai-workspace-common/src/components/canvas/launchpad/SkillMentionExtension.ts
import { Node, mergeAttributes } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance, GetReferenceClientRect } from 'tippy.js';
import MentionList, { MentionListRef, MentionListItem, MentionListProps } from './MentionList';
import type { Skill } from '@refly/openapi-schema';
import { matchesPinyin } from './UserMentionExtension';

// Define a unique PluginKey for this extension
export const SkillMentionPluginKey = new PluginKey('skillMentionSuggestion');

export interface SkillMentionOptions {
  HTMLAttributes: Record<string, any>;
  suggestion: Omit<SuggestionOptions<MentionListItem>, 'editor'>;
  skills?: Skill[]; // 添加技能列表参数
  onSelectSkill?: (skill: Skill) => void; // 添加选择回调
  getDisplayName?: (skillName: string) => string; // 添加获取显示名称的函数
}

export const SkillMention = Node.create<SkillMentionOptions>({
  name: 'skillMention', // Unique name for this node
  group: 'inline',
  inline: true,
  selectable: false,
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class:
          'font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded-md cursor-pointer mention-skill',
        style:
          'display: inline-block; max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: bottom; margin: 2px 0;',
      },
      suggestion: {
        char: '/',
        pluginKey: SkillMentionPluginKey, // Use the unique key
        allowSpaces: true, // Or false, depending on skill name patterns
        items: ({ query }) => {
          // 如果没有提供技能列表，返回空数组
          const extension = SkillMention;

          if (!extension.child.options.skills) {
            return [];
          }

          // 使用真实的技能列表
          return extension.child.options.skills
            .map((skill) => {
              // 使用 getDisplayName 函数获取显示名称，如果没有提供则使用原始名称
              const displayName = extension.child.options.getDisplayName
                ? extension.child.options.getDisplayName(skill.name)
                : skill.name;

              return {
                id: skill.name,
                label: displayName, // 使用显示名称作为标签
                metadata: skill, // 保存完整的技能对象以便回调使用
              };
            })
            .filter(
              (item) =>
                item.label.toLowerCase().includes(query.toLowerCase()) ||
                matchesPinyin(item.label, query),
            );
        },
        command: ({ editor, range, props }) => {
          const options = editor.extensionManager.extensions.find(
            (extension) => extension.name === 'skillMention',
          )?.options as SkillMentionOptions;

          // 如果有选择回调且 props.metadata 存在，则调用回调
          if (options?.onSelectSkill && props.metadata) {
            options.onSelectSkill(props.metadata);
          }

          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: 'skillMention',
                attrs: { id: props.id, label: props.label },
              },
              {
                type: 'text',
                text: ' ',
              },
            ])
            .run();
        },
        render: () => {
          let component: ReactRenderer<MentionListRef, MentionListProps>;
          let popup: TippyInstance | null = null;

          return {
            onStart: (props) => {
              component = new ReactRenderer(MentionList, {
                props: props.decorationNode
                  ? {
                      ...props,
                      editor: props.editor,
                      items: props.items,
                      command: props.command,
                      type: 'skill',
                    }
                  : {
                      editor: props.editor,
                      items: props.items,
                      command: props.command,
                      type: 'skill',
                    },
                editor: props.editor,
              });

              if (!props.clientRect) {
                return;
              }
              const rect = props.clientRect as GetReferenceClientRect;

              popup = tippy(document.body, {
                getReferenceClientRect: rect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'top-start',
              });
            },
            onUpdate: (props) => {
              component.updateProps(
                props.decorationNode
                  ? { ...props, editor: props.editor, items: props.items, command: props.command }
                  : { editor: props.editor, items: props.items, command: props.command },
              );
              if (!props.clientRect) {
                return;
              }
              const rect = props.clientRect as GetReferenceClientRect;
              popup?.setProps({
                getReferenceClientRect: rect,
              });
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                popup?.hide();
                return true;
              }
              return component.ref?.onKeyDown({ event: props.event }) || false;
            },
            onExit: () => {
              popup?.destroy();
              component.destroy();
              popup = null;
            },
          };
        },
      },
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-id'),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {};
          }
          return { 'data-id': attributes.id };
        },
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-label'),
        renderHTML: (attributes) => {
          if (!attributes.label) {
            return {};
          }
          return { 'data-label': attributes.label };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': this.name }),
      this.options.suggestion.char + node.attrs.label, // Render /skillLabel
    ];
  },

  renderText({ node }) {
    return this.options.suggestion.char + node.attrs.label;
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.command(({ tr, state }) => {
          let isMention = false;
          const { selection } = state;
          const { empty, anchor } = selection;

          if (!empty) {
            return false;
          }

          state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
            if (node.type.name === this.name) {
              isMention = true;
              tr.deleteRange(pos, pos + node.nodeSize);
              return false;
            }
          });

          return isMention;
        }),
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export default SkillMention;
