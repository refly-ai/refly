import {
  type ComponentType,
  type Context,
  createContext,
  type Dispatch,
  type ReactElement,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ErrorBoundary } from '@sentry/react';

export type LayoutSlotId = string;

export interface LayoutContainerSlotProps<T> {
  context: T;
  onContextChange: Dispatch<SetStateAction<T>>;
}

export interface LayoutContainerRenderLayoutProps<T> extends LayoutContainerSlotProps<T> {
  renderSlot: (slotId: LayoutSlotId) => ReactNode;
}

export type LayoutContainerSlotType<T> = ComponentType<LayoutContainerSlotProps<T>> | ReactNode;

export interface LayoutContainerProps<T> {
  slots: Record<LayoutSlotId, LayoutContainerSlotType<T>>;
  initialContextValue: T;
  RenderLayout: ComponentType<LayoutContainerRenderLayoutProps<T>>;
}

const LayoutSlotPropsContextMap = new WeakMap<
  ComponentType<LayoutContainerRenderLayoutProps<any>>,
  Context<LayoutContainerSlotProps<any> | null>
>();

function getLayoutSlotPropsContext<T>(
  RenderLayout: ComponentType<LayoutContainerRenderLayoutProps<T>>,
) {
  let Context = LayoutSlotPropsContextMap.get(RenderLayout);
  if (!Context) {
    Context = createContext<LayoutContainerSlotProps<T> | null>(null);
    LayoutSlotPropsContextMap.set(RenderLayout, Context);
  }
  return Context;
}

export function LayoutContainer<T>({
  slots,
  initialContextValue,
  RenderLayout,
}: LayoutContainerProps<T>): ReactElement {
  const LayoutSlotPropsContext = getLayoutSlotPropsContext(RenderLayout);

  const [contextValue, setContextValue] = useState(initialContextValue);

  const slotProps: LayoutContainerSlotProps<T> = useMemo(() => {
    return {
      context: contextValue,
      onContextChange: setContextValue,
    };
  }, [contextValue]);

  const renderSlot = (slotId: LayoutSlotId) => {
    const slot = slots[slotId];
    if (typeof slot !== 'function') {
      return slot;
    }
    const Component = slot as ComponentType<LayoutContainerSlotProps<T>>;
    return <Component {...slotProps} />;
  };

  return (
    <ErrorBoundary>
      <LayoutSlotPropsContext.Provider value={slotProps}>
        <RenderLayout {...slotProps} renderSlot={renderSlot} />
      </LayoutSlotPropsContext.Provider>
    </ErrorBoundary>
  );
}

function useLayoutContainerSlotProps<T>(
  RenderLayout: ComponentType<LayoutContainerRenderLayoutProps<T>>,
): LayoutContainerSlotProps<T> | null {
  const LayoutSlotPropsContext = getLayoutSlotPropsContext(RenderLayout);
  return useContext(LayoutSlotPropsContext);
}

export interface LayoutContainerContextUpdaterProps<T> {
  RenderLayout: ComponentType<LayoutContainerRenderLayoutProps<T>>;
  deps?: unknown[];
}

export function LayoutContainerContextUpdater<T>({
  RenderLayout,
  deps = [],
  ...context
}: LayoutContainerContextUpdaterProps<T> & Partial<T>): ReactElement {
  const onContextChange = useLayoutContainerSlotProps(RenderLayout)?.onContextChange;
  const onContextChangeRef = useRef(onContextChange);
  const contextRef = useRef(context);

  useEffect(() => {
    onContextChangeRef.current?.((prev: T) => ({
      ...prev,
      ...contextRef.current,
    }));
  }, [JSON.stringify(deps)]);
  return <></>;
}
