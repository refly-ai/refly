import {
  useState,
  useEffect,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
  type ReactElement,
  useImperativeHandle,
  type RefObject,
  createRef,
} from 'react';
import { useLocation, useUpdateEffect } from 'react-use';

import { Button, Drawer, Modal, type ButtonProps } from 'antd';
import classNames from 'clsx';

import { mountExtNode, replaceExtNode, unmountExtNode } from '../components/ExtNodePortal';
import { useTranslation } from 'react-i18next';
import { ReflyConfigProvider } from '../components/ConfigProvider';

const WIDTH_MAP = {
  drawer: {
    large: 1080,
    default: 840,
    small: 600,
    cover: 32,
  },
  modal: {
    large: 1080,
    default: 840,
    small: 600,
    cover: 32,
  },
} as const;

export interface ModalActionConfig extends Omit<ButtonProps, 'onClick'> {
  onClick?: () => boolean | undefined | Promise<boolean | undefined>;
}

export interface ModalSlotProps<T = unknown> {
  setCancelAction: Dispatch<SetStateAction<ModalActionConfig>>;
  setConfirmAction: Dispatch<SetStateAction<ModalActionConfig>>;
  close: () => void;
  confirm: () => Promise<void>;
  cancel: () => Promise<void>;
  context: T;
  setContext: Dispatch<SetStateAction<T>>;
}

export type ModalSlot<T> = ReactNode | ((props: ModalSlotProps<T>) => JSX.Element | null);

const renderSlot = <T,>(Slot: ModalSlot<T>, slotProps: ModalSlotProps<T>) => {
  if (typeof Slot === 'function') {
    return <Slot {...slotProps} />;
  }
  return Slot;
};

export interface OpenModalOptionsBase<T> {
  Title?: ModalSlot<T>;
  Content?: ModalSlot<T>;
  Footer?: ModalSlot<T>;
  size?: 'default' | 'small' | 'large' | 'full' | 'cover';
  mode?: 'modal' | 'drawer';
  afterClose?: () => void;
  afterOpenChange?: (open: boolean) => void;
  noMask?: boolean;
  maskClosable?: boolean;
  containerClassName?: string;
}

export type OpenModalOptions<T = unknown> = unknown extends T
  ? OpenModalOptionsBase<T> & { initialContext?: undefined }
  : OpenModalOptionsBase<T> & { initialContext: T };

export interface PortalModelRef {
  close: () => void;
}

function PortalModal<T>({
  Title,
  Content,
  Footer,
  size = 'small',
  mode = 'drawer',
  afterClose,
  afterOpenChange,
  initialContext,
  noMask,
  maskClosable,
  handleRef,
  containerClassName,
}: OpenModalOptionsBase<T> & { initialContext: T; handleRef: RefObject<PortalModelRef> }) {
  const { t } = useTranslation();
  const [context, setContext] = useState(initialContext);

  const [confirmAction, setConfirmAction] = useState<ModalActionConfig>({
    children: t('confirm', 'Confirm'),
    type: 'primary',
  });
  const [cancelAction, setCancelAction] = useState<ModalActionConfig>({
    children: t('cancel', 'Cancel'),
  });

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  const handleClose = () => setVisible(false);

  const handleCancel = async () => {
    const res = await cancelAction.onClick?.();
    if (res !== false) {
      handleClose();
    }
  };

  const handleConfirm = async () => {
    const res = await confirmAction.onClick?.();
    if (res !== false) {
      handleClose();
    }
  };

  useImperativeHandle(handleRef, () => {
    return {
      close: handleClose,
    };
  });

  // Close modal when route changes
  const location = useLocation();
  useUpdateEffect(() => {
    setVisible(false);
  }, [location.pathname]);

  const slotProps: ModalSlotProps<T> = {
    close: handleClose,
    cancel: handleCancel,
    confirm: handleConfirm,
    setCancelAction,
    setConfirmAction,
    context,
    setContext,
  };
  if (size === 'full') {
    return (
      <Modal
        styles={{
          body: {
            padding: 0,
          },
        }}
        footer={null}
        width={'100%'}
        open={visible}
        closable={false}
        destroyOnClose
        afterClose={afterClose}
        afterOpenChange={(v) => {
          if (!v) {
            afterOpenChange?.(v);
          }
        }}
        onCancel={async () => {
          await handleCancel();
        }}
        mask
        maskClosable={false}
      >
        <div className="relative h-full w-full">
          <div className="fixed top-0 z-10 flex h-14 w-full items-center gap-2 border-b border-solid border-line-divider-default bg-bg-body px-5 py-4">
            {renderSlot(Title, slotProps)}
          </div>
          {renderSlot(Content, slotProps)}
          <div className="fixed bottom-0 z-10 flex h-16 w-full border-t border-solid border-line-divider-default bg-bg-body px-[248] py-4 shadow-s2-up">
            {renderSlot(Footer, slotProps)}
          </div>
        </div>
      </Modal>
    );
  }

  const Container = mode === 'drawer' ? Drawer : Modal;

  let width: number = WIDTH_MAP[mode][size];
  // The cover size is the window width minus the preset value
  width = size === 'cover' ? window.innerWidth - WIDTH_MAP[mode].cover : width;

  return (
    <ReflyConfigProvider>
      <Container
        width={width}
        className={classNames(containerClassName)}
        autoFocus={false}
        open={visible}
        destroyOnClose
        title={renderSlot<T>(Title, slotProps)}
        afterClose={afterClose}
        placement="right"
        afterOpenChange={(v) => {
          if (!v) {
            afterOpenChange?.(v);
          }
        }}
        onCancel={async () => {
          await handleCancel();
        }}
        onClose={async () => {
          await handleCancel();
        }}
        closable
        mask={!noMask}
        maskClosable={typeof maskClosable === 'boolean' ? maskClosable : !noMask}
        footer={
          Footer ? (
            renderSlot(Footer, slotProps)
          ) : (
            <div className="flex gap-2 justify-end">
              <Button {...cancelAction} onClick={handleCancel} />
              <Button {...confirmAction} onClick={handleConfirm} />
            </div>
          )
        }
      >
        {renderSlot(Content, slotProps)}
      </Container>
    </ReflyConfigProvider>
  );
}

const modalsMap = new WeakMap<symbol, [ReactElement, RefObject<PortalModelRef>]>();

export function openModal<T = unknown>(
  props: OpenModalOptions<T> & {
    symbol?: symbol;
  },
): void {
  const { afterClose, afterOpenChange, initialContext, symbol = Symbol(), ...rest } = props;
  const prevNode = modalsMap.get(symbol);
  const handleRef = createRef<PortalModelRef>();

  const node = (
    <PortalModal
      handleRef={handleRef}
      key={prevNode?.[0].key ?? Date.now()}
      {...rest}
      initialContext={initialContext as T}
      afterClose={afterClose}
      afterOpenChange={(open) => {
        afterOpenChange?.(open);
        const cachedNode = modalsMap.get(symbol);
        if (cachedNode) {
          unmountExtNode(cachedNode[0]);
        }
        modalsMap.delete(symbol);
      }}
    />
  );
  modalsMap.set(symbol, [node, handleRef]);

  if (prevNode) {
    replaceExtNode(prevNode[0], node);
  } else {
    mountExtNode(node);
  }
}

export function closeModal(symbol: symbol): void {
  modalsMap.get(symbol)?.[1].current?.close();
}
