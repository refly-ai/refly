import {
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from '@codesandbox/sandpack-react/unstyled';
import * as shadcnComponents from './shadcn';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { useState, useCallback, memo, useMemo } from 'react';
import { Button, message } from 'antd';
import { IconClose } from '@arco-design/web-react/icon';
import { useTranslation } from 'react-i18next';

const ReactCodeRunner = memo(
  ({
    code,
    // biome-ignore lint/correctness/noUnusedVariables: <explanation>
    language,
    title,
    onRequestFix,
    showErrorMessage = true,
  }: {
    code: string;
    title: string;
    language?: string;
    onRequestFix?: (e: string) => void;
    showErrorMessage?: boolean;
  }) => {
    console.log('title', title);
    // Memoize tsconfig
    const tsConfig = useMemo(
      () => `{
        "include": [
          "./**/*"
        ],
        "compilerOptions": {
          "strict": true,
          "esModuleInterop": true,
          "lib": [ "dom", "es2015" ],
          "jsx": "react-jsx",
          "baseUrl": "./",
          "paths": {
            "@/components/*": ["components/*"]
          }
        }
      }`,
      [],
    );

    return (
      <SandpackProvider
        key={code}
        template="react-ts"
        className="relative h-full w-full [&_.sp-preview-container]:flex [&_.sp-preview-container]:h-full [&_.sp-preview-container]:w-full [&_.sp-preview-container]:grow [&_.sp-preview-container]:flex-col [&_.sp-preview-container]:justify-center [&_.sp-preview-iframe]:grow"
        files={{
          'App.tsx': code,
          ...shadcnFiles,
          '/tsconfig.json': {
            code: tsConfig,
          },
        }}
        options={{
          externalResources: ['https://unpkg.com/@tailwindcss/ui/dist/tailwind-ui.min.css'],
        }}
        customSetup={{
          dependencies,
        }}
      >
        <SandpackPreview
          showNavigator={false}
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          showRestartButton={false}
          showOpenNewtab={false}
          className="h-full w-full"
        />
        {onRequestFix && showErrorMessage && <ErrorMessage onRequestFix={onRequestFix} />}
      </SandpackProvider>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.code === nextProps.code &&
      prevProps.language === nextProps.language &&
      prevProps.showErrorMessage === nextProps.showErrorMessage &&
      prevProps.onRequestFix === nextProps.onRequestFix
    );
  },
);

export default ReactCodeRunner;

const ErrorMessage = memo(
  ({ onRequestFix }: { onRequestFix: (e: string) => void }) => {
    const { sandpack } = useSandpack();
    const [didCopy, setDidCopy] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const { t } = useTranslation();

    const handleClose = useCallback(() => {
      setIsVisible(false);
      message.info(t('codeArtifact.fix.errorDismissed'));
    }, [t]);

    const handleCopy = useCallback(async () => {
      if (!sandpack.error) return;

      try {
        setDidCopy(true);
        await window.navigator.clipboard.writeText(sandpack.error.message);
        message.success(t('codeArtifact.errorCopySuccess'));
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setDidCopy(false);
      } catch (error) {
        console.error('Failed to copy error message:', error);
        message.error(t('codeArtifact.errorCopyFailed'));
        setDidCopy(false);
      }
    }, [sandpack.error, t]);

    const handleRequestFix = useCallback(() => {
      if (!sandpack.error) return;
      onRequestFix(sandpack.error.message);
      message.info(t('codeArtifact.fix.requestingFix'));
    }, [sandpack.error, onRequestFix, t]);

    if (!sandpack.error || !isVisible) return null;

    return (
      <div className="absolute inset-0 px-4 flex flex-col items-center justify-center gap-4 bg-white/5 text-base backdrop-blur-sm">
        <div className="relative w-full max-w-[600px] rounded-md bg-red-600 p-4 text-white shadow-xl shadow-black/20">
          <div className="absolute right-2 top-2">
            <Button
              type="text"
              onClick={handleClose}
              className="rounded-full p-1 text-white hover:bg-red-700 hover:text-white"
              aria-label={t('codeArtifact.fix.closeErrorMessage')}
            >
              <IconClose className="hover:text-white text-white" />
            </Button>
          </div>

          <p className="text-lg font-medium">{t('codeArtifact.fix.error')}</p>

          <p className="mt-4 line-clamp-[10] overflow-x-auto whitespace-pre font-mono text-xs">
            {sandpack.error.message}
          </p>

          <div className="mt-8 flex justify-between gap-4">
            <Button
              type="text"
              onClick={handleCopy}
              className="rounded border border-red-300 px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
              title={t('codeArtifact.fix.copyErrorMessage')}
            >
              {didCopy ? (
                <CheckIcon size={18} className="text-white hover:text-white" />
              ) : (
                <CopyIcon size={18} className="text-white hover:text-white" />
              )}
            </Button>
            <Button
              type="default"
              onClick={handleRequestFix}
              className="rounded bg-white px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-gray-100"
            >
              {t('codeArtifact.fix.tryToFix')}
            </Button>
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if the onRequestFix function reference changes
    return prevProps.onRequestFix === nextProps.onRequestFix;
  },
);

const shadcnFiles = {
  '/lib/utils.ts': shadcnComponents.utils,
  '/components/ui/accordion.tsx': shadcnComponents.accordian,
  '/components/ui/alert-dialog.tsx': shadcnComponents.alertDialog,
  '/components/ui/alert.tsx': shadcnComponents.alert,
  '/components/ui/avatar.tsx': shadcnComponents.avatar,
  '/components/ui/badge.tsx': shadcnComponents.badge,
  '/components/ui/breadcrumb.tsx': shadcnComponents.breadcrumb,
  '/components/ui/button.tsx': shadcnComponents.button,
  '/components/ui/calendar.tsx': shadcnComponents.calendar,
  '/components/ui/card.tsx': shadcnComponents.card,
  '/components/ui/carousel.tsx': shadcnComponents.carousel,
  '/components/ui/checkbox.tsx': shadcnComponents.checkbox,
  '/components/ui/collapsible.tsx': shadcnComponents.collapsible,
  '/components/ui/dialog.tsx': shadcnComponents.dialog,
  '/components/ui/drawer.tsx': shadcnComponents.drawer,
  '/components/ui/dropdown-menu.tsx': shadcnComponents.dropdownMenu,
  '/components/ui/input.tsx': shadcnComponents.input,
  '/components/ui/label.tsx': shadcnComponents.label,
  '/components/ui/menubar.tsx': shadcnComponents.menuBar,
  '/components/ui/navigation-menu.tsx': shadcnComponents.navigationMenu,
  '/components/ui/pagination.tsx': shadcnComponents.pagination,
  '/components/ui/popover.tsx': shadcnComponents.popover,
  '/components/ui/progress.tsx': shadcnComponents.progress,
  '/components/ui/radio-group.tsx': shadcnComponents.radioGroup,
  '/components/ui/select.tsx': shadcnComponents.select,
  '/components/ui/separator.tsx': shadcnComponents.separator,
  '/components/ui/skeleton.tsx': shadcnComponents.skeleton,
  '/components/ui/slider.tsx': shadcnComponents.slider,
  '/components/ui/switch.tsx': shadcnComponents.switchComponent,
  '/components/ui/table.tsx': shadcnComponents.table,
  '/components/ui/tabs.tsx': shadcnComponents.tabs,
  '/components/ui/textarea.tsx': shadcnComponents.textarea,
  '/components/ui/toast.tsx': shadcnComponents.toast,
  '/components/ui/toaster.tsx': shadcnComponents.toaster,
  '/components/ui/toggle-group.tsx': shadcnComponents.toggleGroup,
  '/components/ui/toggle.tsx': shadcnComponents.toggle,
  '/components/ui/tooltip.tsx': shadcnComponents.tooltip,
  '/components/ui/use-toast.tsx': shadcnComponents.useToast,
  '/components/ui/index.tsx': `
  export * from "./button"
  export * from "./card"
  export * from "./input"
  export * from "./label"
  export * from "./select"
  export * from "./textarea"
  export * from "./avatar"
  export * from "./radio-group"
  `,
  '/public/index.html': `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body>
        <div id="root"></div>
      </body>
    </html>
  `,
};

const dependencies = {
  'lucide-react': 'latest',
  recharts: '2.9.0',
  'react-router-dom': 'latest',
  '@radix-ui/react-accordion': '^1.2.0',
  '@radix-ui/react-alert-dialog': '^1.1.1',
  '@radix-ui/react-aspect-ratio': '^1.1.0',
  '@radix-ui/react-avatar': '^1.1.0',
  '@radix-ui/react-checkbox': '^1.1.1',
  '@radix-ui/react-collapsible': '^1.1.0',
  '@radix-ui/react-dialog': '^1.1.1',
  '@radix-ui/react-dropdown-menu': '^2.1.1',
  '@radix-ui/react-hover-card': '^1.1.1',
  '@radix-ui/react-label': '^2.1.0',
  '@radix-ui/react-menubar': '^1.1.1',
  '@radix-ui/react-navigation-menu': '^1.2.0',
  '@radix-ui/react-popover': '^1.1.1',
  '@radix-ui/react-progress': '^1.1.0',
  '@radix-ui/react-radio-group': '^1.2.0',
  '@radix-ui/react-select': '^2.1.1',
  '@radix-ui/react-separator': '^1.1.0',
  '@radix-ui/react-slider': '^1.2.0',
  '@radix-ui/react-slot': '^1.1.0',
  '@radix-ui/react-switch': '^1.1.0',
  '@radix-ui/react-tabs': '^1.1.0',
  '@radix-ui/react-toast': '^1.2.1',
  '@radix-ui/react-toggle': '^1.1.0',
  '@radix-ui/react-toggle-group': '^1.1.0',
  '@radix-ui/react-tooltip': '^1.1.2',
  'class-variance-authority': '^0.7.0',
  clsx: '^2.1.1',
  'date-fns': '^3.6.0',
  'embla-carousel-react': '^8.1.8',
  'react-day-picker': '^8.10.1',
  'tailwind-merge': '^2.4.0',
  'tailwindcss-animate': '^1.0.7',
  'framer-motion': '^11.15.0',
  vaul: '^0.9.1',
  axios: '^1.7.7',
  '@ant-design/icons': 'latest',
  '@lshay/ui': 'latest',
  '@radix-ui/react-icons': 'latest',
  antd: 'latest',
};
