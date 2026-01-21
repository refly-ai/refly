import { memo, useMemo } from 'react';
import mime from 'mime';
import { DriveFile, VariableValue } from '@refly/openapi-schema';
import { RESOURCE_TYPE_ICON_MAP } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/input-parameter-row';
import { FilePreview } from '@refly-packages/ai-workspace-common/components/canvas/canvas-resources/file-preview';
import { Attachment, Checked, List } from 'refly-icons';
import { BiText } from 'react-icons/bi';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';

interface VariableHoverCardProps {
  variableType: 'string' | 'option' | 'resource';
  label: string;
  options?: string[];
  value?: VariableValue[];
}

export const VariableHoverCard = memo(
  ({ variableType, label, options, value }: VariableHoverCardProps) => {
    const { t } = useTranslation();
    const { canvasId } = useCanvasContext();
    const resource = value?.[0]?.resource;

    const selectedValues = useMemo(() => {
      if (variableType === 'option') {
        return value?.map((val) => val.text) ?? [];
      }
      return [];
    }, [variableType, value]);

    const renderContent = () => {
      switch (variableType) {
        case 'string':
          return (
            <div className="flex flex-col gap-2 bg-refly-bg-content-z2 py-3 w-[256px] max-h-[160px] overflow-hidden">
              <div className="flex items-center px-3">
                <BiText size={18} className="mr-2" />
                <div className="text-sm font-bold">
                  {t('canvas.workflow.variables.variableTypeOptions.string')}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto text-xs break-all leading-[18px]">
                <div className="mx-3">
                  <div className="text-refly-func-warning-hover">{label}</div>
                  {value?.[0]?.text || t('common.noData')}
                </div>
              </div>
            </div>
          );
        case 'option':
          return (
            <div className="flex flex-col gap-2 bg-refly-bg-content-z2 py-3 w-[256px] max-h-[160px] overflow-hidden">
              <div className="flex items-center px-3">
                <List size={18} className="mr-2" />
                <div className="text-sm font-bold">
                  {t('canvas.workflow.variables.variableTypeOptions.option')}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto rounded-lg">
                <div className="text-xs text-refly-func-warning-hover leading-[18px] mx-3 mb-1.5">
                  {label}
                </div>
                <div className="flex flex-col gap-1.5">
                  {options?.map((opt, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 mx-3 px-2 py-1.5 text-xs bg-refly-bg-canvas rounded-[4px]"
                    >
                      <div className="text-refly-text-0">{opt}</div>
                      {selectedValues.includes(opt) && (
                        <Checked size={16} color="var(--refly-primary-default)" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        case 'resource': {
          const Icon =
            RESOURCE_TYPE_ICON_MAP[resource?.fileType as keyof typeof RESOURCE_TYPE_ICON_MAP] ??
            Attachment;
          return (
            <div
              className={cn(
                'flex flex-col gap-2 w-[256px] overflow-hidden p-3',
                !resource || resource?.fileType === 'document'
                  ? 'bg-refly-bg-content-z2 h-[160px]'
                  : '',
                resource?.fileType === 'audio' ? 'bg-refly-bg-content-z2 h-auto' : '',
                ['image', 'video'].includes(resource?.fileType as string) ? '!p-0' : '',
              )}
            >
              <div
                className={cn(
                  'flex items-center',
                  ['image', 'video'].includes(resource?.fileType as string)
                    ? 'absolute top-0 left-0 w-full px-3 h-[45px] rounded-t-xl z-10 text-refly-bg-body-z0 bg-gradient-to-b from-black/50 to-transparent'
                    : '',
                )}
              >
                <Icon size={18} className="mr-2" />
                <div className="text-sm font-bold">
                  {t('canvas.workflow.variables.variableTypeOptions.resource')}
                </div>
                <Divider
                  type="vertical"
                  className={cn(
                    'mx-1.5',
                    ['image', 'video'].includes(resource?.fileType as string)
                      ? 'bg-refly-bg-body-z0'
                      : 'bg-refly-Card-Border ',
                  )}
                />
                <div className="text-sm font-bold flex-1 truncate">{resource?.name}</div>
              </div>

              <div
                className={cn(
                  'relative flex-1 overflow-hidden min-h-0',
                  resource?.fileType === 'document' ? 'rounded-lg' : '',
                )}
              >
                {resource ? (
                  <FilePreview
                    file={
                      {
                        fileId: resource.fileId,
                        name: resource.name,
                        type: (mime.getType(resource.name) ||
                          resource.fileType) as DriveFile['type'],
                        canvasId,
                      } as DriveFile
                    }
                    source="card"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-refly-text-3 opacity-60 py-4">
                    <span className="text-[11px] text-center px-4">{t('common.noData')}</span>
                  </div>
                )}

                {resource?.fileType === 'document' && (
                  <div className="absolute bottom-0 left-0 w-full h-[45px] rounded-b-lg z-10 text-refly-bg-body-z0 bg-gradient-to-t from-[#F6F6F6]/50 to-transparent" />
                )}
              </div>
            </div>
          );
        }
        default:
          return null;
      }
    };

    return <div className="shadow-xl rounded-xl overflow-hidden">{renderContent()}</div>;
  },
);

VariableHoverCard.displayName = 'VariableHoverCard';
