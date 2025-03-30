import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import React from 'react';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import { CodeArtifactType } from '@refly/openapi-schema';
import debounce from 'lodash.debounce';
import { useTranslation } from 'react-i18next';
import './monaco-editor.scss';

// Function to map CodeArtifactType to appropriate Monaco editor language
const getLanguageFromType = (type: CodeArtifactType, language: string): string => {
  const languageMap: Record<CodeArtifactType, string> = {
    'application/refly.artifacts.react': 'typescript',
    'image/svg+xml': 'xml',
    'application/refly.artifacts.mermaid': 'markdown',
    'text/markdown': 'markdown',
    'application/refly.artifacts.code': language,
    'text/html': 'html',
  };

  return languageMap[type] ?? language;
};

// Configure Monaco loader
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs',
  },
});

const DEFAULT_CONTENT = '\n\n';

interface MonacoEditorProps {
  content: string;
  language: string;
  type: CodeArtifactType;
  readOnly?: boolean;
  isGenerating?: boolean;
  canvasReadOnly?: boolean;
  onChange?: (value: string) => void;
}

const MonacoEditor = ({
  content,
  language,
  type,
  readOnly = false,
  isGenerating = false,
  canvasReadOnly = false,
  onChange,
}: MonacoEditorProps) => {
  const { t } = useTranslation();
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const prevContentRef = useRef(content);
  const isUserEditingRef = useRef(false);

  // Track pending update to avoid cursor jumping
  const pendingUpdateRef = useRef(false);
  const selectionRef = useRef<{ startLineNumber: number; startColumn: number } | null>(null);

  // Create a more efficient debounced change handler that persists across renders
  const debouncedOnChangeRef = useRef(
    debounce((value: string) => {
      onChange?.(value);
    }, 300),
  );

  // Handle content changes from Monaco editor
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      // Mark that the user is currently editing
      isUserEditingRef.current = true;
      // Update prevContentRef to prevent the content change from being overridden
      prevContentRef.current = value;
      // Send the change to parent component
      debouncedOnChangeRef.current(value);

      // Clear user editing flag after a short delay
      setTimeout(() => {
        isUserEditingRef.current = false;
      }, 100);
    }
  }, []);

  // Update editor content when external content changes
  useEffect(() => {
    // Only update if content has actually changed and isn't from local edit
    if (content !== prevContentRef.current && editorRef.current && !isUserEditingRef.current) {
      // Save current cursor position
      if (editorRef.current.getSelection) {
        selectionRef.current = editorRef.current.getSelection();
      }

      // Mark that we have a pending update
      pendingUpdateRef.current = true;
      prevContentRef.current = content;
    }
  }, [content]);

  // Apply model updates in a controlled way to preserve cursor position
  useEffect(() => {
    if (isEditorReady && editorRef.current && pendingUpdateRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        const currentValue = model.getValue();
        if (currentValue !== content) {
          // Use setValueUnflushed for better performance
          model.setValue(content);

          // Restore cursor position if we have one saved
          if (selectionRef.current && editorRef.current.setSelection) {
            setTimeout(() => {
              if (editorRef.current) {
                editorRef.current.setSelection(selectionRef.current);
                editorRef.current.revealPositionInCenter(selectionRef.current);
              }
            }, 0);
          }
        }
      }
      pendingUpdateRef.current = false;
    }
  }, [content, isEditorReady]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedOnChangeRef.current.cancel();
    };
  }, []);

  // Configure editor when it's mounted
  const handleEditorDidMount = useCallback((editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure TypeScript and other languages
    if (monaco.languages.typescript) {
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.Latest,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: 'React',
        allowJs: true,
      });

      // Disable some TypeScript validations for better performance
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: false,
      });
    }

    // Set editor options with aggressive performance optimizations
    editor.updateOptions({
      tabSize: 2,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      // Performance related options
      renderWhitespace: 'none',
      renderControlCharacters: false,
      renderIndentGuides: false,
      renderValidationDecorations: 'editable',
      // Reduce the frequency of rendering
      renderFinalNewline: false,
      // Disable some features for better performance
      quickSuggestions: false,
      parameterHints: { enabled: false },
      suggestOnTriggerCharacters: false,
      acceptSuggestionOnEnter: 'off',
      tabCompletion: 'off',
      wordBasedSuggestions: false,
      folding: false,
      // Enable lazy loading of content
      largeFileOptimizations: true,
      // Reduce the max tokenization line length for large files
      maxTokenizationLineLength: 2000,
      // Additional performance optimizations for large files
      lineNumbersMinChars: 3,
      scrollBeyondLastColumn: 0,
      contextmenu: false,
      cursorBlinking: 'blink',
      cursorSmoothCaretAnimation: 'off',
      // Disable widgets to improve performance
      lightbulb: { enabled: false },
      // Improve editing performance
      wordWrap: 'on',
      wrappingStrategy: 'simple',
      // Disable features that could slow down editing
      snippetSuggestions: 'none',
      hover: { enabled: false, delay: 300 },
      // Optimize undo stack
      autoIndent: 'brackets',
    });

    setIsEditorReady(true);
  }, []);

  // Configure Monaco instance before mounting
  const handleEditorWillMount = useCallback((monaco: Monaco) => {
    // Register a custom theme with minimal styling
    monaco.editor.defineTheme('github-custom', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '008000' },
        { token: 'keyword', foreground: '0000FF' },
        { token: 'string', foreground: 'A31515' },
        { token: 'number', foreground: '098658' },
        { token: 'regexp', foreground: '800000' },
      ],
      colors: {
        'editor.foreground': '#000000',
        'editor.background': '#ffffff',
        'editor.selectionBackground': '#b3d4fc',
        'editor.lineHighlightBackground': '#f5f5f5',
        'editorCursor.foreground': '#000000',
        'editorWhitespace.foreground': '#d3d3d3',
      },
    });

    // Configure editor to handle large files better
    monaco.editor.setTheme('github-custom');
  }, []);

  // Memoize the readonly state to prevent unnecessary renders
  const isReadOnly = useMemo(
    () => readOnly || isGenerating || canvasReadOnly,
    [readOnly, isGenerating, canvasReadOnly],
  );

  return (
    <div className="h-full" style={{ minHeight: '500px' }}>
      <Editor
        height="100%"
        value={content || DEFAULT_CONTENT}
        className="refly-code-editor"
        onChange={handleEditorChange}
        language={getLanguageFromType(type, language)}
        beforeMount={handleEditorWillMount}
        onMount={handleEditorDidMount}
        loading={<div className="text-gray-500">{t('codeArtifact.editor.loading')}</div>}
        options={{
          automaticLayout: true,
          minimap: {
            enabled: false, // Disable minimap for better performance
          },
          scrollBeyondLastLine: false,
          fontSize: 14,
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontLigatures: true,
          lineNumbers: 'on',
          renderLineHighlight: 'none',
          readOnly: isReadOnly,
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            verticalScrollbarSize: 14,
            horizontalScrollbarSize: 14,
            alwaysConsumeMouseWheel: false,
          },
          // Performance optimizations
          formatOnPaste: false,
          formatOnType: false,
          autoIndent: 'brackets',
          colorDecorators: false,
          // Reduce editor features for better performance
          occurrencesHighlight: 'off',
          selectionHighlight: false,
          // Enable virtual rendering
          fixedOverflowWidgets: true,
          // Disable unnecessary features
          links: false,
          hover: {
            enabled: false,
          },
          // Improve scrolling performance
          smoothScrolling: false,
          mouseWheelScrollSensitivity: 1.5,
          fastScrollSensitivity: 7,
          wordWrap: 'on',
          wrappingStrategy: 'simple',
        }}
        theme="github-custom"
      />
    </div>
  );
};

export default React.memo(MonacoEditor, (prevProps, nextProps) => {
  // Optimize re-renders by comparing only necessary props
  return (
    prevProps.content === nextProps.content &&
    prevProps.language === nextProps.language &&
    prevProps.type === nextProps.type &&
    prevProps.readOnly === nextProps.readOnly &&
    prevProps.isGenerating === nextProps.isGenerating &&
    prevProps.canvasReadOnly === nextProps.canvasReadOnly
  );
});
