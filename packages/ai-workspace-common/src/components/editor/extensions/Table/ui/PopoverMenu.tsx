import * as Popover from '@radix-ui/react-popover';
import { cn } from '../../../../../utils/cn';
import { icons } from 'lucide-react';
import { forwardRef } from 'react';
import { Surface } from './Surface';
import { Toolbar } from './Toolbar';
import { Button } from 'antd';

export const Trigger = Popover.Trigger;
export const Portal = Popover.Portal;

export type MenuProps = {
  children: React.ReactNode;
  trigger: React.ReactNode;
  triggerClassName?: string;
  customTrigger?: boolean;
  isOpen?: boolean;
  onOpenChange?: (state: boolean) => void;
  withPortal?: boolean;
  tooltip?: string;
  isActive?: boolean;
};

export const Menu = ({
  customTrigger,
  trigger,
  triggerClassName,
  children,
  isOpen,
  withPortal,
  tooltip,
  onOpenChange,
}: MenuProps) => {
  return (
    <Popover.Root onOpenChange={onOpenChange}>
      {customTrigger ? (
        <Trigger asChild>{trigger}</Trigger>
      ) : (
        <Trigger asChild>
          <Toolbar.Button className={triggerClassName} tooltip={!isOpen ? tooltip : ''}>
            {trigger}
          </Toolbar.Button>
        </Trigger>
      )}
      {withPortal ? (
        // @ts-ignore
        <Popover.Portal className="z-9999">
          <Popover.Content asChild sideOffset={8}>
            <Surface className="min-w-[15rem] p-2 flex flex-col gap-0.5 max-h-80 overflow-auto z-[9999]">
              {children}
            </Surface>
          </Popover.Content>
        </Popover.Portal>
      ) : (
        <Popover.Content asChild sideOffset={8}>
          <Surface className="min-w-[15rem] p-2 flex flex-col gap-0.5 max-h-80 overflow-auto z-[9999]">
            {children}
          </Surface>
        </Popover.Content>
      )}
    </Popover.Root>
  );
};

Menu.displayName = 'Menu';

export const Item = ({
  label,
  icon,
  iconComponent,
  onClick,
  disabled,
  className,
}: {
  label: string | React.ReactNode;
  icon?: keyof typeof icons;
  iconComponent?: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) => {
  const buttonClassName = cn('text-xs !justify-start', className);

  const IconComponent = icon ? icons[icon] : null;
  const IconCustomComponent = iconComponent || null;

  return (
    <Button className={buttonClassName} type="text" onClick={onClick} disabled={disabled}>
      {IconComponent && <IconComponent className="w-4 h-4" />}
      {IconCustomComponent}
      {label}
    </Button>
  );
};

export type CategoryTitle = {
  children: React.ReactNode;
};

export const CategoryTitle = ({ children }: CategoryTitle) => {
  return (
    <div className="mt-4 first:mt-1.5 mb-1.5 text-[0.625rem] font-medium text-neutral-400 uppercase select-none px-1">
      {children}
    </div>
  );
};

export const Divider = forwardRef<HTMLHRElement>((props, ref) => {
  return <hr {...props} ref={ref} className="my-1 border-neutral-200" />;
});

Divider.displayName = 'Divider';
