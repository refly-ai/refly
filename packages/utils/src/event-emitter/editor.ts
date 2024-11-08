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

export interface InPlaceSendMessagePayload {
  userInput: string;
  inPlaceActionType?: InPlaceActionType;
  canvasEditConfig?: CanvasEditConfig;
}

export type Events = {
  insertBlow: string;
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
  updateCanvasTitle: string;
  activeAskAI: boolean;
  inPlaceSendMessage: InPlaceSendMessagePayload;
  askAIResponse: Omit<InPlaceSendMessagePayload, 'userInput'>;
  editorSynced: void;
};

export type EditorOperation =
  | 'insertBlow'
  | 'replaceSelection'
  | 'contineInChat'
  | 'createNewNote'
  | 'streamCanvasContent'
  | 'streamEditCanvasContent'
  | 'updateCanvasTitle'
  | 'inPlaceSendMessage'
  | 'activeAskAI'
  | 'askAIResponse'
  | 'editorSynced';

export const editorEmitter = mitt<Events>();
