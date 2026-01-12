import { memo } from 'react';
import mime from 'mime';
import { DriveFile, VariableValue } from '@refly/openapi-schema';
import { RESOURCE_TYPE_ICON_MAP } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/input-parameter-row';
import { FilePreview } from '@refly-packages/ai-workspace-common/components/canvas/canvas-resources/file-preview';
import { Attachment, List } from 'refly-icons';
import { BiText } from 'react-icons/bi';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { Divider } from 'antd';
import { useTranslation } from 'react-i18next';

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
    console.log('resource', resource);

    const renderContent = () => {
      switch (variableType) {
        case 'string':
          return (
            <div className="flex flex-col gap-2 h-full">
              <div className="flex items-center">
                <BiText size={14} className="mr-2" />
                <div className="text-xs font-bold">
                  {t('canvas.workflow.variables.variableTypeOptions.string')}
                </div>
                <Divider type="vertical" className="bg-refly-Card-Border mx-1.5" />
                <div className="text-xs font-bold flex-1 truncate">{label}</div>
              </div>
              <div className="flex-1 overflow-y-auto text-xs break-all bg-refly-bg-control-z0 rounded-lg p-2">
                {value?.[0]?.text || 'Empty value'}
              </div>
            </div>
          );
        case 'option':
          return (
            <div className="flex flex-col gap-2 h-full">
              <div className="flex items-center">
                <List size={14} className="mr-2" />
                <div className="text-xs font-bold">
                  {t('canvas.workflow.variables.variableTypeOptions.option')}
                </div>
                <Divider type="vertical" className="bg-refly-Card-Border mx-1.5" />
                <div className="text-xs font-bold flex-1 truncate">{label}</div>
              </div>
              <div className="flex-1 overflow-y-auto rounded-lg">
                <div className="flex flex-col gap-1.5 bg-refly-bg-control-z0 p-2">
                  {options?.map((opt, i) => (
                    <div
                      key={i}
                      className="px-2 text-xs border-solid border-[1px] border-refly-Card-Border rounded-md"
                    >
                      {opt}
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
            <div className="flex flex-col gap-2 h-full overflow-hidden">
              <div className="flex items-center">
                <Icon size={14} className="mr-2" />
                <div className="text-xs font-bold">
                  {t('canvas.workflow.variables.variableTypeOptions.resource')}
                </div>
                <Divider type="vertical" className="bg-refly-Card-Border mx-1.5" />
                <div className="text-xs font-bold flex-1 truncate">{label}</div>
              </div>

              <div className="flex-1 overflow-hidden min-h-0 bg-refly-bg-control-z0 rounded-lg">
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
                    <BiText size={24} strokeWidth={1.5} />
                    <span className="text-[11px] text-center px-4">
                      {t('canvas.workflow.variables.noContent')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        }
        default:
          return null;
      }
    };

    return (
      <div className="w-[300px] max-h-[270px] flex flex-col bg-refly-bg-content-z2 p-3 shadow-xl rounded-xl border border-refly-border-1 select-text">
        {renderContent()}
      </div>
    );
  },
);

VariableHoverCard.displayName = 'VariableHoverCard';
