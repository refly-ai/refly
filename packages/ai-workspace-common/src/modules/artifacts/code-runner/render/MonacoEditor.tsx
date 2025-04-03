import { useCallback, useEffect, useRef, useState } from 'react';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import { CodeArtifactType } from '@refly/openapi-schema';
import debounce from 'lodash.debounce';
import { useTranslation } from 'react-i18next';
import './monaco-editor.scss';

// Function to map CodeArtifactType to appropriate Monaco editor language
const getLanguageFromType = (type: CodeArtifactType, language: string): string => {
  const languageMap: Record<string, string> = {
    'application/refly.artifacts.react': 'typescript',
    'image/svg+xml': 'xml',
    'application/refly.artifacts.mermaid': 'markdown',
    'text/markdown': 'markdown',
    'application/refly.artifacts.code': language,
    'text/html': 'html',
    'application/refly.artifacts.mindmap': 'json',
  };

  return languageMap[type] ?? language;
};

// Configure Monaco loader
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs',
  },
});

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

  // Debounced onChange handler to prevent too frequent updates
  const debouncedOnChange = useCallback(
    debounce((value: string | undefined) => {
      if (value !== undefined) {
        onChange?.(value);
      }
    }, 300),
    [onChange],
  );

  // Handle content changes from editor
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      debouncedOnChange(value);
    },
    [debouncedOnChange],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedOnChange.cancel();
    };
  }, [debouncedOnChange]);

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

    // Set editor options
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
      // Reduce the max tokenization line length
      maxTokenizationLineLength: 2000,
    });

    setIsEditorReady(true);
  }, []);

  // Configure Monaco instance before mounting
  const handleEditorWillMount = useCallback((monaco: Monaco) => {
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
  }, []);

  // Update editor content when prop changes
  useEffect(() => {
    if (isEditorReady && editorRef.current) {
      const model = editorRef.current.getModel();
      if (model && model.getValue() !== content) {
        // Use setValueUnflushed for better performance when setting content
        console.log('model', model);
        model.setValueUnflushed?.(content);
      }
    }
  }, [content, isEditorReady]);

  return (
    <div className="h-full" style={{ minHeight: '500px' }}>
      <Editor
        height="100%"
        value={content}
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
          readOnly: readOnly || isGenerating || canvasReadOnly,
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
          autoIndent: 'none',
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
        }}
        theme="github-custom"
      />
    </div>
  );
};

export default MonacoEditor;
