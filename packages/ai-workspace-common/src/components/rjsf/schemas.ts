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
  { value: 'other', label: '🌿 Other' },
];

export const useCaseOptions = [
  { value: 'collection', label: '📥 Content collection' },
  { value: 'image', label: '🎨 Image Generation' },
  { value: 'video', label: '🎬 Video Generation' },
  { value: 'information', label: '📥 Information Collection' },
  { value: 'data', label: '📊 Data processing' },
  { value: 'office', label: '🗂️ Office automation' },
  { value: 'ops', label: '⚙️ Operations automation' },
  { value: 'developer', label: '🧑‍💻 Web/App Development' },
  {
    value: 'newbie',
    label: "🌱  I'm New to Automation",
  },
  { value: 'other', label: '✨ Other' },
];

export const interestOptions = [
  { value: 'productHunt', label: '🚀 Product Hunt' },
  { value: 'twitter', label: '🐦 X / Twitter' },
  { value: 'instagram', label: '📸 Instagram' },
  { value: 'youtube', label: '▶️ YouTube' },
  { value: 'reddit', label: '🔥 Reddit' },
  { value: 'discord', label: '💬 Discord community)' },
  { value: 'github', label: '🧑‍💻 GitHub' },
  { value: 'search', label: '🔍 Search engine (Google / Bing, etc.)' },
  { value: 'referral', label: '👥 Friend or colleague referral' },
  { value: 'podcast', label: '🎧 Podcast' },
  { value: 'other', label: '📝 Other' },
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
      title: '✨ Where did you first hear about Refly?',
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
