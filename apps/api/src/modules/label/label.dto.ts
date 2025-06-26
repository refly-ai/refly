import { pick } from '../../utils';
import {
  LabelClass as LabelClassModel,
  LabelInstance as LabelInstanceModel,
} from '../../generated/client';
import { LabelClass, LabelInstance } from '@refly/openapi-schema';

export const labelClassPO2DTO = (lc: LabelClassModel): LabelClass => {
  return {
    ...pick(lc, ['labelClassId', 'name', 'displayName', 'icon', 'prompt']),
    icon: JSON.parse(lc.icon),
    createdAt: lc.createdAt.toJSON(),
    updatedAt: lc.updatedAt.toJSON(),
  };
};

export const labelPO2DTO = (
  label: LabelInstanceModel & { labelClass?: LabelClassModel },
): LabelInstance => {
  return {
    ...pick(label, ['labelId', 'labelClassId', 'value']),
    ...(label.labelClass ? { labelClass: labelClassPO2DTO(label.labelClass) } : {}),
  };
};
