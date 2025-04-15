import { ARTIFACT_THINKING_TAG } from '@refly/utils/artifact';

import Component from './render';
import rehypePlugin from './rehypePlugin';

const ReflyThinkingElement = {
  Component,
  rehypePlugin,
  tag: ARTIFACT_THINKING_TAG,
};

export default ReflyThinkingElement;
