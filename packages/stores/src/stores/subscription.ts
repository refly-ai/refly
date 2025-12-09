import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { SubscriptionPlanType } from '@refly/openapi-schema';

interface SubscriptionState {
  // state
  planType: SubscriptionPlanType;
  userType: string;
  subscribeModalVisible: boolean;
  storageExceededModalVisible: boolean;
  openedFromSettings: boolean; // Track if SubscribeModal was opened from SettingModal

  // method
  setPlanType: (val: SubscriptionPlanType) => void;
  setUserType: (val: string) => void;
  setSubscribeModalVisible: (val: boolean) => void;
  setStorageExceededModalVisible: (val: boolean) => void;
  setOpenedFromSettings: (val: boolean) => void; // Method to set the openedFromSettings state
}

export const useSubscriptionStore = create<SubscriptionState>()(
  devtools((set) => ({
    planType: 'free',
    userType: '',
    subscribeModalVisible: false,
    storageExceededModalVisible: false,
    openedFromSettings: false,

    setPlanType: (val: SubscriptionPlanType) => set({ planType: val }),
    setUserType: (val: string) => set({ userType: val }),
    setSubscribeModalVisible: (val: boolean) => set({ subscribeModalVisible: val }),
    setStorageExceededModalVisible: (val: boolean) => set({ storageExceededModalVisible: val }),
    setOpenedFromSettings: (val: boolean) => set({ openedFromSettings: val }),
  })),
);

export const useSubscriptionStoreShallow = <T>(selector: (state: SubscriptionState) => T) => {
  return useSubscriptionStore(useShallow(selector));
};
