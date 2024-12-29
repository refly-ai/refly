import mitt from 'mitt';

export type InPlaceEditType = 'inline' | 'block';
export type InPlaceActionType = 'chat' | 'edit';

export interface CanvasEditConfig {
  selection?: {
    beforeHighlight: string;
    highlightedText: string;
    afterHighlight: string;
  };
  selectedRange?: {
    startIndex: number;
    endIndex: number;
  };
  inPlaceEditType?: InPlaceEditType;
}

export type Events = {
  insertBelow: string;
  replaceSelection: string;
  contineInChat: string;
  createNewNote: string;
  streamCanvasContent: {
    canvasId: string;
    isFirst: boolean;
    content: string;
  };
  streamEditCanvasContent: {
    canvasId: string;
    isFirst: boolean;
    content: string;
  };
  activeAskAI: { value: boolean; docId?: string };
  editorSynced: void;
  exitFullScreen: void;
};

export type EditorOperation =
  | 'insertBelow'
  | 'replaceSelection'
  | 'contineInChat'
  | 'streamCanvasContent'
  | 'streamEditCanvasContent'
  | 'activeAskAI'
  | 'editorSynced'
  | 'exitFullScreen';

export const editorEmitter = mitt<Events>();
