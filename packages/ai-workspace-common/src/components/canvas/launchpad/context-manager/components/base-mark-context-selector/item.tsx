import { Command } from 'cmdk';

export function Item({
  children,
  shortcut,
  value,
  keywords,
  className,
  activeValue,
  onSelect = () => {},
}: {
  children: React.ReactNode;
  shortcut?: string;
  hoverShortcut?: string;
  value?: string;
  keywords?: string[];
  activeValue?: string;
  className?: string;
  onSelect?: (value: string) => void;
}) {
  const isActive = activeValue === value;
  const hoverShortcut = '↵';

  return (
    <Command.Item className={className} onSelect={onSelect} value={value} keywords={keywords}>
      {children}
      {isActive ? (
        <div cmdk-vercel-shortcuts="">
          <kbd>{hoverShortcut}</kbd>
        </div>
      ) : (
        shortcut && (
          <div cmdk-vercel-shortcuts="">
            {shortcut.split(' ').map((key) => {
              return <kbd key={key}>{key}</kbd>;
            })}
          </div>
        )
      )}
    </Command.Item>
  );
}
