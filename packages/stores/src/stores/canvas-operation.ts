import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { Canvas } from '@refly/openapi-schema';

// Event callback types
type CanvasRenameSuccessCallback = (canvas: Canvas) => void;
type CanvasDeleteSuccessCallback = (canvas: Canvas) => void;

interface CanvasOperationState {
  // state
  canvasId: string;
  canvasTitle: string;
  shareId?: string;
  modalVisible: boolean;
  modalType: 'rename' | 'delete' | 'duplicate';

  // event callbacks
  onRenameSuccess?: CanvasRenameSuccessCallback;
  onDeleteSuccess?: CanvasDeleteSuccessCallback;

  // method
  openRenameModal: (
    canvasId: string,
    canvasTitle: string,
    onSuccess?: CanvasRenameSuccessCallback,
  ) => void;
  openDeleteModal: (
    canvasId: string,
    canvasTitle: string,
    onSuccess?: CanvasDeleteSuccessCallback,
  ) => void;
  openDuplicateModal: (canvasId: string, canvasTitle: string, shareId?: string) => void;

  // event triggers
  triggerRenameSuccess: (canvas: Canvas) => void;
  triggerDeleteSuccess: (canvas: Canvas) => void;

  reset: () => void;
}

const defaultState = {
  canvasId: '',
  canvasTitle: '',
  shareId: undefined,
  modalVisible: false,
  modalType: 'rename' as const,
  onRenameSuccess: undefined,
  onDeleteSuccess: undefined,
};

export const useCanvasOperationStore = create<CanvasOperationState>()(
  devtools((set, get) => ({
    ...defaultState,

    openRenameModal: (
      canvasId: string,
      canvasTitle: string,
      onSuccess?: CanvasRenameSuccessCallback,
    ) =>
      set({
        canvasId,
        canvasTitle,
        modalVisible: true,
        modalType: 'rename',
        onRenameSuccess: onSuccess,
      }),
    openDeleteModal: (
      canvasId: string,
      canvasTitle: string,
      onSuccess?: CanvasDeleteSuccessCallback,
    ) =>
      set({
        canvasId,
        canvasTitle,
        modalVisible: true,
        modalType: 'delete',
        onDeleteSuccess: onSuccess,
      }),
    openDuplicateModal: (canvasId: string, canvasTitle: string, shareId?: string) =>
      set({
        canvasId,
        canvasTitle,
        shareId,
        modalVisible: true,
        modalType: 'duplicate',
      }),

    triggerRenameSuccess: (canvas: Canvas) => {
      const { onRenameSuccess } = get();
      onRenameSuccess?.(canvas);
    },
    triggerDeleteSuccess: (canvas: Canvas) => {
      const { onDeleteSuccess } = get();
      onDeleteSuccess?.(canvas);
    },

    reset: () => set({ ...defaultState }),
  })),
);

export const useCanvasOperationStoreShallow = <T>(selector: (state: CanvasOperationState) => T) => {
  return useCanvasOperationStore(useShallow(selector));
};
