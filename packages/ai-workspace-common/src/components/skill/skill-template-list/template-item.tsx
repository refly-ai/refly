import { useState } from 'react';
import { Avatar, Button, Typography, Message as message, Tooltip } from '@arco-design/web-react';
import { NewSkillInstanceModal } from '@refly-packages/ai-workspace-common/components/skill/new-instance-modal';

import { IconPlus } from '@arco-design/web-react/icon';

// 样式
import './index.scss';
import { SkillTemplate } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { SkillInstanceListSource } from '@refly-packages/ai-workspace-common/components/skill/skill-intance-list';

interface TemplateItemProps {
  data: SkillTemplate;
  source: SkillInstanceListSource;
  itemKey: number;
}

export const TemplateItem = (props: TemplateItemProps) => {
  const { data, source, itemKey } = props;
  const { t } = useTranslation();

  const [visible, setVisible] = useState(false);

  return (
    <div>
      <div className="template-item">
        <div className="template-item__header">
          <div className="template-item__profile">
            <Avatar size={40} shape="square" style={{ backgroundColor: '#00d0b6', borderRadius: 8 }}>
              {data?.displayName}
            </Avatar>
          </div>
          <div className="template-item__title">
            <div className="template-item__title-name">{data?.displayName}</div>
          </div>
        </div>

        <div className="template-item__desc">
          <Typography.Paragraph ellipsis={{ rows: 3 }} style={{ lineHeight: 1.51 }}>
            {data?.description}
          </Typography.Paragraph>
        </div>

        <div className="template-item__action">
          <Button
            className="template-item__action-btn skill-installer-install"
            type="outline"
            onClick={(e) => {
              e.stopPropagation();
              setVisible(true);
            }}
          >
            <IconPlus />
            {t('skill.createFromTemplate')}
          </Button>
        </div>
      </div>
      <NewSkillInstanceModal type="new" template={data} visible={visible} setVisible={(val) => setVisible(val)} />
    </div>
  );
};
