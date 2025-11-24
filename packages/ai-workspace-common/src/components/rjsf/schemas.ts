import type { UiSchema } from '@rjsf/utils';
import { RJSFSchema } from '@rjsf/utils';

export const roleOptions = [
  { value: 'creator', label: '✍️ Content Creator / Influencer' },
  { value: 'designer', label: '🎨 Designer (UI/UX, Graphic, Visual, 3D, etc.)' },
  { value: 'growth', label: '📈 Operations / Growth / Marketing' },
  { value: 'engineer', label: '💻 Developer / Engineer / Data Analyst' },
  { value: 'educator', label: '📚 Educator (Teacher, Trainer, Knowledge Creator)' },
  { value: 'business', label: '💼 Business / Sales' },
  { value: 'student', label: '🧑‍🎓 Student / Personal Development' },
  { value: 'other', label: '🪴 Other' },
];

export const useCaseOptions = [
  { value: 'collection', label: '📥 Content collection' },
  { value: 'creation', label: '✍️ Content creation' },
  { value: 'visual', label: '🎨 Visual generation' },
  { value: 'data', label: '📊 Data processing' },
  { value: 'office', label: '🗂️ Office automation' },
  { value: 'ops', label: '🚀 Operations automation' },
  { value: 'developer', label: '🛠️ Developer tasks' },
  {
    value: 'newbie',
    label: '🌱 I have not used automation tools yet (but I am ready to explore)',
  },
  { value: 'other', label: '🪴 Other' },
];

export const interestOptions = [
  { value: 'material', label: '📥 Material collection workflows' },
  { value: 'media', label: '🎬 Image / video content workflows' },
  { value: 'writing', label: '✍️ AI writing / document workflows' },
  { value: 'analytics', label: '📊 Data analysis / reporting workflows' },
  { value: 'social', label: '📣 Social media automation' },
  { value: 'business', label: '💼 Business workflows (reports, emails, summaries)' },
  { value: 'developer', label: '🛠️ Developer workflows (crawlers, APIs, task orchestration)' },
  { value: 'other', label: '🪴 Other' },
];

// RJSF onboarding schema for demo
export const rjsfSchema: RJSFSchema = {
  title: '欢迎来到 Refly',
  description: '为了更好地推荐模板与功能，请告诉我们一些信息：',
  type: 'object',
  required: ['role', 'useCases', 'interests'],
  properties: {
    role: {
      type: 'string',
      title: '🍃 1. Which of the following best describes your role?',
      default: '',
      anyOf: roleOptions.map((option) => ({
        const: option.value,
        title: option.label,
      })),
    },
    useCases: {
      type: 'array',
      title: '🌱 2. What do you mainly use automation tools for?',
      uniqueItems: true,
      minItems: 1,
      default: [],
      items: {
        type: 'string',
        anyOf: useCaseOptions.map((option) => ({
          const: option.value,
          title: option.label,
        })),
      },
    },
    interests: {
      type: 'array',
      title: '🌿 3. What type of automation workflow are you most interested in?',
      uniqueItems: true,
      minItems: 1,
      default: [],
      items: {
        type: 'string',
        anyOf: interestOptions.map((option) => ({
          const: option.value,
          title: option.label,
        })),
      },
    },
  },
};

export const rjsfUiSchema: UiSchema = {
  'ui:options': {
    emoji: '🎉',
    variant: 'card',
    subtitle: '为了更好地推荐模板与功能，请告诉我们一些信息：',
    showSelectionSummary: true,
    selectionSummaryTitle: '选项选中',
    requiredHint: '带 * 的问题为必填项',
    progressSteps: [
      { key: 'role', title: '角色' },
      { key: 'useCases', title: '用途' },
      { key: 'interests', title: '偏好' },
    ],
  },
  role: {
    'ui:widget': 'radio',
  },
  useCases: {
    'ui:widget': 'checkboxes',
  },
  interests: {
    'ui:widget': 'checkboxes',
  },
  otherNotes: {
    'ui:options': {
      variant: 'flat',
    },
    pending: {
      'ui:placeholder': 'Please specify...',
    },
    done: {
      'ui:placeholder': 'UX designer',
    },
  },
};
