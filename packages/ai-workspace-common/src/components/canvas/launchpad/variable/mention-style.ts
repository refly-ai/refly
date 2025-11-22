// Add custom styles for the editor and mention, scoped to rich-chat-input only
export const mentionStyles = `
  [data-cy="rich-chat-input"] .ProseMirror {
    outline: none;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    color: var(--refly-text-0);
    padding: 0;
    margin: 0;
    resize: none;
    height: 100%;
    overflow-y: auto;
  }

  [data-cy="rich-chat-input"] .ProseMirror p {
    margin: 0;
    padding: 0;
    color: var(--refly-text-0, #1C1F23);
    font-family: "PingFang SC";
    font-style: normal;
    font-weight: 400;
  }

  /* Ensure text content is also vertically centered */
  [data-cy="rich-chat-input"] .ProseMirror p > *:not(.mention) {
    display: inline-flex;
    align-items: center;
    line-height: 1;
    vertical-align: middle;
    height: 26px;
  }
  
  /* Show placeholder text when paragraph is empty */
  [data-cy="rich-chat-input"] .ProseMirror p.is-editor-empty:first-child::before,
  [data-cy="rich-chat-input"] .ProseMirror p.is-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: var(--refly-text-3, #9ca3af);
    pointer-events: none;
  }
  
  [data-cy="rich-chat-input"] .mention {
    border-radius: 4px;
    padding: 2px 4px 2px;
    border: 1px solid var(--refly-Card-Border);
    color: var(--refly-text-0, #1C1F23);
    font-weight: 600;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    font-size: 12px;
    line-height: 16px;
    font-family: "PingFang SC";
    font-style: normal;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: all 0.2s ease;
    position: relative;
    top: -1px;
    user-select: none; /* Prevent partial native selection inside mention */
  }
  
  [data-cy="rich-chat-input"] .mention .mention-icon {
    width: 14px;
    height: 14px;
    display: inline-block;
    vertical-align: middle;
    margin-right: 2px;
    position: relative;
   
  }
  
  [data-cy="rich-chat-input"] .mention .mention-icon svg {
    width: 14px;
    height: 14px;
    display: block;
  }
  
  [data-cy="rich-chat-input"] .mention .mention-text {
    font-weight: 500;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    display: inline-block;
    vertical-align: middle;
    line-height: 1.2;
  }
  
  [data-cy="rich-chat-input"] .mention:hover {
    background-color: var(--refly-fill-hover);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  /* Custom tippy styles to override default black border */
  [data-cy="rich-chat-input"] .tippy-box {
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }
  
  [data-cy="rich-chat-input"] .tippy-arrow {
    display: none !important;
  }
  
  [data-cy="rich-chat-input"] .tippy-content {
    padding: 0 !important;
    background: transparent !important;
  }
`;
