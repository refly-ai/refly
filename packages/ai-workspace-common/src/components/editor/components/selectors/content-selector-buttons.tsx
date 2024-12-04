import { Button, Tooltip } from 'antd';
import { BsChatLeftQuote } from 'react-icons/bs';
import { useTranslation } from 'react-i18next';
import { MessageSquareDiff } from 'lucide-react';

interface ContentSelectorButtonsProps {
  text: string;
  handleClick: () => void;
}

export const ContentSelectorButtons: React.FC<ContentSelectorButtonsProps> = (props) => {
  const { handleClick } = props;
  const { t } = useTranslation();

  return (
    <Tooltip title={t('knowledgeBase.canvas.editor.toolbar.quote')}>
      <Button ghost type="text" className="rounded-none px-2 " onClick={handleClick}>
        <MessageSquareDiff className="w-[3.5] h-[3.5] text-[#00968F]" size={16} />
      </Button>
    </Tooltip>
  );
};
