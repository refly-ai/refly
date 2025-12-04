import React, { useCallback } from 'react';
import { Popover, Button } from 'antd';
import { FaDiscord } from 'react-icons/fa6';
import { RiNotionLine, RiTwitterXFill, RiArrowRightLine } from 'react-icons/ri';
import Feishu from '../../assets/feishu.svg';

import { useTranslation } from 'react-i18next';
import { Close } from 'refly-icons';
import './index.scss';

interface ContactUsPopoverProps {
  children: React.ReactNode;
  open: boolean;
  setOpen: (open: boolean) => void;
}

interface CommunityLinkCardProps {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
}

const CommunityLinkCard: React.FC<CommunityLinkCardProps> = React.memo(
  ({ icon, title, onClick }) => {
    return (
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl border border-solid border-gray-200 cursor-pointer hover:bg-refly-fill-hover transition-colors"
        onClick={onClick}
      >
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">{icon}</div>
          <span className="text-base font-normal text-refly-text-0">{title}</span>
        </div>
        <RiArrowRightLine className="text-gray-400 text-xl flex-shrink-0" />
      </div>
    );
  },
);

CommunityLinkCard.displayName = 'CommunityLinkCard';

export const ContactUsPopover: React.FC<ContactUsPopoverProps> = ({ children, open, setOpen }) => {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language;
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      setOpen(newOpen);
    },
    [setOpen],
  );

  const handleClick = useCallback(() => {
    setOpen(!open);
  }, [open, setOpen]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const handleDiscordClick = useCallback(() => {
    window.open('https://discord.gg/YVuYFjFvRC', '_blank');
  }, []);

  const handleNotionDocumentClick = useCallback(() => {
    window.open(
      'https://www.notion.so/reflydoc/Welcome-to-Refly-28cd62ce60718093b830c4b9fc8b22a3',
      '_blank',
    );
  }, []);

  const handleFeishuDocumentClick = useCallback(() => {
    window.open('https://powerformer.feishu.cn/wiki/A7Paw5CIGip0jvkCU26ce4IunFc', '_blank');
  }, []);

  const handleTwitterClick = useCallback(() => {
    window.open('https://twitter.com/reflyai', '_blank');
  }, []);

  const content = (
    <div className="w-[360px]">
      <div className="flex items-center justify-between mb-4">
        <div className="text-lg font-semibold text-refly-text-0">
          {t('landingPage.footer.contactUs.joinGroup')}
        </div>
        <Button
          type="text"
          className="flex items-center justify-center p-1 hover:bg-gray-100"
          icon={<Close size={18} />}
          onClick={handleClose}
        />
      </div>
      <div className="flex flex-col gap-3">
        {currentLanguage === 'zh-CN' ? (
          <CommunityLinkCard
            icon={<img src={Feishu} alt="Feishu" className="w-10 h-10" />}
            title={t('landingPage.footer.contactUs.viewDocument')}
            onClick={handleFeishuDocumentClick}
          />
        ) : (
          <CommunityLinkCard
            icon={<RiNotionLine className="text-refly-text-0 text-[40px]" />}
            title={t('landingPage.footer.contactUs.viewDocument')}
            onClick={handleNotionDocumentClick}
          />
        )}
        {/* Discord Community */}
        <CommunityLinkCard
          icon={<FaDiscord className="text-refly-text-0 text-[40px]" />}
          title={t('landingPage.footer.contactUs.joinDiscordGroup')}
          onClick={handleDiscordClick}
        />

        {/* Twitter Official Account */}
        <CommunityLinkCard
          icon={<RiTwitterXFill className="text-refly-text-0 text-[40px]" />}
          title={t('landingPage.footer.contactUs.reflyTwitterAccount')}
          onClick={handleTwitterClick}
        />
      </div>
    </div>
  );

  return (
    <div onClick={handleClick}>
      <Popover
        content={content}
        title={null}
        trigger="click"
        open={open}
        onOpenChange={handleOpenChange}
        placement="bottom"
        overlayClassName="contact-us-popover"
        mouseEnterDelay={0}
        mouseLeaveDelay={0}
        arrow={false}
        align={{
          offset: [16, 8],
        }}
      >
        {children}
      </Popover>
    </div>
  );
};
