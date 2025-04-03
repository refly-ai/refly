export interface NodeData {
  id: string;
  label?: string;
  content: string;
  richTextContent?: any;
  colors?: {
    bg: string;
    border: string;
  };
  children?: NodeData[];
  [key: string]: any;
}

export interface ExtractedContent {
  title: string;
  keyPoints: {
    point: string;
    context?: string;
  }[];
}
