import { Tooltip } from 'antd';
import { Subscription } from 'refly-icons';
import { CreditBilling } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';

export const CreditBillingInfo = ({ creditBilling }: { creditBilling: CreditBilling }) => {
  const { t } = useTranslation();
  if (!creditBilling) {
    return null;
  }

  const { unit, unitCost } = creditBilling;

  return (
    <Tooltip
      placement="right"
      className="flex items-center gap-0.5 text-xs text-refly-text-2"
      title={t(`subscription.creditBilling.description.${unit}`, {
        cost: unitCost,
      })}
    >
      <Subscription size={12} className="text-[#1C1F23] dark:text-white" />
      {unitCost}
    </Tooltip>
  );
};
