import React from 'react';
import Mention from '@tiptap/extension-mention';
import { ReactRenderer, ReactNodeViewRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import { MentionList } from './mentionList';
import type { MentionItem } from './mentionList';
import MentionNodeView from './mention-node-view';

// Custom Mention extension with icon support
const CustomMention = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      entityId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-entity-id'),
        renderHTML: (attributes) => {
          if (!attributes.entityId) {
            return {};
          }
          return {
            'data-entity-id': attributes.entityId,
          };
        },
      },
      source: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-source'),
        renderHTML: (attributes) => {
          if (!attributes.source) {
            return {};
          }
          return {
            'data-source': attributes.source,
          };
        },
      },
      url: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-url'),
        renderHTML: (attributes) => {
          if (!attributes.url) {
            return {};
          }
          return {
            'data-url': attributes.url,
          };
        },
      },
      variableType: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-variable-type'),
        renderHTML: (attributes) => {
          if (!attributes.variableType) {
            return {};
          }
          return {
            'data-variable-type': attributes.variableType,
          };
        },
      },
      resourceType: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-resource-type'),
        renderHTML: (attributes) => {
          if (!attributes.resourceType) {
            return {};
          }
          return {
            'data-resource-type': attributes.resourceType,
          };
        },
      },
      resourceMeta: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-resource-meta'),
        renderHTML: (attributes) => {
          if (!attributes.resourceMeta) {
            return {};
          }
          return {
            'data-resource-meta': JSON.stringify(attributes.resourceMeta),
          };
        },
      },
      toolsetId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-toolset-id'),
        renderHTML: (attributes) => {
          if (!attributes.toolsetId) {
            return {};
          }
          return {
            'data-toolset-id': attributes.toolsetId,
          };
        },
      },
      toolset: {
        default: null,
        parseHTML: (element) => {
          try {
            const raw = element.getAttribute('data-toolset');
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        },
        renderHTML: (attributes) => {
          if (!attributes.toolset) {
            return {};
          }
          return {
            'data-toolset': JSON.stringify(attributes.toolset),
          };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(MentionNodeView);
  },
});

export type MentionPosition =
  | 'top-start'
  | 'bottom-start'
  | 'bottom'
  | 'top'
  | 'top-end'
  | 'bottom-end';

interface MentionExtensionOptions {
  handleCommand: (params: { editor: any; range: any; props: any }) => void;
  hasUserInteractedRef: React.MutableRefObject<boolean>;
  allItemsRef: React.MutableRefObject<MentionItem[]>;
  mentionPosition: MentionPosition;
  setIsMentionListVisible: (visible: boolean) => void;
}

export const createMentionExtension = ({
  handleCommand,
  hasUserInteractedRef,
  allItemsRef,
  mentionPosition,
  setIsMentionListVisible,
}: MentionExtensionOptions) => {
  return CustomMention.configure({
    HTMLAttributes: {
      class: 'mention',
    },
    suggestion: {
      char: '@',
      allowedPrefixes: null,
      command: handleCommand,
      items: () => {
        // Require explicit user interaction before providing items
        if (!hasUserInteractedRef.current) {
          return [];
        }

        return allItemsRef.current ?? [];
      },

      // Only show suggestion when user is actively typing @
      allow: () => {
        // Require explicit user interaction to enable suggestions
        if (!hasUserInteractedRef.current) {
          return false;
        }

        return true;
      },
      render: () => {
        let component: any;
        let popup: any;
        // Keep last non-null client rect to stabilize position during IME composition
        // Some IMEs (e.g., Chinese) may temporarily return null on space confirmation
        // which would cause Popper to position at (0,0). We cache the last rect instead.
        let lastClientRect: DOMRect | null = null;
        // Store latest props to avoid closure issues
        let latestProps: any = null;
        const parsePlacement = (inst: any): 'top' | 'bottom' => {
          const resolved =
            inst?.popperInstance?.state?.placement ??
            inst?.popper?.getAttribute?.('data-placement') ??
            inst?.state?.placement ??
            inst?.props?.placement ??
            'bottom-start';
          const base = String(resolved).split('-')[0];
          return base === 'top' ? 'top' : 'bottom';
        };

        return {
          onStart: (props) => {
            latestProps = props; // Store latest props
            component = new ReactRenderer(MentionList, {
              props: {
                ...props,
                placement: mentionPosition,
                query: props.query || '',
              },
              editor: props.editor,
            });

            popup = tippy('body', {
              getReferenceClientRect: () => {
                const rect = props?.clientRect?.();
                // Cache valid rect; fallback to the last valid one during composition
                if (rect) lastClientRect = rect as DOMRect;
                return (rect as DOMRect) ?? (lastClientRect as DOMRect);
              },
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: mentionPosition,
              popperOptions: {
                modifiers: [
                  { name: 'flip', enabled: false }, // 禁止自动翻转
                ],
              },
              theme: 'custom',
              arrow: false,
              offset: [0, 8],
              onMount(instance) {
                const placement = parsePlacement(instance);
                component.updateProps({
                  ...latestProps,
                  placement,
                  query: latestProps?.query || '',
                });
              },
              onShown(instance) {
                const placement = parsePlacement(instance);
                setIsMentionListVisible(true);
                component.updateProps({
                  ...latestProps,
                  placement,
                  isMentionListVisible: true,
                  query: latestProps?.query || '',
                });
              },
              onHidden(instance) {
                const placement = parsePlacement(instance);
                setIsMentionListVisible(false);
                component.updateProps({
                  ...latestProps,
                  placement,
                  isMentionListVisible: false,
                  query: latestProps?.query || '',
                });
              },
              onDestroy() {
                setIsMentionListVisible(false);
                component.updateProps({
                  ...latestProps,
                  isMentionListVisible: false,
                  query: latestProps?.query || '',
                });
              },
            });

            // Store popup instance for manual control
            // Note: This is not accessible here, so we'll need to handle popup instance management differently
          },
          onUpdate(props) {
            latestProps = props; // Update latest props
            component.updateProps({ ...props, query: props.query || '' });
            // Update the reference rect while guarding against null during IME composition
            popup[0].setProps({
              getReferenceClientRect: () => {
                const rect = props?.clientRect?.();
                if (rect) lastClientRect = rect as DOMRect;
                return (rect as DOMRect) ?? (lastClientRect as DOMRect);
              },
            });
            // Read actual placement after Popper updates layout
            requestAnimationFrame(() => {
              try {
                const instance = popup?.[0];
                const placement = parsePlacement(instance);
                component.updateProps({ ...props, placement, query: props.query || '' });
              } catch {
                // noop
              }
            });
          },
          onKeyDown(props) {
            if (props.event.key === 'Escape') {
              component.destroy();

              return true;
            }

            return component.ref?.onKeyDown(props);
          },
          onExit() {
            popup[0].destroy();
            component.element.remove();
            component.destroy();
          },
        };
      },
    },
  });
};
