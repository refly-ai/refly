import React from 'react';
import logoIcon from '../../../assets/logo.svg';
import logoText from '../../../assets/refly-text.svg';
import cn from 'classnames';

interface LogoIconProps {
  className?: string;
  show: boolean;
}

interface LogoProps {
  logoProps?: LogoIconProps;
  textProps?: LogoIconProps;
  className?: string;
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({ className = '', onClick, logoProps, textProps }) => {
  const { show: showLogo = true, className: logoClassName } = logoProps || { show: true };
  const { show: showText = true, className: textClassName } = textProps || { show: true };

  return (
    <div className={`flex gap-1.5 items-center cursor-pointer ${className}`} onClick={onClick}>
      {showLogo && (
        <img
          src={logoIcon}
          className={cn(
            'object-contain shrink-0 self-stretch my-auto w-8 aspect-square fill-zinc-900 flex-1',
            logoClassName,
          )}
          alt="Logo icon"
        />
      )}
      {showText && (
        <img
          src={logoText}
          className={cn(
            'object-contain shrink-0 self-stretch w-12 my-auto aspect-[2.23] fill-zinc-900 flex-1',
            textClassName,
          )}
          alt="Logo icon"
        />
      )}
    </div>
  );
};
