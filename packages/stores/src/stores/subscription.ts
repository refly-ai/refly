import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { SubscriptionPlanType, Voucher } from '@refly/openapi-schema';

interface SubscriptionState {
  // state
  planType: SubscriptionPlanType;
  userType: string;
  subscribeModalVisible: boolean;
  storageExceededModalVisible: boolean;
  creditInsufficientModalVisible: boolean;
  creditInsufficientMembershipLevel: string;
  creditInsufficientTriggeredFrom: string; // Track where the credit insufficient modal was triggered from
  openedFromSettings: boolean; // Track if SubscribeModal was opened from SettingModal

  // Voucher state
  availableVoucher: Voucher | null; // Best available voucher for the user
  voucherLoading: boolean;

  // Claimed voucher popup state (for showing popup after claiming via invite)
  claimedVoucherPopupVisible: boolean;
  claimedVoucher: Voucher | null;
  claimedVoucherInviterName: string | null; // Name of the person who sent the voucher

  // method
  setPlanType: (val: SubscriptionPlanType) => void;
  setUserType: (val: string) => void;
  setSubscribeModalVisible: (val: boolean) => void;
  setStorageExceededModalVisible: (val: boolean) => void;
  setCreditInsufficientModalVisible: (
    val: boolean,
    membershipLevel?: string,
    triggeredFrom?: string,
  ) => void;
  setOpenedFromSettings: (val: boolean) => void; // Method to set the openedFromSettings state
  setAvailableVoucher: (voucher: Voucher | null) => void;
  setVoucherLoading: (loading: boolean) => void;
  showClaimedVoucherPopup: (voucher: Voucher, inviterName?: string) => void;
  hideClaimedVoucherPopup: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  devtools((set) => ({
    planType: 'free',
    userType: '',
    subscribeModalVisible: false,
    storageExceededModalVisible: false,
    creditInsufficientModalVisible: false,
    creditInsufficientMembershipLevel: '',
    creditInsufficientTriggeredFrom: '',
    openedFromSettings: false,
    availableVoucher: null,
    voucherLoading: false,
    claimedVoucherPopupVisible: false,
    claimedVoucher: null,
    claimedVoucherInviterName: null,

    setPlanType: (val: SubscriptionPlanType) => set({ planType: val }),
    setUserType: (val: string) => set({ userType: val }),
    setSubscribeModalVisible: (val: boolean) => set({ subscribeModalVisible: val }),
    setStorageExceededModalVisible: (val: boolean) => set({ storageExceededModalVisible: val }),
    setCreditInsufficientModalVisible: (
      val: boolean,
      membershipLevel?: string,
      triggeredFrom?: string,
    ) =>
      set({
        creditInsufficientModalVisible: val,
        creditInsufficientMembershipLevel: membershipLevel || '',
        creditInsufficientTriggeredFrom: triggeredFrom || '',
      }),
    setOpenedFromSettings: (val: boolean) => set({ openedFromSettings: val }),
    setAvailableVoucher: (voucher: Voucher | null) => set({ availableVoucher: voucher }),
    setVoucherLoading: (loading: boolean) => set({ voucherLoading: loading }),
    showClaimedVoucherPopup: (voucher: Voucher, inviterName?: string) =>
      set({
        claimedVoucherPopupVisible: true,
        claimedVoucher: voucher,
        claimedVoucherInviterName: inviterName || null,
      }),
    hideClaimedVoucherPopup: () =>
      set({
        claimedVoucherPopupVisible: false,
        claimedVoucher: null,
        claimedVoucherInviterName: null,
      }),
  })),
);

export const useSubscriptionStoreShallow = <T>(selector: (state: SubscriptionState) => T) => {
  return useSubscriptionStore(useShallow(selector));
};
