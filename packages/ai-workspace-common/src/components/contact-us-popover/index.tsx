import React from 'react';
import { Popover, Button } from 'antd';
import { FaDiscord } from 'react-icons/fa6';
import { RiNotionLine, RiTwitterXFill } from 'react-icons/ri';
import Feishu from '../../assets/feishu.svg';

import { useTranslation } from 'react-i18next';
import { Close } from 'refly-icons';
import { ContactCard } from './contact-card';
import './index.scss';

interface ContactUsPopoverProps {
  children: React.ReactNode;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const ContactUsPopover: React.FC<ContactUsPopoverProps> = ({ children, open, setOpen }) => {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language;

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  const handleClick = () => {
    setOpen(!open);
  };

  const handleDiscordClick = () => {
    window.open('https://discord.gg/YVuYFjFvRC', '_blank');
  };

  const handleNotionDocumentClick = () => {
    window.open(
      'https://www.notion.so/reflydoc/Welcome-to-Refly-28cd62ce60718093b830c4b9fc8b22a3',
      '_blank',
    );
  };

  const handleFeishuDocumentClick = () => {
    window.open('https://powerformer.feishu.cn/wiki/A7Paw5CIGip0jvkCU26ce4IunFc', '_blank');
  };

  const handleTwitterClick = () => {
    window.open('https://twitter.com/reflyai', '_blank');
  };

  const content = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-lg font-semibold text-refly-text-0">
          {t('landingPage.footer.contactUs.joinGroup')}
        </div>

        <Button type="text" icon={<Close size={24} />} onClick={() => setOpen(false)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {currentLanguage === 'zh-CN' ? (
          <ContactCard
            icon={<img src={Feishu} alt="Feishu" className="w-16 h-16" />}
            title={t('landingPage.footer.contactUs.feishuDocument')}
            buttonText={t('landingPage.footer.contactUs.viewDocument')}
            onButtonClick={handleFeishuDocumentClick}
          />
        ) : (
          <ContactCard
            icon={<RiNotionLine className="text-refly-text-0 text-[64px]" />}
            title={t('landingPage.footer.contactUs.notionDocument')}
            buttonText={t('landingPage.footer.contactUs.viewDocument')}
            onButtonClick={handleNotionDocumentClick}
          />
        )}
        {/* Discord Group */}
        <ContactCard
          icon={<FaDiscord className="text-refly-text-0 text-[64px]" />}
          title={t('landingPage.footer.contactUs.discordGroup')}
          buttonText={t('landingPage.footer.contactUs.joinDiscordGroup')}
          onButtonClick={handleDiscordClick}
        />

        {/* Twitter Official Account */}
        <ContactCard
          icon={
            <div className="w-16 h-16 bg-refly-text-0 rounded-full flex items-center justify-center">
              <RiTwitterXFill className="text-refly-bg-content-z2 text-[46px]" />
            </div>
          }
          title={t('landingPage.footer.contactUs.followReflyUpdates')}
          buttonText={t('landingPage.footer.contactUs.reflyTwitterAccount')}
          onButtonClick={handleTwitterClick}
        />
        {/* WeChat Group */}
        <div className="w-[156px] h-[176px] flex flex-col items-center text-center p-2 rounded-xl border-solid border-[1px] border-refly-Card-Border">
          <div className="w-[140px] h-[140px] rounded-lg overflow-hidden">
            <img
              src="https://static.refly.ai/landing/wechat-qrcode.webp"
              alt="WeChat Group QR Code"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="text-xs text-refly-text-0 mt-1 font-semibold leading-4">
            {t('landingPage.footer.contactUs.scanToJoinWechatGroup')}
          </div>
        </div>
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
