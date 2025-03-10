import { FC, memo } from 'react';
import { ColorPicker as AntdColorPicker } from 'antd';
import { Color } from 'antd/es/color-picker';
import { useTranslation } from 'react-i18next';

// 预设颜色
export const presetColors = [
  '#FFFFFF', // White
  '#e2defc', // Purple
  '#d6ebfd', // Blue
  '#cff9fe', // Cyan
  '#d1f9e8', // Light Green
  '#e3fbcc', // Green
  '#fffee7', // Yellow
  '#fee1c7', // Orange
  '#ffede7', // Pink
  '#f2f4f7', // Gray
];

interface CommonColorPickerProps {
  color: string;
  onChange?: (color: string) => void;
  className?: string;
}

const CommonColorPicker: FC<CommonColorPickerProps> = ({ color, onChange, className = '' }) => {
  const { t } = useTranslation();

  const handleColorChange = (_color: Color, css: string) => {
    console.log('css', css);
    onChange?.(css);
  };

  return (
    <AntdColorPicker
      className={`memo-color-picker items-center border-none rounded-none hover:bg-gray-100 ${className}`}
      defaultValue={color}
      onChange={handleColorChange}
      showText={false}
      presets={[{ label: t('common.presetColors'), colors: presetColors }]}
    />
  );
};

export default memo(CommonColorPicker);
