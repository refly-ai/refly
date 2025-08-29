// Add custom styles for the editor and mention
export const mentionStyles = `
  .ProseMirror {
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
    min-height: 2.5rem;
    max-height: 12rem;
    overflow-y: auto;
  }


  .ProseMirror p {
    margin: 0;
  }
  
  .ProseMirror p.is-editor-empty:first-child::before {
    color: var(--refly-text-3);
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }
  
  .mention {
    background-color: var(--refly-fill-default);
    border-radius: 4px;
    padding: 4px 6px;
    color: var(--refly-text-0);
    font-weight: 500;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    line-height: 1.2;
    border: 1px solid var(--refly-Card-Border);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
  }
  
  .mention .mention-icon {
    width: 20px;
    height: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  
  .mention .mention-icon svg {
    width: 20px;
    height: 20px;
  }
  
  .mention .mention-text {
    font-weight: 500;
    font-size: 14px;
    line-height: 1.2;
  }
  
  .mention:hover {
    background-color: var(--refly-fill-hover);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }

  /* Custom tippy styles to override default black border */
  .tippy-box {
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }
  
  .tippy-arrow {
    display: none !important;
  }
  
  .tippy-content {
    padding: 0 !important;
    background: transparent !important;
  }
`;
