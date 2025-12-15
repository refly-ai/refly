import { useState, useEffect } from 'react';
import { Select, Tag, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { Voucher } from '@refly/openapi-schema';
import { getAvailableVouchers } from '../../requests/services.gen';
import { GiftOutlined } from '@ant-design/icons';

interface VoucherSelectProps {
  value?: string;
  onChange?: (voucherId: string | undefined, voucher: Voucher | undefined) => void;
  disabled?: boolean;
}

export const VoucherSelect = ({ value, onChange, disabled }: VoucherSelectProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);

  useEffect(() => {
    loadVouchers();
  }, []);

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const response = await getAvailableVouchers();
      if (response.data?.data?.vouchers) {
        setVouchers(response.data.data.vouchers);
      }
    } catch (error) {
      console.error('Failed to load vouchers:', error);
    }
    setLoading(false);
  };

  const handleChange = (voucherId: string | undefined) => {
    const selectedVoucher = voucherId ? vouchers.find((v) => v.voucherId === voucherId) : undefined;
    onChange?.(voucherId, selectedVoucher);
  };

  const formatExpireDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Spin size="small" />
        <span>{t('voucher.select.loading', '加载中...')}</span>
      </div>
    );
  }

  if (vouchers.length === 0) {
    return (
      <div className="text-gray-400 text-sm">
        {t('voucher.select.noVouchers', '暂无可用折扣券')}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2">
        <GiftOutlined className="text-green-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('voucher.select.label', '选择折扣券')}
        </span>
      </div>
      <Select
        value={value}
        onChange={handleChange}
        disabled={disabled}
        allowClear
        placeholder={t('voucher.select.placeholder', '选择折扣券（可选）')}
        className="w-full"
        options={vouchers.map((voucher) => ({
          value: voucher.voucherId,
          label: (
            <div className="flex items-center justify-between">
              <span className="font-medium text-green-600">{voucher.discountPercent}% OFF</span>
              <span className="text-xs text-gray-400">
                {t('voucher.select.expireAt', '有效期至')} {formatExpireDate(voucher.expiresAt)}
              </span>
            </div>
          ),
        }))}
      />
      {value && (
        <div className="mt-2">
          <Tag color="green">
            {t('voucher.select.selected', '已选择')}:{' '}
            {vouchers.find((v) => v.voucherId === value)?.discountPercent}% OFF
          </Tag>
        </div>
      )}
    </div>
  );
};

export default VoucherSelect;
