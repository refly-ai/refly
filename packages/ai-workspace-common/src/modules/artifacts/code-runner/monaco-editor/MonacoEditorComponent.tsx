import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { Button } from 'antd';
import debounce from 'lodash.debounce';
import { useTranslation } from 'react-i18next';
import { MonacoEditorProps } from './types';
import SimpleTextEditor from './SimpleTextEditor';
import FallbackEditor from './FallbackEditor';
import {
  PRIMARY_CDN,
  FALLBACK_CDN2,
  FALLBACK_CDN3,
  MAX_LOAD_ATTEMPTS,
  getLanguageFromType,
} from './constants';
import { useThemeStoreShallow } from '../../../../stores/theme';

// Loading timeout in milliseconds (8 seconds)
const EDITOR_LOADING_TIMEOUT = 1000;

const MonacoEditorComponent = React.memo(
  ({
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
    const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isEditorReady, setIsEditorReady] = useState(false);
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [useFallbackEditor, setUseFallbackEditor] = useState(false);
    const [loadingTimedOut, setLoadingTimedOut] = useState(false);

    const { themeMode } = useThemeStoreShallow((state) => ({ themeMode: state.themeMode }));

    // Get current CDN based on load attempt
    const getCurrentCDN = useCallback(() => {
      switch (loadAttempt) {
        case 0:
          return PRIMARY_CDN;
        case 1:
          return FALLBACK_CDN2;
        case 2:
          return FALLBACK_CDN3;
        default:
          return PRIMARY_CDN;
      }
    }, [loadAttempt]);

    // Start loading timeout when component mounts
    useEffect(() => {
      // Skip if we're already using fallback or if editor is ready
      if (useFallbackEditor || isEditorReady || isGenerating || loadingTimedOut) return;

      // Set a timeout to switch to SimpleTextEditor if loading takes too long
      loadTimeoutRef.current = setTimeout(() => {
        if (!isEditorReady) {
          console.log(`Monaco editor loading timed out after ${EDITOR_LOADING_TIMEOUT}ms`);
          setLoadingTimedOut(true);
        }
      }, EDITOR_LOADING_TIMEOUT);

      // Clear timeout on cleanup
      return () => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }
      };
    }, [isEditorReady, useFallbackEditor, isGenerating, loadingTimedOut]);

    // Debounced onChange handler to prevent too frequent updates
    const debouncedOnChange = useMemo(
      () =>
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

      try {
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
          // Reduce max tokenization line length
          maxTokenizationLineLength: 2000,
        });

        // Clear the loading timeout since editor is ready
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }

        setIsEditorReady(true);
        setLoadingError(null);
      } catch (error) {
        console.error('Error configuring Monaco editor:', error);
        setLoadingError((error as Error).message);
      }
    }, []);

    // Configure Monaco instance before mounting
    const handleEditorWillMount = useCallback((monaco: Monaco) => {
      try {
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
      } catch (error) {
        console.error('Error defining Monaco theme:', error);
      }
    }, []);

    // Handle editor loading errors
    const handleEditorError = useCallback(
      (error: Error) => {
        const currentCDN = getCurrentCDN();
        console.error(`Monaco editor loading failed from ${currentCDN}:`, error);

        if (loadAttempt < MAX_LOAD_ATTEMPTS - 1) {
          // Try next CDN
          setLoadAttempt(loadAttempt + 1);
        } else {
          // All CDNs failed, use fallback editor
          setUseFallbackEditor(true);
          setLoadingError(`Failed to load editor: ${error.message}`);
        }
      },
      [loadAttempt, getCurrentCDN],
    );

    // Update editor content when prop changes
    useEffect(() => {
      if (isEditorReady && editorRef.current) {
        try {
          const model = editorRef.current.getModel();
          if (model && model.getValue() !== content) {
            // Use setValue instead of setValueUnflushed for more compatibility
            model.setValue?.(content);
          }
        } catch (error) {
          console.error('Error updating editor content:', error);
        }
      }
    }, [content, isEditorReady]);

    // Determine the editor theme
    const editorTheme = useMemo(() => {
      if (themeMode === 'dark') {
        return 'vs-dark';
      }
      if (themeMode === 'light') {
        return 'github-custom'; // Your existing light theme
      }
      // Handle 'system' theme
      if (
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      ) {
        return 'vs-dark';
      }
      return 'github-custom'; // Default to light theme for system if not dark
    }, [themeMode]);

    // Create editor props with the onError handler
    const editorProps = {
      height: '100%',
      value: content,
      className: 'refly-code-editor',
      onChange: handleEditorChange,
      language: getLanguageFromType(type, language),
      beforeMount: handleEditorWillMount,
      onMount: handleEditorDidMount,
      loading: (
        <div className="text-gray-500 flex items-center justify-center h-full dark:text-gray-400">
          {t('codeArtifact.editor.loading')}
        </div>
      ),
      options: {
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
        readOnly: readOnly || canvasReadOnly,
        scrollbar: {
          vertical: 'auto',
          horizontal: 'auto',
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          alwaysConsumeMouseWheel: false,
          useShadows: false, // Remove scrollbar shadows for cleaner look
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
      },
      theme: editorTheme, // Use the dynamic theme
      onError: handleEditorError,
    };

    // Define generation indicator before any conditional returns
    // No need for conditional rendering here, we'll do that in the return statement
    const generationIndicator = (
      <div className="bg-blue-50 text-blue-800 px-4 py-2 text-sm flex items-center justify-between dark:bg-blue-900 dark:text-blue-200">
        <div className="flex items-center">
          <div className="mr-2 w-3 h-3 bg-blue-500 rounded-full animate-pulse dark:bg-blue-400" />
          {t('codeArtifact.editor.generatingContent')}
        </div>
      </div>
    );

    // Use simple editor during generation to improve performance
    // Skip complex Monaco initialization & syntax highlighting while content is changing rapidly
    if (isGenerating || loadingTimedOut) {
      return (
        <div className="h-full">
          <SimpleTextEditor
            content={content}
            language={language}
            type={type}
            readOnly={readOnly}
            isGenerating={isGenerating}
            canvasReadOnly={canvasReadOnly}
            onChange={onChange}
          />
        </div>
      );
    }

    // Handle fallback logic when Editor can't be loaded
    if (loadingError) {
      return (
        <div className="h-full">
          <div className="h-full flex items-center justify-center bg-gray-50 text-gray-700 p-4 rounded border border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700">
            <div className="text-center">
              <p className="mb-2 font-medium">{t('codeArtifact.editor.loadError')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{loadingError}</p>
              <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors dark:bg-blue-400 dark:hover:bg-blue-300 dark:text-gray-900"
                  onClick={() => window.location.reload()}
                >
                  {t('common.refresh')}
                </Button>
                <Button
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  onClick={() => setUseFallbackEditor(true)}
                >
                  {t('codeArtifact.editor.useFallback')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // If we've exhausted all fallbacks and need to use the textarea
    if (useFallbackEditor) {
      return (
        <div className="h-full">
          <FallbackEditor
            content={content}
            language={language}
            type={type}
            readOnly={readOnly}
            isGenerating={isGenerating}
            canvasReadOnly={canvasReadOnly}
            onChange={onChange}
          />
        </div>
      );
    }

    // Return the editor with container styles that prevent double scrollbars
    return (
      <div className="h-full overflow-hidden">
        {isGenerating && generationIndicator}
        {/* Use type assertion to work around type issues with onError prop */}
        {React.createElement(Editor, editorProps as any)}
      </div>
    );
  },
);

export default MonacoEditorComponent;
