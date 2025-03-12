import ReflyArtifact from './artifact';
import ReflyArtifactThinking from './artifact-thinking';
import CodeElement from './code';

// Define an interface for markdown element plugins
// This solves the TypeScript error about exported variable having names from external modules
interface MarkdownElementPlugin {
  tag: string;
  Component: React.ComponentType<any>;
  rehypePlugin: () => (tree: any) => void;
}

// Cast the plugins to the interface to avoid TypeScript errors
const markdownElements: MarkdownElementPlugin[] = [
  ReflyArtifact as MarkdownElementPlugin,
  ReflyArtifactThinking as MarkdownElementPlugin,
  CodeElement as MarkdownElementPlugin,
];

export { markdownElements };
