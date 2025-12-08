import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { SubscriptionPlanType, Voucher } from '@refly/openapi-schema';

interface SubscriptionState {
  // state
  planType: SubscriptionPlanType;
  subscribeModalVisible: boolean;
  storageExceededModalVisible: boolean;
  openedFromSettings: boolean; // Track if SubscribeModal was opened from SettingModal

  // Voucher state
  availableVoucher: Voucher | null; // Best available voucher for the user
  voucherLoading: boolean;

  // Claimed voucher popup state (for showing popup after claiming via invite)
  claimedVoucherPopupVisible: boolean;
  claimedVoucher: Voucher | null;

  // method
  setPlanType: (val: SubscriptionPlanType) => void;
  setSubscribeModalVisible: (val: boolean) => void;
  setStorageExceededModalVisible: (val: boolean) => void;
  setOpenedFromSettings: (val: boolean) => void; // Method to set the openedFromSettings state
  setAvailableVoucher: (voucher: Voucher | null) => void;
  setVoucherLoading: (loading: boolean) => void;
  showClaimedVoucherPopup: (voucher: Voucher) => void;
  hideClaimedVoucherPopup: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  devtools((set) => ({
    planType: 'free',
    subscribeModalVisible: false,
    storageExceededModalVisible: false,
    openedFromSettings: false,
    availableVoucher: null,
    voucherLoading: false,
    claimedVoucherPopupVisible: false,
    claimedVoucher: null,

    setPlanType: (val: SubscriptionPlanType) => set({ planType: val }),
    setSubscribeModalVisible: (val: boolean) => set({ subscribeModalVisible: val }),
    setStorageExceededModalVisible: (val: boolean) => set({ storageExceededModalVisible: val }),
    setOpenedFromSettings: (val: boolean) => set({ openedFromSettings: val }),
    setAvailableVoucher: (voucher: Voucher | null) => set({ availableVoucher: voucher }),
    setVoucherLoading: (loading: boolean) => set({ voucherLoading: loading }),
    showClaimedVoucherPopup: (voucher: Voucher) =>
      set({ claimedVoucherPopupVisible: true, claimedVoucher: voucher }),
    hideClaimedVoucherPopup: () => set({ claimedVoucherPopupVisible: false, claimedVoucher: null }),
  })),
);

export const useSubscriptionStoreShallow = <T>(selector: (state: SubscriptionState) => T) => {
  return useSubscriptionStore(useShallow(selector));
};
