import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { SubscriptionPlanType } from '@refly/openapi-schema';

interface SubscriptionState {
  // state
  planType: SubscriptionPlanType;
  subscribeModalVisible: boolean;
  storageExceededModalVisible: boolean;
  creditInsufficientModalVisible: boolean;
  creditInsufficientMembershipLevel: string;
  openedFromSettings: boolean; // Track if SubscribeModal was opened from SettingModal

  // method
  setPlanType: (val: SubscriptionPlanType) => void;
  setSubscribeModalVisible: (val: boolean) => void;
  setStorageExceededModalVisible: (val: boolean) => void;
  setCreditInsufficientModalVisible: (val: boolean, membershipLevel?: string) => void;
  setOpenedFromSettings: (val: boolean) => void; // Method to set the openedFromSettings state
}

export const useSubscriptionStore = create<SubscriptionState>()(
  devtools((set) => ({
    planType: 'free',
    subscribeModalVisible: false,
    storageExceededModalVisible: false,
    creditInsufficientModalVisible: false,
    creditInsufficientMembershipLevel: '',
    openedFromSettings: false,

    setPlanType: (val: SubscriptionPlanType) => set({ planType: val }),
    setSubscribeModalVisible: (val: boolean) => set({ subscribeModalVisible: val }),
    setStorageExceededModalVisible: (val: boolean) => set({ storageExceededModalVisible: val }),
    setCreditInsufficientModalVisible: (val: boolean, membershipLevel?: string) =>
      set({
        creditInsufficientModalVisible: val,
        creditInsufficientMembershipLevel: membershipLevel || '',
      }),
    setOpenedFromSettings: (val: boolean) => set({ openedFromSettings: val }),
  })),
);

export const useSubscriptionStoreShallow = <T>(selector: (state: SubscriptionState) => T) => {
  return useSubscriptionStore(useShallow(selector));
};
