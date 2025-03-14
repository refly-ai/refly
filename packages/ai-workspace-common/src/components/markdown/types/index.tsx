import { ReactNode } from 'react';

export interface MarkdownElementProps {
  children: ReactNode;
  id: string;
  type: string;
}

export type MarkdownMode = 'readonly' | 'interactive';
