import Component from './render';
import rehypePlugin from './rehypePlugin';

// Define a proper interface to avoid the type error
interface MarkdownElementPlugin {
  tag: string;
  Component: React.ComponentType<any>;
  rehypePlugin: () => (tree: any) => void;
}

const CodeElement: MarkdownElementPlugin = {
  tag: 'pre',
  Component,
  rehypePlugin,
};

export default CodeElement;
