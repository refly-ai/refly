/**
 * Pre-configured lazy loader modules
 * Export all modules for convenient importing
 */

// Shiki syntax highlighter
export {
  shikiLoader,
  getHighlighter,
  configureShiki,
  isLanguageSupported,
  getSupportedLanguages,
} from './shiki';
export type { ShikiConfig } from './shiki';

// Mermaid diagram renderer
export {
  mermaidLoader,
  getMermaid,
  configureMermaid,
  initializeMermaid,
  renderMermaid,
  parseMermaid,
  getMermaidConfig,
} from './mermaid';
export type { MermaidConfig } from './mermaid';

// html2canvas
export {
  html2canvasLoader,
  getHtml2Canvas,
  captureElement,
  captureElementAsDataUrl,
  captureElementAsBlob,
} from './html2canvas';
export type { Html2CanvasOptions } from './html2canvas';

// modern-screenshot
export {
  modernScreenshotLoader,
  getModernScreenshot,
  domToPng,
  domToJpeg,
  domToBlob,
  domToCanvas,
  domToSvg,
} from './modern-screenshot';
export type { ScreenshotOptions } from './modern-screenshot';

// copy-to-clipboard
export {
  copyToClipboardLoader,
  getCopyToClipboard,
  copyText,
  copyHtml,
} from './copy-to-clipboard';

// Sandpack code sandbox
export { sandpackLoader, getSandpack, preloadSandpack } from './sandpack';

// react-beautiful-dnd drag and drop
export {
  reactBeautifulDndLoader,
  getReactBeautifulDnd,
  preloadReactBeautifulDnd,
} from './react-beautiful-dnd';
export type {
  DropResult,
  DraggingStyle,
  NotDraggingStyle,
  DroppableProvided,
  DraggableProvided,
  DraggableStateSnapshot,
  DroppableStateSnapshot,
} from './react-beautiful-dnd';
