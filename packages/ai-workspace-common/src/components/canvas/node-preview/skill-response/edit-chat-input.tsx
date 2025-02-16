import { useTranslation } from 'react-i18next';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useMemo, memo, useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { SelectedSkillHeader } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/selected-skill-header';
import { ContextManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import {
  ChatActions,
  CustomAction,
} from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import { ModelInfo, Skill } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { convertContextItemsToEdges } from '@refly-packages/ai-workspace-common/utils/map-context-items';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useReactFlow } from '@xyflow/react';
import { GrRevert } from 'react-icons/gr';
import { useFindSkill } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';

interface EditChatInputProps {
  enabled: boolean;
  resultId: string;
  version?: number;
  contextItems: IContextItem[];
  query: string;
  modelInfo: ModelInfo;
  actionMeta?: {
    icon?: any;
    name?: string;
  };
  setEditMode: (mode: boolean) => void;
  readonly?: boolean;
}

const EditChatInputComponent = (props: EditChatInputProps) => {
  const {
    enabled,
    resultId,
    version,
    contextItems,
    query,
    modelInfo,
    actionMeta,
    setEditMode,
    readonly,
  } = props;

  const { getEdges, getNodes, deleteElements, addEdges } = useReactFlow();
  const [editQuery, setEditQuery] = useState<string>(query);
  const [editContextItems, setEditContextItems] = useState<IContextItem[]>(contextItems);
  const [editModelInfo, setEditModelInfo] = useState<ModelInfo>(modelInfo);
  const { t } = useTranslation();
  const [localActionMeta, setLocalActionMeta] = useState<{
    name?: string;
    icon?: any;
  } | null>(actionMeta);

  const hideSelectedSkillHeader = useMemo(
    () => !localActionMeta || localActionMeta?.name === 'commonQnA' || !localActionMeta?.name,
    [localActionMeta],
  );

  const { canvasId } = useCanvasContext();
  const { invokeAction } = useInvokeAction();
  const skill = useFindSkill(localActionMeta?.name);
  const { handleUploadImage } = useUploadImage();

  const textareaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (enabled && textareaRef.current) {
      const textarea = textareaRef.current.querySelector('textarea');
      if (textarea) {
        const length = textarea.value.length;
        textarea.focus();
        textarea.setSelectionRange(length, length);
      }
    }
  }, [enabled]);

  const handleSendMessage = useCallback(() => {
    // Synchronize edges with latest context items
    const nodes = getNodes();
    const currentNode = nodes.find((node) => node.data?.entityId === resultId);
    if (!currentNode) {
      return;
    }

    const edges = getEdges();
    const { edgesToAdd, edgesToDelete } = convertContextItemsToEdges(
      resultId,
      editContextItems,
      nodes,
      edges,
    );
    addEdges(edgesToAdd);
    deleteElements({ edges: edgesToDelete });

    invokeAction(
      {
        resultId,
        version: (version ?? 0) + 1,
        query: editQuery,
        contextItems: editContextItems,
        modelInfo: editModelInfo,
        selectedSkill: skill,
      },
      {
        entityId: canvasId,
        entityType: 'canvas',
      },
    );
    setEditMode(false);
  }, [
    resultId,
    editQuery,
    editModelInfo,
    editContextItems,
    skill,
    version,
    canvasId,
    getNodes,
    getEdges,
    addEdges,
    deleteElements,
    invokeAction,
    setEditMode,
  ]);

  const customActions: CustomAction[] = useMemo(
    () => [
      {
        icon: <GrRevert className="flex items-center" />,
        title: t('copilot.chatActions.discard'),
        onClick: () => {
          setEditMode(false);
          setEditQuery(query);
          setEditContextItems(contextItems);
          setEditModelInfo(modelInfo);
        },
      },
    ],
    [setEditMode, contextItems, query, modelInfo, t],
  );

  const handleSelectSkill = useCallback((skill: Skill) => {
    setLocalActionMeta({
      icon: skill.icon,
      name: skill.name,
    });
  }, []);

  const handleImageUpload = async (file: File) => {
    const nodeData = await handleUploadImage(file, canvasId);
    if (nodeData) {
      setEditContextItems([
        ...editContextItems,
        {
          type: 'image',
          ...nodeData,
        },
      ]);
    }
  };

  if (!enabled) {
    return null;
  }

  return (
    <div className="ai-copilot-chat-container">
      <div className={cn('border border-solid border-gray-200 rounded-lg')}>
        {!hideSelectedSkillHeader && (
          <SelectedSkillHeader
            readonly={readonly}
            skill={{
              icon: localActionMeta?.icon,
              name: localActionMeta?.name,
            }}
            className="rounded-t-[7px]"
            onClose={() => {
              setLocalActionMeta(null);
            }}
          />
        )}
        <ContextManager
          className="p-2 px-3"
          contextItems={editContextItems}
          setContextItems={setEditContextItems}
        />
        <div className="px-3">
          <ChatInput
            ref={textareaRef}
            query={editQuery}
            setQuery={setEditQuery}
            selectedSkillName={localActionMeta?.name}
            handleSendMessage={handleSendMessage}
            handleSelectSkill={(skill) => {
              setEditQuery(editQuery?.slice(0, -1));
              handleSelectSkill(skill);
            }}
            onUploadImage={handleImageUpload}
          />
        </div>
        <ChatActions
          className="p-2 px-3"
          query={editQuery}
          model={editModelInfo}
          setModel={setEditModelInfo}
          handleSendMessage={handleSendMessage}
          handleAbort={() => {}}
          customActions={customActions}
          onUploadImage={handleImageUpload}
          contextItems={editContextItems}
        />

        {/* {skillStore.selectedSkill?.configSchema?.items?.length > 0 && (
      <ConfigManager
        form={form}
        formErrors={formErrors}
        setFormErrors={setFormErrors}
        schema={skillStore.selectedSkill?.configSchema}
        tplConfig={skillStore.selectedSkill?.config}
        fieldPrefix="tplConfig"
        configScope="runtime"
        resetConfig={() => {
          form.setFieldValue('tplConfig', skillStore.selectedSkill?.tplConfig || {});
        }}
      />
    )} */}
      </div>
    </div>
  );
};

const arePropsEqual = (prevProps: EditChatInputProps, nextProps: EditChatInputProps) => {
  return (
    prevProps.enabled === nextProps.enabled &&
    prevProps.resultId === nextProps.resultId &&
    prevProps.query === nextProps.query &&
    prevProps.modelInfo === nextProps.modelInfo &&
    prevProps.readonly === nextProps.readonly &&
    prevProps.contextItems === nextProps.contextItems &&
    prevProps.actionMeta?.name === nextProps.actionMeta?.name
  );
};

export const EditChatInput = memo(EditChatInputComponent, arePropsEqual);
