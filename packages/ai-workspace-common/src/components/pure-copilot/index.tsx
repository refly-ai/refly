import { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Skeleton, message, Tooltip } from 'antd';
import { Send, Attachment } from 'refly-icons';
import { ChatInput } from '../canvas/launchpad/chat-input';
import { useCreateCanvas } from '../../hooks/canvas/use-create-canvas';
import { cn } from '@refly/utils/cn';
import { motion, AnimatePresence } from 'motion/react';
import { LuCornerRightUp } from 'react-icons/lu';
import './index.scss';
import { useCopilotStoreShallow, useUserStoreShallow } from '@refly/stores';
import { PromptSuggestion } from '@refly/openapi-schema';
import { useGetPromptSuggestions } from '@refly-packages/ai-workspace-common/queries';
import { useFileUpload } from '../../hooks/use-file-upload';
import { FileList } from '../canvas/copilot/file-list';
import { useNavigate } from 'react-router-dom';

const ACCEPT_FILE_EXTENSIONS = [
  // 文档类
  '.pdf,.docx,.doc,.txt,.md,.pptx',
  // 数据/代码类
  '.csv,.xlsx,.xls,.json,.xml,.py,.js,.html,.css',
  // 图片类
  '.png,.jpg,.jpeg,.webp,.gif',
  // 音视频类
  '.mp3,.wav,.m4a,.mp4,.mov,.avi',
].join(',');

export const defaultPromt: PromptSuggestion = {
  prompt: {
    zh: 'Refly.ai 能帮我完成哪些事情？',
    en: 'What can Refly.ai do for me?',
  },
};

export const fallbackPrompts: PromptSuggestion[] = [
  defaultPromt,
  {
    prompt: {
      zh: '搭建一个播客生成工作流，抓取昨日 Product Hunt Top 5 产品并分析其价值，生成完整播客脚本、男女声对话音频、封面与节目笔记，并通过邮件通知我。',
      en: "Build a podcast generation workflow that fetches yesterday's Product Hunt Top 5 products, analyzes their value, produces a full podcast script, male-female dialogue audio, cover art, show notes, and notifies me by email.",
    },
  },
  {
    prompt: {
      zh: '搭建一个设计素材自动化工作流，根据设计需求和风格批量生成 5 张图片，并自动适配不同平台尺寸后打包发送到邮箱。',
      en: 'Build a design asset automation workflow that generates five images based on my design requirements and style, adapts them to multiple platform sizes, and packages them for email delivery.',
    },
  },
];

interface PureCopilotProps {
  source?: 'frontPage' | 'onboarding';
  classnames?: string;
  onFloatingChange?: (visible: boolean) => void;
}

export const PureCopilot = memo(({ source, classnames, onFloatingChange }: PureCopilotProps) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [currentCanvasId, setCurrentCanvasId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop state (align with canvas/copilot)
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const { setHidePureCopilotModal, showOnboardingFormModal } = useUserStoreShallow((state) => ({
    setHidePureCopilotModal: state.setHidePureCopilotModal,
    showOnboardingFormModal: state.showOnboardingFormModal,
  }));

  const { pureCopilotCanvas, setPureCopilotCanvas, setPendingPrompt, setPendingFiles } =
    useCopilotStoreShallow((state) => ({
      pureCopilotCanvas: state.pureCopilotCanvas?.[source || 'default'],
      setPureCopilotCanvas: state.setPureCopilotCanvas,
      setPendingPrompt: state.setPendingPrompt,
      setPendingFiles: state.setPendingFiles,
    }));

  useEffect(() => {
    if (pureCopilotCanvas?.canvasId) {
      setCurrentCanvasId(pureCopilotCanvas.canvasId);
    }
  }, [pureCopilotCanvas]);

  const { debouncedCreateCanvas, createCanvas, isCreating } = useCreateCanvas({
    afterCreateSuccess: useCallback(() => {
      setTimeout(() => {
        setHidePureCopilotModal(true);
      }, 1000);
    }, [setHidePureCopilotModal]),
  });

  const {
    contextItems,
    fileCount,
    hasUploadingFiles,
    completedFileItems,
    stagedFileItems,
    relevantUploads,
    handleFileUpload,
    handleBatchFileUpload,
    handleRetryFile,
    handleRemoveFile,
    clearFiles,
    finalizeFiles,
  } = useFileUpload({
    canvasId: currentCanvasId,
    maxFileCount: 10,
    maxFileSize: 50 * 1024 * 1024,
    // NOTE: Do NOT pass onCanvasRequired here.
    // In workspace page (without real canvas context), files should always use staging mode.
    // Canvas will only be created when user sends the message, not during file upload.
  });

  const isFloatingVisible = useMemo(
    () => source === 'frontPage' && isFocused && !query.trim(),
    [source, isFocused, query],
  );

  useEffect(() => {
    onFloatingChange?.(isFloatingVisible);
  }, [isFloatingVisible, onFloatingChange]);

  const handleSendMessage = useCallback(async () => {
    if (hasUploadingFiles) {
      message.info(t('copilot.uploadInProgress'));
      return;
    }

    if (!query.trim() && completedFileItems.length === 0) return;

    // Helper function to navigate to workflow with files
    const navigateToWorkflow = async (canvasId: string) => {
      // Finalize any staged files before sending
      let finalFiles = completedFileItems;
      if (stagedFileItems.length > 0) {
        finalFiles = await finalizeFiles(canvasId);
      }

      setPendingPrompt(canvasId, query);
      setPendingFiles(canvasId, finalFiles);

      const queryParams = new URLSearchParams();
      if (source) {
        queryParams.append('source', source);
      }
      navigate(`/workflow/${canvasId}?${queryParams.toString()}`);

      if (source === 'onboarding') {
        setTimeout(() => {
          setHidePureCopilotModal(true);
        }, 1000);
      }

      clearFiles();
      setQuery('');
      setPureCopilotCanvas(source || 'default', null);
    };

    if (currentCanvasId) {
      // We have an existing canvas, use it directly
      setIsSending(true);
      try {
        await navigateToWorkflow(currentCanvasId);
      } finally {
        setIsSending(false);
      }
    } else if (stagedFileItems.length > 0 || completedFileItems.length > 0) {
      // No canvas but have files: create canvas first, then finalize files
      // This ensures files are properly associated with the new canvas
      setIsSending(true);
      try {
        const newCanvasId = await createCanvas('');
        if (newCanvasId) {
          await navigateToWorkflow(newCanvasId);
        }
      } finally {
        setIsSending(false);
      }
    } else {
      // No canvas, no files: use debounced create (original behavior)
      debouncedCreateCanvas(source, {
        initialPrompt: query,
      });

      setTimeout(() => {
        setQuery('');
      }, 1000);
    }
  }, [
    query,
    currentCanvasId,
    hasUploadingFiles,
    completedFileItems,
    stagedFileItems,
    finalizeFiles,
    clearFiles,
    source,
    setPendingPrompt,
    setPendingFiles,
    navigate,
    setHidePureCopilotModal,
    setPureCopilotCanvas,
    createCanvas,
    debouncedCreateCanvas,
    t,
  ]);

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        await handleBatchFileUpload(files);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleBatchFileUpload],
  );

  const isUploadDisabled = fileCount >= 10;

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.types?.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Ensure the copy cursor is shown
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (isUploadDisabled) return;

      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length === 0) return;

      // handleBatchFileUpload will handle the slot limiting internally
      await handleBatchFileUpload(files);
    },
    [handleBatchFileUpload, isUploadDisabled],
  );

  const handlePromptClick = useCallback((prompt: string) => {
    setQuery(prompt);
  }, []);

  const { data, isLoading, refetch } = useGetPromptSuggestions();

  useEffect(() => {
    if (!showOnboardingFormModal) {
      refetch();
    }
  }, [showOnboardingFormModal]);

  const samplePrompts = useMemo(() => {
    if (data?.data && data.data.length > 0) {
      return [defaultPromt, ...data.data];
    }
    return fallbackPrompts;
  }, [data?.data]);

  const getPromptText = useCallback(
    (prompt: PromptSuggestion) => {
      const texts = prompt.prompt ?? {};
      const currentLang = i18n.language;
      if (texts[currentLang]) return texts[currentLang];
      if (currentLang.startsWith('zh')) {
        return texts['zh-CN'] ?? texts.zh ?? texts.en ?? Object.values(texts)[0] ?? '';
      }
      return texts.en ?? Object.values(texts)[0] ?? '';
    },
    [i18n.language],
  );

  const renderSamplePrompts = (isFloating = false) => (
    <div
      className={cn(
        'w-full flex flex-col gap-3',
        isFloating
          ? 'bg-refly-bg-body-z0 px-3 pt-6 pb-3 rounded-b-xl -mt-5 shadow-refly-m'
          : 'mt-6',
      )}
    >
      {!isFloating && <div className="text-xs text-refly-text-2">{t('copilot.samplePrompt')}</div>}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton.Button active block className="!h-[46px] !rounded-xl" />
          <Skeleton.Button active block className="!h-[46px] !rounded-xl" />
          <Skeleton.Button active block className="!h-[46px] !rounded-xl" />
        </div>
      ) : (
        samplePrompts.map((prompt, index) => {
          const text = getPromptText(prompt);
          return (
            <div
              key={index}
              className={cn(
                'flex items-start justify-between gap-4 px-4 py-3 rounded-xl cursor-pointer hover:bg-refly-secondary-hover transition-colors',
                isFloating
                  ? 'bg-refly-bg-canvas'
                  : 'border-[0.5px] border-solid border-refly-text-4 bg-refly-bg-body-z0',
              )}
              onMouseDown={(e) => {
                // Use onMouseDown to trigger before blur
                e.preventDefault();
                handlePromptClick(text);
              }}
            >
              <div className="text-refly-text-0 text-sm">{text}</div>
              <LuCornerRightUp size={18} className="flex-shrink-0 text-refly-text-0" />
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div
      className={cn(
        'flex flex-col items-center w-[90%] max-w-[800px] min-w-[320px] mx-auto px-4',
        classnames,
      )}
    >
      <div className="flex items-center gap-3 mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="104"
          height="32"
          viewBox="0 0 104 32"
          fill="none"
        >
          <path
            d="M58.8915 8.37695C59.1366 8.37695 59.3426 8.56108 59.37 8.80469L60.4091 18.0576C60.4411 18.3425 60.824 18.4118 60.954 18.1562L65.7928 8.63965C65.875 8.47838 66.0406 8.37706 66.2216 8.37695H69.4706C69.8342 8.37695 70.0667 8.76424 69.8954 9.08496L62.3094 23.2783C61.6458 24.5172 61.0152 25.6565 60.4178 26.6963C59.8426 27.7362 59.2555 28.6325 58.6581 29.3848C58.0608 30.1368 57.4412 30.7233 56.7997 31.1436C56.1581 31.5638 55.4721 31.7734 54.7421 31.7734C53.9617 31.7734 53.3376 31.6674 52.87 31.4541C52.6737 31.3646 52.6001 31.1351 52.6688 30.9307L53.5126 28.4229C53.5837 28.212 53.8262 28.1197 54.0458 28.1562C54.2004 28.1783 54.3439 28.1894 54.4764 28.1895C55.0074 28.1895 55.5503 27.9356 56.1034 27.4268C56.6565 26.9179 57.2095 26.099 57.7626 24.9707L54.7499 8.94727C54.6942 8.65088 54.9219 8.37695 55.2235 8.37695H58.8915ZM43.6024 0C43.9564 0 44.3552 0.0221554 44.7977 0.0664062C45.2622 0.0885395 45.7157 0.142979 46.1581 0.231445C46.6004 0.297796 47.0318 0.3865 47.452 0.49707C47.8724 0.607697 48.2491 0.740633 48.5809 0.895508L47.618 3.91602C47.1092 3.71693 46.5894 3.58395 46.0585 3.51758C45.5275 3.45122 45.0077 3.41798 44.4989 3.41797C43.7909 3.41797 43.2712 3.62845 42.9393 4.04883C42.6296 4.46921 42.408 5.12188 42.2753 6.00684L42.076 7.10156H44.8104C45.1131 7.10156 45.3407 7.37764 45.2831 7.6748L44.8065 10.1299C44.7626 10.3562 44.5644 10.5195 44.3339 10.5195H41.5448L39.0887 24.8242C38.956 25.6427 38.7686 26.3953 38.5253 27.0811C38.2819 27.7889 37.9384 28.3974 37.496 28.9062C37.0756 29.4371 36.5336 29.8462 35.87 30.1338C35.2062 30.4435 34.3874 30.5986 33.4139 30.5986C32.6175 30.5986 31.8429 30.5322 31.0907 30.3994C30.4614 30.3095 29.9049 30.1315 29.4218 29.8662C29.2275 29.7594 29.1548 29.5231 29.2323 29.3154L30.0536 27.1152C30.1488 26.8604 30.4358 26.7381 30.6971 26.8135C30.9168 26.877 31.1367 26.9224 31.3563 26.9482C31.7324 26.9925 32.208 27.0146 32.7831 27.0146C33.4911 27.0146 34.0339 26.7266 34.41 26.1514C34.8082 25.5982 35.1064 24.6907 35.3055 23.4297L37.3964 10.5195H35.6688C35.3624 10.5195 35.1341 10.2372 35.1981 9.9375L35.7225 7.48242C35.7701 7.2604 35.9662 7.10156 36.1932 7.10156H37.9276L38.3593 4.87793C38.5141 4.0594 38.7126 3.35123 38.9559 2.75391C39.1993 2.13443 39.5206 1.62578 39.9188 1.22754C40.3392 0.8072 40.8368 0.496979 41.412 0.297852C42.0093 0.0987453 42.7397 1.9328e-05 43.6024 0ZM27.369 7.91211C28.2761 7.91213 29.0507 8.03398 29.6923 8.27734C30.3558 8.49857 30.8979 8.819 31.3182 9.23926C31.7386 9.63751 32.0478 10.1028 32.2469 10.6338C32.446 11.1647 32.5458 11.7289 32.5458 12.3262C32.5457 13.2332 32.3141 14.03 31.8495 14.7158C31.3849 15.4016 30.7321 15.9768 29.8915 16.4414C29.0729 16.8839 28.0768 17.2264 26.9042 17.4697C25.7316 17.691 24.4484 17.8018 23.0546 17.8018H22.5565C22.4017 17.7796 22.2354 17.7686 22.0585 17.7686C22.0142 18.0341 21.981 18.2778 21.9589 18.499C21.9368 18.6981 21.9257 18.8865 21.9257 19.0635C21.9257 20.0587 22.1807 20.7994 22.6893 21.2861C23.2203 21.7729 23.9616 22.0166 24.913 22.0166C25.8865 22.0166 26.7607 21.8726 27.535 21.585C28.3092 21.2974 28.8956 21.0102 29.2938 20.7227L30.1561 23.377C29.4703 23.9522 28.5859 24.4397 27.5018 24.8379C26.4178 25.2361 25.1566 25.4355 23.7186 25.4355C21.9265 25.4355 20.5105 24.9148 19.4706 23.875C18.4528 22.813 17.9432 21.3416 17.9432 19.4609C17.9433 17.6912 18.2203 16.0985 18.7733 14.6826C19.3264 13.2445 20.0455 12.0269 20.9305 11.0312C21.8375 10.0359 22.8552 9.27313 23.9833 8.74219C25.1117 8.18906 26.2406 7.91211 27.369 7.91211ZM53.1063 1.73926C53.4124 1.73926 53.6413 2.02094 53.578 2.32031L49.8182 20.0586C49.6855 20.7001 49.6856 21.1756 49.8182 21.4854C49.9731 21.795 50.2161 21.9501 50.5477 21.9502C50.9035 21.9502 51.249 21.9103 51.5829 21.8301C51.9276 21.7474 52.293 21.9963 52.2811 22.3506L52.2167 24.2793C52.2112 24.4412 52.1255 24.5923 51.9803 24.6641C51.6009 24.8516 51.1008 25.0092 50.4813 25.1367C49.7292 25.2915 48.9877 25.3691 48.2577 25.3691C47.3068 25.3691 46.577 25.1917 46.0682 24.8379C45.5815 24.4618 45.3378 23.7758 45.3378 22.7803C45.3378 22.2715 45.4043 21.6851 45.537 21.0215L49.538 2.12109C49.585 1.89868 49.7814 1.73946 50.0087 1.73926H53.1063ZM89.6219 2.64746C89.8659 2.64746 90.0745 2.82387 90.1151 3.06445L93.7264 24.4385C93.778 24.7434 93.5434 25.0212 93.2343 25.0215H89.8475C89.6007 25.0215 89.3909 24.8416 89.3534 24.5977L88.7645 20.7646H80.4579L78.5399 24.7393C78.4565 24.912 78.2816 25.0215 78.0897 25.0215H74.8358C74.4643 25.0215 74.2227 24.6313 74.3885 24.2988L85.0526 2.92383C85.1372 2.75445 85.3106 2.6476 85.4999 2.64746H89.6219ZM102.565 2.67969C102.874 2.67981 103.108 2.95645 103.058 3.26074L99.5604 24.6025C99.5208 24.8442 99.3122 25.0215 99.0673 25.0215H95.8827C95.5742 25.0212 95.3393 24.7448 95.3895 24.4404L98.9169 3.09863C98.9568 2.85723 99.1654 2.67969 99.41 2.67969H102.565ZM10.9052 1.40723C11.9229 1.40723 12.8857 1.52909 13.7928 1.77246C14.6999 2.01584 15.4856 2.39155 16.1493 2.90039C16.8129 3.38708 17.3328 4.02885 17.7089 4.8252C18.1071 5.59956 18.3065 6.5181 18.3065 7.58008C18.3065 8.79696 18.1182 9.85948 17.7421 10.7666C17.3882 11.6512 16.9124 12.4031 16.3153 13.0225C15.718 13.6198 15.032 14.0962 14.2577 14.4502C13.5055 14.782 12.7308 15.0026 11.9344 15.1133L16.1356 24.2881C16.2816 24.6069 16.0486 24.9704 15.6981 24.9707H12.0106C11.8061 24.9707 11.6232 24.8414 11.5555 24.6484L8.4823 15.877L6.19226 15.4453L4.28113 24.5879C4.23431 24.8107 4.03813 24.9706 3.81042 24.9707H0.481323C0.175252 24.9706 -0.0528957 24.6881 0.0106201 24.3887L4.6991 2.28516C4.73958 2.09514 4.89057 1.94789 5.08191 1.91406C6.0406 1.74456 7.00858 1.61977 7.98523 1.54004C9.06912 1.45157 10.0424 1.40723 10.9052 1.40723ZM86.8885 8.74805C86.8428 8.45791 86.4502 8.39969 86.3221 8.66406L82.1542 17.2754H88.2274L86.8885 8.74805ZM26.7714 11.2305C25.7979 11.2305 24.9458 11.6072 24.2157 12.3594C23.5079 13.1115 22.988 14.0516 22.6561 15.1797C23.2756 15.1797 23.9283 15.1575 24.6141 15.1133C25.322 15.069 25.9748 14.9703 26.5721 14.8154C27.1694 14.6385 27.6671 14.3946 28.0653 14.085C28.4635 13.7532 28.6629 13.3107 28.663 12.7578C28.663 12.4259 28.5411 12.0936 28.2977 11.7617C28.0543 11.4079 27.5456 11.2305 26.7714 11.2305ZM10.5399 5.45605C10.0976 5.45607 9.67731 5.47822 9.27917 5.52246C8.90305 5.54459 8.58178 5.57782 8.31628 5.62207L6.85632 12.3594H8.61511C9.25659 12.3594 9.88735 12.3039 10.5067 12.1934C11.1262 12.0606 11.669 11.839 12.1337 11.5293C12.6202 11.1975 13.0072 10.7662 13.2948 10.2354C13.6045 9.7044 13.7596 9.02946 13.7596 8.21094C13.7596 7.45871 13.5048 6.81712 12.996 6.28613C12.4871 5.73301 11.6683 5.45605 10.5399 5.45605Z"
            fill="var(--refly-text-0)"
          />
        </svg>
        <div className="text-[22px] font-semibold text-refly-text-0">
          {t('copilot.greeting.title')}
        </div>
      </div>

      <div
        className="w-full relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div
          className={cn(
            'w-full px-4 py-3 rounded-[12px] border-[1px] border-solid bg-refly-bg-content-z2 transition-all duration-300 relative z-20',
            source === 'frontPage'
              ? cn('border-refly-primary-default my-2')
              : 'border-transparent pure-copilot-glow-effect',
          )}
        >
          {fileCount > 0 && (
            <FileList
              contextItems={contextItems}
              canvasId={currentCanvasId}
              onRemove={handleRemoveFile}
              onRetry={handleRetryFile}
              uploads={relevantUploads}
              className="mb-3"
            />
          )}

          <div className={cn('mb-1', source === 'onboarding' && 'min-h-[80px]')}>
            <ChatInput
              readonly={false}
              autoFocus={false}
              query={query}
              setQuery={setQuery}
              handleSendMessage={handleSendMessage}
              placeholder={t('copilot.pureCopilotPlaceholder')}
              minRows={2}
              inputClassName="text-lg text-refly-text-1"
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                // Use a small timeout to allow clicking on sample prompts
                setTimeout(() => setIsFocused(false), 200);
              }}
              onUploadImage={handleFileUpload}
              onUploadMultipleImages={handleBatchFileUpload}
            />
          </div>
          <div className="flex items-center justify-between">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              multiple
              accept={ACCEPT_FILE_EXTENSIONS}
              className="hidden"
            />
            <Tooltip
              title={fileCount >= 10 ? t('copilot.maxFilesPerTask') : t('copilot.uploadFile')}
              placement="top"
              overlayInnerStyle={{ borderRadius: '8px' }}
              color="#000"
            >
              <div
                className={cn(
                  'flex items-center justify-center',
                  fileCount >= 10 ? 'cursor-not-allowed' : 'cursor-pointer',
                )}
              >
                <Button
                  type="text"
                  icon={<Attachment size={20} />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={fileCount >= 10}
                  className="!text-refly-text-0 "
                />
              </div>
            </Tooltip>
            <Button
              type="primary"
              shape="circle"
              disabled={
                (!query.trim() && completedFileItems.length === 0) || isCreating || isSending
              }
              icon={<Send size={20} color="var(--refly-bg-canvas)" />}
              className={cn(
                '!w-9 !h-9 flex items-center justify-center border-none transition-all',
                query.trim() || completedFileItems.length > 0
                  ? '!bg-refly-text-0'
                  : '!bg-refly-primary-disabled',
              )}
              onClick={handleSendMessage}
              loading={isCreating || isSending}
            />
          </div>
        </div>

        {/* Dropzone overlay: Figma 20776-18504 (active) / 20776-18912 (limit) */}
        {isDragging && (
          <div
            className={cn(
              'absolute inset-0 z-50 rounded-[12px] border-2 border-dashed',
              'flex flex-col items-center justify-center gap-2',
              isUploadDisabled
                ? 'border-[#C7CACD] bg-[rgba(28,31,35,0.1)] backdrop-blur-[25px]'
                : 'border-[#0E9F77] bg-[rgba(14,159,119,0.25)] backdrop-blur-[25px]',
            )}
          >
            <Attachment size={32} color={isUploadDisabled ? '#1C1F23' : '#0E9F77'} />
            <div
              className={cn(
                'text-sm font-medium text-center',
                isUploadDisabled ? 'text-[#1C1F23] opacity-50' : 'text-[#1C1F23]',
              )}
            >
              {t('copilot.dropFilesToUpload')}
            </div>
            <div
              className={cn(
                'text-[10px]',
                isUploadDisabled ? 'text-[#1C1F23]/35' : 'text-[rgba(28,31,35,0.6)]',
              )}
            >
              {t('copilot.maxUploadSize')}
            </div>
          </div>
        )}

        <AnimatePresence>
          {source === 'frontPage' && isFocused && !query.trim() && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="absolute top-full left-0 w-full z-10"
            >
              {renderSamplePrompts(true)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {source !== 'frontPage' && renderSamplePrompts(false)}
    </div>
  );
});

PureCopilot.displayName = 'PureCopilot';
