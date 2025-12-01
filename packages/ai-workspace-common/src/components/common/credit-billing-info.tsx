import { Tooltip } from 'antd';
import { Subscription } from 'refly-icons';
import { CreditBilling } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';

export const CreditBillingInfo = ({ creditBilling }: { creditBilling: CreditBilling }) => {
  const { t } = useTranslation();
  if (!creditBilling) {
    return null;
  }

  const { unit } = creditBilling;
  const inputCost = Math.round(creditBilling.inputCost);
  const outputCost = Math.round(creditBilling.outputCost);

  return (
    <Tooltip
      placement="right"
      className="flex items-center gap-1 text-xs text-refly-text-2"
      title={t(`subscription.creditBilling.description.${unit}`, {
        inputCost,
        outputCost,
      })}
    >
      <Subscription size={12} className="text-[#1C1F23] dark:text-white" />
      {inputCost} / {outputCost}
    </Tooltip>
  );
};
