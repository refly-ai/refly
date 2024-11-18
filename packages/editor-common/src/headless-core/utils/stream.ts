import { EditorInstance } from '../components';

export class TokenStreamProcessor {
  private editor: EditorInstance;
  private chunk: string;
  private isLineStart: boolean;
  private isCodeBlockStart: boolean;
  private isInList: boolean;
  private currentListDepth: number = 0;

  markPatterns = [
    { pattern: '**', mark: 'bold' },
    { pattern: '__', mark: 'bold' },
    { pattern: '*', mark: 'italic' },
    { pattern: '_', mark: 'italic' },
    { pattern: '~~', mark: 'strike' },
    { pattern: '`', mark: 'code' },
  ];

  constructor() {
    this.chunk = '';
    this.isLineStart = true;
    this.isCodeBlockStart = false;
    this.isInList = false;
  }

  setEditor(editor: EditorInstance) {
    this.editor = editor;
  }

  isCodeBlockActive() {
    return this.editor.isActive('codeBlock');
  }

  enterNewLine() {
    // Handle code block
    if (this.isCodeBlockActive()) {
      // Only enter newlines if not at the start of code block
      if (!this.isCodeBlockStart) {
        this.editor.commands.enter();
        this.isLineStart = true;
      }
      return;
    }

    // Don't allow new lines at line start
    // since we don't want empty paragraphs
    if (this.isLineStart) {
      return;
    }

    this.editor.commands.enter();
    this.isLineStart = true;
  }

  insertContent(content: string) {
    // Handle line breaks
    if (content.includes('\n')) {
      // If not in a code block, replace all new lines with a single new line
      // to avoid creating empty paragraphs
      if (!this.isCodeBlockActive()) {
        content = content.replace(/\n+/g, '\n');
      }

      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line) {
          this.insertContent(line);
        }
        if (index < lines.length - 1) {
          this.enterNewLine();
        }
      });
      this.chunk = '';
      return;
    }

    if (this.isLineStart && !this.isCodeBlockActive()) {
      // Directly call insertContent to trigger block activation
      // such as headings, blockquotes, etc.
      this.editor.commands.insertContent(content);
    } else {
      // If not at line start or within a code block, insert text as a regular text node
      this.editor.commands.insertContent({ type: 'text', text: content });
    }

    this.chunk = '';
    this.isLineStart = false;
    this.isCodeBlockStart = false;

    // Focus with scroll options
    const currentPos = this.editor.state.selection.from;
    this.editor.commands.focus(currentPos, { scrollIntoView: true });
  }

  processMark(pattern: string, mark: string) {
    const lines = this.chunk.split(pattern);
    lines.forEach((line, index) => {
      if (line) {
        this.insertContent(line);
      }
      if (index < lines.length - 1) {
        this.editor.commands.toggleMark(mark);
      }
    });
    this.chunk = '';
  }

  processCodeFence() {
    if (this.isCodeBlockActive()) {
      this.editor.commands.deleteRange({
        from: this.editor.state.selection.from - 1,
        to: this.editor.state.selection.from,
      });
      this.editor.commands.insertContent('```');
      this.editor.commands.toggleCodeBlock();
    } else {
      this.editor.commands.insertContent(this.chunk);
      this.isCodeBlockStart = true;
    }

    this.chunk = '';
  }

  activateList(listType: 'bulletList' | 'orderedList') {
    const listDepth = Math.round(this.chunk.match(/^\s*/)[0].length / 3);

    // Adjust current list depth to match the list depth of the chunk
    if (listDepth > this.currentListDepth) {
      for (let i = 0; i < listDepth - this.currentListDepth; i++) {
        this.editor.commands.sinkListItem('listItem');
      }
    } else if (listDepth < this.currentListDepth) {
      for (let i = 0; i < this.currentListDepth - listDepth; i++) {
        this.editor.commands.liftListItem('listItem');
      }
    }

    this.currentListDepth = listDepth;
    this.isLineStart = false;
    this.chunk = this.chunk.replace(/^\s*[-*\d]+\.?\s/, '');

    // Start a new list if not in a list
    if (!this.isInList) {
      this.isInList = true;

      // insert a list item with a random character and then delete it to toggle list
      // this is a workaround to make the entire editing process revertible within a single undo step
      if (listType === 'bulletList') {
        this.editor.commands.insertContent('- a');
      } else {
        this.editor.commands.insertContent('1. a');
      }
      this.editor.commands.deleteRange({
        from: this.editor.state.selection.from - 1,
        to: this.editor.state.selection.from,
      });
      return;
    }

    // Already in a list, make sure the list type matches
    if (!this.editor.isActive(listType)) {
      if (listType === 'bulletList') {
        this.editor.commands.toggleBulletList();
      } else {
        this.editor.commands.toggleOrderedList();
      }
    }
  }

  deactivateList() {
    if (!this.isInList) {
      return;
    }

    // Reset list depth to 0
    for (let i = 0; i < this.currentListDepth; i++) {
      this.editor.commands.liftListItem('listItem');
    }
    this.currentListDepth = 0;

    this.isInList = false;
    this.editor.commands.enter();
  }

  process(token: string) {
    if (!this.editor) {
      return;
    }

    this.chunk += token;

    // Skip processing if the chunk is part of the closing canvas tag (including HTML entities)
    if (
      this.chunk === '<' ||
      '</reflyCanvas>'.startsWith(this.chunk) ||
      this.chunk === '&' ||
      '&lt;/reflyCanvas'.startsWith(this.chunk) ||
      '&lt;/reflyCanvas&gt;'.startsWith(this.chunk)
    ) {
      return;
    }

    // If the chunk contains the closing tag (including HTML entities), only process content before it
    if (
      this.chunk.includes('</reflyCanvas>') ||
      this.chunk.includes('&lt;/reflyCanvas') ||
      this.chunk.includes('&lt;/reflyCanvas&gt;')
    ) {
      const content = this.chunk
        .split('</reflyCanvas>')[0]
        .split('&lt;/reflyCanvas')[0]
        .split('&lt;/reflyCanvas&gt;')[0];

      if (content) {
        this.chunk = content;
      } else {
        return;
      }
    }

    // Wait for the next token if the current chunk only contains whitespace or
    // markdown syntax element (list, heading, marks, etc.)
    if (this.chunk.match(/^[-*_#`>~ ]+$/)) {
      return;
    }

    if (this.isLineStart) {
      // If the chunk is a number string with an optional dot, it could be a ordered list item
      if (/^\d+\.?$/.test(this.chunk)) {
        return;
      }

      const isBulletList = /^\s*[-*]\s/.test(this.chunk);
      const isOrderedList = /^\s*\d+\.\s/.test(this.chunk);
      const isCodeFence = /^\s*```/.test(this.chunk);

      if (isBulletList || isOrderedList) {
        this.activateList(isBulletList ? 'bulletList' : 'orderedList');
      } else {
        if (this.isInList) {
          this.deactivateList();
        }
      }

      if (isCodeFence) {
        this.processCodeFence();
        return;
      }
    }

    // Check if the chunk contains any mark pattern outside of code block
    if (!this.isCodeBlockActive()) {
      for (const pattern of this.markPatterns) {
        if (this.chunk.includes(pattern.pattern)) {
          this.processMark(pattern.pattern, pattern.mark);
          return;
        }
      }
    }

    this.insertContent(this.chunk);
  }

  reset() {
    this.chunk = '';
    this.isLineStart = true;
    this.isCodeBlockStart = false;
    this.isInList = false;
    this.currentListDepth = 0;
  }
}
