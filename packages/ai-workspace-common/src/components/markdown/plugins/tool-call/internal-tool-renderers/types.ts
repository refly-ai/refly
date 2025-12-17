import { ToolCallStatus } from '../types';

/**
 * Props for internal tool renderer components
 */
export interface InternalToolRendererProps {
  toolsetKey: string;
  toolCallStatus: ToolCallStatus;
  parametersContent: Record<string, unknown>;
  resultContent?: Record<string, unknown>;
}

/**
 * Props for the main InternalToolRenderer component
 */
export interface InternalToolRendererMainProps extends InternalToolRendererProps {
  toolsetName: string;
}
