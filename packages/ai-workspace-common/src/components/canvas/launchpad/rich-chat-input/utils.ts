import type { MentionItem } from './mentionList';
import { mentionItemSourceToType, type MentionItemSource } from './const';
import type { MentionItemType } from '@refly/utils';
import type { IContextItem } from '@refly/common-types';
import type { CanvasNodeType } from '@refly/openapi-schema';

/**
 * Helper function to create context item from mention item
 */
export const createContextItemFromMentionItem = (item: MentionItem): IContextItem => {
  return {
    entityId: item.entityId,
    title: item.name,
    type: (() => {
      if (item.source === 'agents') {
        return 'skillResponse' as CanvasNodeType;
      } else if (item.source === 'tools') {
        return 'tool' as CanvasNodeType;
      } else if (item.source === 'files') {
        return 'file';
      } else if (item.source === 'products') {
        return 'file';
      }

      return 'file';
    })(),

    metadata: {
      nodeId: item.nodeId,
      source: item.source,
      variableType: item.variableType,
      ...item.metadata,
    },
  };
};

/**
 * Serialize a Tiptap document to tokens string with @{type=x,id=y,name=z} format
 */
export const serializeDocToTokens = (doc: any): string => {
  try {
    if (!doc) return '';
    const text = doc.textBetween(0, doc.content.size, '\n', (node: any) => {
      const nodeName = node?.type?.name ?? '';
      if (nodeName === 'mention') {
        const label = node?.attrs?.label ?? node?.attrs?.id ?? '';
        const id = node?.attrs?.id ?? '';
        const source = node?.attrs?.source ?? '';
        const type = mentionItemSourceToType[source as MentionItemSource] ?? 'var';
        const safeId = String(id ?? '').trim();
        const safeName = String(label ?? '').trim();

        // For tool type, include toolsetName if available
        let tokenString = `@{type=${type},id=${safeId || safeName},name=${safeName}`;
        if (type === 'tool') {
          const toolset = node.attrs?.toolset;
          const toolsetKey = String(
            toolset?.toolset?.definition?.key ?? toolset?.name ?? '',
          ).trim();
          if (toolsetKey) {
            tokenString += `,toolsetKey=${toolsetKey}`;
          }
        }
        tokenString += '}';

        return safeName ? tokenString : '';
      }
      if (nodeName === 'hardBreak') {
        return '\n';
      }
      return '';
    });
    return text ?? '';
  } catch {
    return '';
  }
};

/**
 * Build Tiptap nodes from content string with @{type=x,id=y,name=z} format
 */
export const buildNodesFromContent = (
  content: string,
  workflowVariables: any[],
  allItems: MentionItem[],
): any[] => {
  const nodes: any[] = [];
  if (!content) return nodes;

  // Normalize input to avoid generating unexpected extra blank lines
  // - Unify EOL to \n
  // - Remove trailing whitespace before newlines
  // - Collapse 3+ consecutive newlines to exactly 2 (represents a single empty line)
  // - Trim leading and trailing newlines
  const normalizeContent = (input: string): string => {
    let s = input?.replace(/\r\n?/g, '\n') ?? '';
    s = s.replace(/[ \t]+\n/g, '\n');
    s = s.replace(/\n{3,}/g, '\n\n');
    s = s.replace(/^\n+/, '').replace(/\n+$/, '');
    return s;
  };

  const normalized = normalizeContent(content);

  // Find meta for variable type (var -> variables)
  const findVarMeta = (tokenId: string, tokenName: string) => {
    // Priority 1: Look by ID in allItems
    if (tokenId) {
      const foundById = (allItems || []).find((it: any) => {
        const vid = it?.variableId ?? '';
        const eid = it?.entityId ?? '';
        const nid = it?.nodeId ?? '';
        return vid === tokenId || eid === tokenId || nid === tokenId;
      });
      if (foundById && foundById.source === 'variables') {
        return {
          variableType: foundById?.variableType ?? 'string',
          entityId: foundById?.entityId ?? foundById?.variableId ?? foundById?.nodeId,
          source: foundById?.source,
        };
      }
    }

    // Priority 2: Look by name in allItems
    if (tokenName) {
      const foundByName = (allItems || []).find(
        (it) => it.source === 'variables' && it?.name === tokenName,
      );
      if (foundByName) {
        return {
          variableType: foundByName?.variableType ?? 'string',
          entityId: foundByName?.entityId ?? foundByName?.variableId ?? foundByName?.nodeId,
          source: foundByName?.source,
        };
      }
    }

    // Priority 3: Look in variables prop (most reliable for startNode)
    if (tokenName) {
      const foundInVariables = (workflowVariables || []).find((v) => v?.name === tokenName);
      if (foundInVariables) {
        return {
          variableType: foundInVariables?.variableType ?? 'string',
          entityId: foundInVariables?.variableId,
          source: 'variables',
        };
      }
    }

    // Fallback: Default to variables with string type
    return {
      variableType: 'string',
      source: 'variables',
    };
  };

  // Find meta for agent type
  const findAgentMeta = (tokenId: string, tokenName: string) => {
    if (!tokenId && !tokenName) return null;

    const foundFromAll = (allItems || []).find((it) => {
      if (it.source !== 'agents') return false;

      const vid = it?.variableId ?? '';
      const eid = it?.entityId ?? '';
      const nid = it?.nodeId ?? '';
      const name = it?.name ?? '';

      return (
        (tokenId && (vid === tokenId || eid === tokenId || nid === tokenId)) ||
        (tokenName && name === tokenName)
      );
    });

    if (foundFromAll) {
      return {
        variableType: foundFromAll?.variableType ?? 'skillResponse',
        source: foundFromAll?.source,
        entityId: foundFromAll?.entityId ?? foundFromAll?.nodeId,
        nodeId: foundFromAll?.nodeId,
        metadata: foundFromAll?.metadata,
      };
    }

    return null;
  };

  // Find meta for file type
  const findFileMeta = (tokenId: string, tokenName: string) => {
    if (!tokenId && !tokenName) return null;

    const resourceSources: MentionItemSource[] = ['files', 'products'];

    const foundFromAll = (allItems || []).find((it) => {
      if (!resourceSources.includes(it.source)) return false;

      const vid = it?.variableId ?? '';
      const eid = it?.entityId ?? '';
      const nid = it?.nodeId ?? '';
      const name = it?.name ?? '';

      return (
        (tokenId && (vid === tokenId || eid === tokenId || nid === tokenId)) ||
        (tokenName && name === tokenName)
      );
    });

    if (foundFromAll) {
      return {
        label: foundFromAll?.name ?? '',
        variableType: foundFromAll?.variableType ?? 'resource',
        source: foundFromAll?.source,
        entityId: foundFromAll?.entityId ?? foundFromAll?.nodeId,
        nodeId: foundFromAll?.nodeId,
        metadata: foundFromAll?.metadata,
      };
    }

    return null;
  };

  // Find meta for tool type (tool -> tools)
  const findToolMeta = (tokenId: string, tokenName: string) => {
    if (!tokenId && !tokenName) return null;

    const foundFromAll = (allItems || []).find((it) => {
      if (it.source !== 'tools') return false;

      return it.toolsetId === tokenId;
    });

    if (foundFromAll) {
      return {
        variableType: foundFromAll?.variableType ?? 'toolset',
        source: foundFromAll?.source,
        toolset: foundFromAll?.toolset,
        toolsetId: foundFromAll?.toolsetId,
        entityId: foundFromAll?.entityId,
        nodeId: foundFromAll?.nodeId,
        metadata: foundFromAll?.metadata,
      };
    }

    return null;
  };

  // Prepare name list sorted by length desc to prefer the longest match
  const allNames = Array.from(
    new Set((allItems || []).map((it: any) => it?.name).filter(Boolean)),
  ) as string[];
  allNames.sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0));

  let i = 0;
  let textBuffer = '';
  while (i < normalized.length) {
    const ch = normalized[i];

    // Preserve newlines by mapping to hardBreak nodes
    if (ch === '\n') {
      if (textBuffer) {
        nodes.push({ type: 'text', text: textBuffer });
        textBuffer = '';
      }
      nodes.push({ type: 'hardBreak' });
      i += 1;
      continue;
    }

    if (ch === '@') {
      // Try new rich token: @{type=...,id=...,name=...}
      if (normalized[i + 1] === '{') {
        const closeIdx = normalized.indexOf('}', i + 2);
        if (closeIdx !== -1) {
          const inside = normalized.slice(i + 2, closeIdx);
          // Parse key=value pairs separated by comma, allow spaces
          const pairs = inside.split(',').map((s) => s.trim());
          const map: Record<string, string> = {};
          for (const p of pairs) {
            const eq = p.indexOf('=');
            if (eq > 0) {
              const k = p.slice(0, eq).trim();
              const v = p.slice(eq + 1).trim();
              map[k] = v;
            }
          }
          const tokenType: MentionItemType = (map.type as MentionItemType) || 'var';
          const tokenId = map.id || '';
          const tokenName = map.name || '';

          if (textBuffer) {
            nodes.push({ type: 'text', text: textBuffer });
            textBuffer = '';
          }

          // Map type to source and variableType
          let label = tokenName || tokenId;
          let source: MentionItemSource = 'variables';
          let variableType = 'string';
          let toolInfo: any = null;

          if (tokenType === 'var') {
            source = 'variables';
            const meta = findVarMeta(tokenId, tokenName);
            variableType = meta?.variableType ?? 'string';
            toolInfo = meta;
          } else if (tokenType === 'agent') {
            source = 'agents';
            const meta = findAgentMeta(tokenId, tokenName);
            variableType = meta?.variableType ?? 'skillResponse';
            toolInfo = meta;
          } else if (tokenType === 'file') {
            const meta = findFileMeta(tokenId, tokenName);
            label = meta?.label ?? tokenName;
            source = meta?.source ?? 'files';
            variableType = meta?.variableType ?? 'resource';
            toolInfo = meta;
          } else if (tokenType === 'toolset') {
            source = 'toolsets';
            const meta = findToolMeta(tokenId, tokenName);
            variableType = meta?.variableType ?? 'toolset';
            toolInfo = meta;
          } else if (tokenType === 'tool') {
            source = 'tools';
            const meta = findToolMeta(tokenId, tokenName);
            variableType = meta?.variableType ?? 'tool';
            toolInfo = meta;
          }

          nodes.push({
            type: 'mention',
            attrs: {
              id: tokenId || tokenName,
              label,
              variableType,
              source,
              entityId: tokenId || undefined,
              ...((source === 'tools' || source === 'toolsets') && toolInfo
                ? {
                    toolset: toolInfo.toolset,
                    toolsetId: toolInfo.toolsetId,
                  }
                : {}),
              ...(toolInfo?.metadata ? { metadata: toolInfo.metadata } : {}),
            },
          });
          i = closeIdx + 1;
          continue;
        }
      }

      // Fallback: legacy @name syntax
      let matchedName: string | null = null;
      for (const name of allNames) {
        const candidate = normalized.slice(i + 1, i + 1 + name.length);
        if (candidate === name) {
          const nextChar = normalized[i + 1 + name.length] ?? '';
          if (nextChar === ' ' || nextChar === '\n' || nextChar === '' || nextChar === '\t') {
            matchedName = name;
            break;
          }
        }
      }

      if (matchedName) {
        if (textBuffer) {
          nodes.push({ type: 'text', text: textBuffer });
          textBuffer = '';
        }
        // For legacy @name syntax, try to find the item in allItems first
        const foundItem = (allItems || []).find((it: any) => it?.name === matchedName);
        let meta: any = null;
        let toolInfo: any = null;

        if (foundItem) {
          // Use appropriate meta finder based on the item's source
          switch (foundItem.source) {
            case 'variables':
              meta = findVarMeta('', matchedName);
              toolInfo = meta;
              break;
            case 'agents':
              meta = findAgentMeta('', matchedName);
              toolInfo = meta;
              break;
            case 'files':
            case 'products':
              meta = findFileMeta('', matchedName);
              toolInfo = meta;
              break;
            case 'tools':
              meta = findToolMeta('', matchedName);
              toolInfo = meta;
              break;
            default:
              // Fallback to variable meta finder
              meta = findVarMeta('', matchedName);
              toolInfo = meta;
          }
        } else {
          // If not found in allItems, use variable meta finder as fallback
          meta = findVarMeta('', matchedName);
          toolInfo = meta;
        }

        nodes.push({
          type: 'mention',
          attrs: {
            id: meta?.entityId || matchedName,
            label: matchedName,
            variableType: meta?.variableType ?? 'string',
            source: meta?.source ?? 'variables',
            entityId: meta?.entityId,
            ...(meta?.source === 'tools' && toolInfo
              ? {
                  toolset: toolInfo.toolset,
                  toolsetId: toolInfo.toolsetId,
                }
              : {}),
            ...(toolInfo?.metadata ? { metadata: toolInfo.metadata } : {}),
          },
        });
        i = i + 1 + matchedName.length;
        continue;
      }
    }
    // Default: accumulate as plain text
    textBuffer += ch;
    i += 1;
  }

  if (textBuffer) {
    nodes.push({ type: 'text', text: textBuffer });
  }

  return nodes;
};
