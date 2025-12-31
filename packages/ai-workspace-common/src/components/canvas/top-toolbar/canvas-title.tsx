import { memo, useCallback, useEffect, useRef } from 'react';
import { Tooltip, Skeleton, Typography, Avatar, Divider, Input, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { LOCALE } from '@refly/common-types';
import { IconCanvas } from '@refly-packages/ai-workspace-common/components/common/icon';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { ShareUser } from '@refly/openapi-schema';
import { AiOutlineUser } from 'react-icons/ai';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { useNavigate } from 'react-router-dom';
import { useUserStoreShallow } from '@refly/stores';
import defaultAvatar from '@refly-packages/ai-workspace-common/assets/refly_default_avatar.png';
import { LuSparkles } from 'react-icons/lu';
import { useUpdateCanvasTitle } from '@refly-packages/ai-workspace-common/hooks/canvas';
import type { InputRef } from 'antd';

export type CanvasTitleMode = 'edit' | 'view';

const CanvasTitleSyncStatus = memo(
  ({
    canvasLoading,
    syncFailureCount,
    language,
  }: {
    canvasLoading: boolean;
    syncFailureCount: number;
    language: LOCALE;
  }) => {
    const { t } = useTranslation();
    const isSyncing = canvasLoading;
    return (
      <Tooltip
        title={
          isSyncing
            ? t('canvas.toolbar.syncingChanges')
            : t('canvas.toolbar.synced', {
                time: time(new Date(), language)?.utc()?.fromNow(),
              })
        }
      >
        <div
          className={`
          relative w-2.5 h-2.5 rounded-full
          transition-colors duration-700 ease-in-out
          ${canvasLoading || syncFailureCount > 0 ? 'bg-yellow-500 animate-pulse' : 'bg-green-400'}
        `}
        />
      </Tooltip>
    );
  },
);
CanvasTitleSyncStatus.displayName = 'CanvasTitleSyncStatus';

export const CanvasTitle = memo(
  ({
    mode,
    setMode,
    canvasLoading,
    canvasTitle,
    language,
    syncFailureCount,
    canvasId,
  }: {
    mode: CanvasTitleMode;
    setMode: (mode: CanvasTitleMode) => void;
    canvasLoading: boolean;
    canvasTitle: string;
    language: LOCALE;
    syncFailureCount: number;
    canvasId: string;
  }) => {
    const { t } = useTranslation();
    const {
      editedTitle,
      setEditedTitle,
      isAutoNaming: isLoading,
      updateTitle,
      handleAutoName,
    } = useUpdateCanvasTitle(canvasId, canvasTitle);
    const inputRef = useRef<InputRef | null>(null);

    const focusInput = useCallback(() => {
      if (inputRef.current) {
        inputRef.current.focus({ cursor: 'end' });
      }
    }, []);

    useEffect(() => {
      if (mode === 'edit') {
        focusInput();
      }
    }, [mode, focusInput]);

    const handleAutoNameWithFocus = useCallback(async () => {
      focusInput();
      await handleAutoName();
    }, [focusInput, handleAutoName]);

    const handleSubmit = useCallback(async () => {
      const newTitle = await updateTitle();
      if (newTitle !== undefined) {
        setMode('view');
      }
    }, [updateTitle, setMode]);

    const handleClick = useCallback(() => {
      setMode('edit');
    }, [setMode]);

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        // Check if the blur is caused by clicking the auto-name button
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (relatedTarget?.closest('.auto-name-button')) {
          return; // Don't submit if clicking the auto-name button
        }
        handleSubmit();
      },
      [handleSubmit],
    );

    const handleInputKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.keyCode === 13 && !e.nativeEvent.isComposing) {
          e.preventDefault();
          handleSubmit();
        }
        if (e.keyCode === 27) {
          // Escape key
          setEditedTitle(canvasTitle);
          setMode('view');
        }
      },
      [handleSubmit, canvasTitle, setMode],
    );

    if (mode === 'edit') {
      return (
        <div className="w-80 h-[30px] px-1.5 group flex items-center gap-2 text-sm font-semibold">
          <CanvasTitleSyncStatus
            canvasLoading={canvasLoading}
            syncFailureCount={syncFailureCount}
            language={language}
          />
          <div className="relative flex-1">
            <Input
              className="pr-8"
              ref={inputRef}
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              placeholder={t('canvas.toolbar.editTitlePlaceholder')}
              onKeyDown={handleInputKeyDown}
              onBlur={handleBlur}
              suffix={
                <Tooltip title={t('canvas.toolbar.autoName')}>
                  <Button
                    type="text"
                    size="small"
                    className="auto-name-button absolute right-0.5 top-1/2 -translate-y-1/2 text-refly-text-2"
                    onClick={handleAutoNameWithFocus}
                    loading={isLoading}
                    icon={<LuSparkles className="h-3.5 w-3.5 flex items-center" />}
                  />
                </Tooltip>
              }
            />
          </div>
        </div>
      );
    }

    return (
      <div
        className="py-1 px-1.5 group flex items-center gap-2 text-sm font-semibold hover:bg-refly-tertiary-hover rounded-lg cursor-pointer"
        data-cy="canvas-title-edit"
      >
        <CanvasTitleSyncStatus
          canvasLoading={canvasLoading}
          syncFailureCount={syncFailureCount}
          language={language}
        />

        {canvasLoading && !canvasTitle ? (
          <Skeleton className="w-32" active paragraph={false} />
        ) : (
          <Typography.Text
            className="!max-w-72 text-refly-text-0"
            ellipsis={{ tooltip: true }}
            onClick={handleClick}
          >
            {canvasTitle || t('common.untitled')}
          </Typography.Text>
        )}
      </div>
    );
  },
);
CanvasTitle.displayName = 'CanvasTitle';

export const ReadonlyCanvasTitle = memo(
  ({
    canvasTitle,
    isLoading,
    owner,
    hideLogoButton,
  }: {
    canvasTitle?: string;
    isLoading: boolean;
    owner?: ShareUser;
    hideLogoButton?: boolean;
  }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isLogin } = useUserStoreShallow((state) => ({
      isLogin: state.isLogin,
    }));

    return (
      <div
        className="ml-1 group flex items-center gap-2 text-sm font-bold text-gray-500"
        data-cy="canvas-title-readonly"
      >
        {!hideLogoButton && (
          <>
            <Tooltip
              title={t(isLogin ? 'canvas.toolbar.backDashboard' : 'canvas.toolbar.backHome')}
              arrow={false}
              align={{ offset: [20, -8] }}
            >
              <div
                className="flex-shrink-0 flex items-center justify-center h-8 w-8 hover:bg-refly-tertiary-hover rounded-lg cursor-pointer"
                onClick={() => navigate('/')}
              >
                <Logo
                  textProps={{ show: false }}
                  logoProps={{ show: true, className: '!w-5 !h-5' }}
                />
              </div>
            </Tooltip>

            <Divider type="vertical" className="m-0 h-5 bg-refly-Card-Border" />
          </>
        )}
        <IconCanvas />
        {isLoading ? (
          <Skeleton className="w-32" active paragraph={false} />
        ) : (
          <>
            <Typography.Text className="!max-w-64 text-gray-500" ellipsis={{ tooltip: true }}>
              {canvasTitle || t('common.untitled')}
            </Typography.Text>

            {owner && (
              <>
                <Divider type="vertical" className="h-6 mx-1" />
                <Avatar
                  src={owner.avatar || defaultAvatar}
                  size={18}
                  shape="circle"
                  icon={!owner.avatar ? <AiOutlineUser /> : undefined}
                />
                <Typography.Text
                  className="text-gray-500 font-light text-sm"
                  ellipsis={{ tooltip: true }}
                >
                  {owner.nickname ? owner.nickname : `@${owner.name}`}
                </Typography.Text>
              </>
            )}
          </>
        )}
      </div>
    );
  },
);
ReadonlyCanvasTitle.displayName = 'ReadonlyCanvasTitle';
