import React from 'react';
import { InternalToolRendererProps, InternalToolRendererMainProps } from './types';
import { ReadFileRenderer } from './read-file-renderer';
import { ListFilesRenderer } from './list-files-renderer';
import { DefaultInternalRenderer } from './default-renderer';
import './index.scss';

/**
 * Registry of internal tool renderers
 * Maps toolsetKey to its specific renderer component
 */
const internalToolRenderers: Record<string, React.FC<InternalToolRendererProps>> = {
  read_file: ReadFileRenderer,
  list_files: ListFilesRenderer,
};

/**
 * Main component for rendering internal tools
 * Selects the appropriate renderer based on toolsetKey
 */
export const InternalToolRenderer: React.FC<InternalToolRendererMainProps> = (props) => {
  const { toolsetKey, toolsetName, ...rest } = props;
  const Renderer = internalToolRenderers[toolsetKey];

  if (Renderer) {
    return <Renderer toolsetKey={toolsetKey} {...rest} />;
  }

  // Fallback for unknown internal tools
  return <DefaultInternalRenderer toolsetKey={toolsetKey} toolsetName={toolsetName} {...rest} />;
};

export type { InternalToolRendererProps, InternalToolRendererMainProps } from './types';
