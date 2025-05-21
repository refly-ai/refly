// packages/ai-workspace-common/src/components/canvas/launchpad/SkillMentionExtension.ts
import { Node, mergeAttributes } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance, GetReferenceClientRect } from 'tippy.js';
import MentionList, { MentionListRef, MentionListItem, MentionListProps } from './MentionList';

// Define a unique PluginKey for this extension
export const SkillMentionPluginKey = new PluginKey('skillMentionSuggestion');

export interface SkillMentionOptions {
  HTMLAttributes: Record<string, any>;
  suggestion: Omit<SuggestionOptions<MentionListItem>, 'editor'>;
}

// Mock skill data - this should ideally be passed in or imported from a shared location
const mockSkills: MentionListItem[] = [
  { id: 'skill-1', label: 'Summarize Document' },
  { id: 'skill-2', label: 'Translate Text' },
  { id: 'skill-3', label: 'Generate Code' },
  { id: 'skill-4', label: 'Analyze Sentiment' },
  { id: 'skill-5', label: 'Extract Keywords' },
];

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
      },
      suggestion: {
        char: '/',
        pluginKey: SkillMentionPluginKey, // Use the unique key
        allowSpaces: true, // Or false, depending on skill name patterns
        items: ({ query }) => {
          return mockSkills
            .filter((skill) => skill.label.toLowerCase().startsWith(query.toLowerCase()))
            .slice(0, 5);
        },
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: this.name,
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
