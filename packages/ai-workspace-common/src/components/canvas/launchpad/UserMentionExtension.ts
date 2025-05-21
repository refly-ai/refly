// packages/ai-workspace-common/src/components/canvas/launchpad/UserMentionExtension.ts
import { Node, mergeAttributes } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance, GetReferenceClientRect } from 'tippy.js';
import MentionList, { MentionListRef, MentionListItem, MentionListProps } from './MentionList'; // Assuming MentionList is in the same directory

// Define a unique PluginKey for this extension
export const UserMentionPluginKey = new PluginKey('userMentionSuggestion');

export interface UserMentionOptions {
  HTMLAttributes: Record<string, any>;
  suggestion: Omit<SuggestionOptions<MentionListItem>, 'editor'>; // editor is implicitly provided by Suggestion
}

// Mock user data - this should ideally be passed in or imported from a shared location
const mockUsers: MentionListItem[] = [
  { id: 'user-1', label: 'Alice Wonderland' },
  { id: 'user-2', label: 'Bob The Builder' },
  { id: 'user-3', label: 'Charlie Brown' },
  { id: 'user-4', label: 'Diana Prince' },
  { id: 'user-5', label: 'Edward Scissorhands' },
];

export const UserMention = Node.create<UserMentionOptions>({
  name: 'userMention', // Unique name for this node
  group: 'inline',
  inline: true,
  selectable: false,
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class:
          'font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-md cursor-pointer mention-user',
      },
      suggestion: {
        char: '@',
        pluginKey: UserMentionPluginKey, // Use the unique key
        allowSpaces: true,
        items: ({ query }) => {
          return mockUsers
            .filter((user) => user.label.toLowerCase().startsWith(query.toLowerCase()))
            .slice(0, 5);
        },
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: this.name, // Use this node's name
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
                      type: 'user',
                    }
                  : {
                      editor: props.editor,
                      items: props.items,
                      command: props.command,
                      type: 'user',
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
                placement: 'bottom-start',
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
              popup = null; // ensure popup is nulled for next creation
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
        tag: `span[data-type="${this.name}"]`, // Or a more specific tag if you use one
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': this.name }),
      this.options.suggestion.char + node.attrs.label, // Render @label
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

export default UserMention;
