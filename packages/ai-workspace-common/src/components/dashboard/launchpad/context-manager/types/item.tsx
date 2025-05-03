import React from 'react';
import { Mark, MarkType } from '@refly/common-types';
import { SortMark } from './mark';

export interface RenderItem {
  domain: string;
  heading: string;
  data: SortMark;
  type: MarkType;
  icon: React.ReactNode;
  action?: boolean;
  actionHeading?: { create: string };
  onItemClick?: (item: Mark) => void;
  onCreateClick?: () => void;
}
