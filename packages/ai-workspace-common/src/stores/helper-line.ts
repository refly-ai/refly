import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

interface helperLineState {
  // state
  helperLineHorizontal: number | undefined;
  helperLineVertical: number | undefined;

  // method
  setHelperLineHorizontal: (val: number | undefined) => void;
  setHelperLineVertical: (val: number | undefined) => void;
}

export const useHelperLineStore = create<helperLineState>()(
  devtools((set) => ({
    helperLineHorizontal: undefined,
    helperLineVertical: undefined,

    setHelperLineHorizontal: (val: number | undefined) => set({ helperLineHorizontal: val }),
    setHelperLineVertical: (val: number | undefined) => set({ helperLineVertical: val }),
  })),
);

export const useHelperLineStoreShallow = <T>(selector: (state: helperLineState) => T) => {
  return useHelperLineStore(useShallow(selector));
};
