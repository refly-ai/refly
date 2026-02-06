import { defineConfig } from 'vitepress';

// Single navigation item
const enNav = [
  { text: 'Refly', link: 'https://refly.ai' },
  { text: 'Community', link: '/community/contact-us' },
  {
    text: 'v1.1.0',
    items: [{ text: 'Changelog', link: '/changelog/v1.1.0' }],
  },
];

const zhNav = [
  { text: 'Refly', link: 'https://refly.ai' },
  { text: '社区', link: '/zh/community/contact-us' },
  {
    text: 'v1.1.0',
    items: [{ text: '更新日志', link: '/zh/changelog/v1.1.0' }],
  },
];

// Sidebar translations
const sidebar = {
  en: [
    {
      text: 'Getting Started',
      items: [
        { text: 'Welcome to Refly', link: '/' }, // Points to index.md
      ],
    },
    {
      text: 'Developer',
      items: [
        { text: 'API Documentation', link: '/guide/api/openapi' },
        { text: 'Webhook Documentation', link: '/guide/api/webhook' },
      ],
    },
    {
      text: 'Community Version',
      items: [
        {
          text: 'Self Deploy',
          link: '/community-version/self-deploy/',
        },
        {
          text: 'FAQ: Accessing via IP address',
          link: '/community-version/self-deploy/faq-ip-access',
        },
      ],
    },
    {
      text: 'Community',
      items: [
        { text: 'Contact Us', link: '/community/contact-us' },
      ],
    },
    {
      text: 'About',
      items: [
        { text: 'Privacy Policy', link: '/about/privacy-policy' },
        { text: 'Terms of Service', link: '/about/terms-of-service' },
      ],
    },
    {
      text: 'Changelog',
      items: [
        { text: 'v1.1.0', link: '/changelog/v1.1.0' },
        { text: 'v0.10.0', link: '/changelog/v0.10.0' },
        { text: 'v0.9.0', link: '/changelog/v0.9.0' },
        { text: 'v0.8.0', link: '/changelog/v0.8.0' },
        { text: 'v0.7.1', link: '/changelog/v0.7.1' },
        { text: 'v0.7.0', link: '/changelog/v0.7.0' },
        { text: 'v0.6.0', link: '/changelog/v0.6.0' },
        { text: 'v0.5.0', link: '/changelog/v0.5.0' },
        { text: 'v0.4.2', link: '/changelog/v0.4.2' },
        { text: 'v0.4.1', link: '/changelog/v0.4.1' },
        { text: 'v0.4.0', link: '/changelog/v0.4.0' },
        { text: 'v0.3.0', link: '/changelog/v0.3.0' },
        { text: 'v0.2.4', link: '/changelog/v0.2.4' },
        { text: 'v0.2.3', link: '/changelog/v0.2.3' },
        { text: 'v0.2.2', link: '/changelog/v0.2.2' },
        { text: 'v0.2.1', link: '/changelog/v0.2.1' },
        { text: 'v0.2.0', link: '/changelog/v0.2.0' },
        { text: 'v0.1.2', link: '/changelog/v0.1.2' },
        { text: 'v0.1.1', link: '/changelog/v0.1.1' },
      ],
    },
  ],
  zh: [
    {
      text: '入门',
      items: [
        { text: '欢迎使用 Refly', link: '/zh/' },
      ],
    },
    {
      text: '开发者',
      items: [
        { text: 'API 文档', link: '/zh/guide/api/openapi' },
        { text: 'Webhook 文档', link: '/zh/guide/api/webhook' },
      ],
    },
    {
      text: '社区版本',
      items: [
        {
          text: '私有部署',
          link: '/zh/community-version/self-deploy/',
        },
        {
          text: 'FAQ：通过 IP 地址访问',
          link: '/zh/community-version/self-deploy/faq-ip-access',
        },
      ],
    },
    {
      text: '社区',
      items: [
        { text: '联系我们', link: '/zh/community/contact-us' },
      ],
    },
    {
      text: '关于',
      items: [
        { text: '隐私政策', link: '/zh/about/privacy-policy' },
        { text: '服务条款', link: '/zh/about/terms-of-service' },
      ],
    },
    {
      text: '更新日志',
      items: [
        { text: 'v1.1.0', link: '/zh/changelog/v1.1.0' },
        { text: 'v0.10.0', link: '/zh/changelog/v0.10.0' },
        { text: 'v0.9.0', link: '/zh/changelog/v0.9.0' },
        { text: 'v0.8.0', link: '/zh/changelog/v0.8.0' },
        { text: 'v0.7.1', link: '/zh/changelog/v0.7.1' },
        { text: 'v0.7.0', link: '/zh/changelog/v0.7.0' },
        { text: 'v0.6.0', link: '/zh/changelog/v0.6.0' },
        { text: 'v0.5.0', link: '/zh/changelog/v0.5.0' },
        { text: 'v0.4.2', link: '/zh/changelog/v0.4.2' },
        { text: 'v0.4.1', link: '/zh/changelog/v0.4.1' },
        { text: 'v0.4.0', link: '/zh/changelog/v0.4.0' },
        { text: 'v0.3.0', link: '/zh/changelog/v0.3.0' },
        { text: 'v0.2.4', link: '/zh/changelog/v0.2.4' },
        { text: 'v0.2.3', link: '/zh/changelog/v0.2.3' },
        { text: 'v0.2.2', link: '/zh/changelog/v0.2.2' },
        { text: 'v0.2.1', link: '/zh/changelog/v0.2.1' },
        { text: 'v0.2.0', link: '/zh/changelog/v0.2.0' },
        { text: 'v0.1.2', link: '/zh/changelog/v0.1.2' },
        { text: 'v0.1.1', link: '/zh/changelog/v0.1.1' },
      ],
    },
  ],
};

export default defineConfig({
  // Site metadata
  title: 'Refly Docs',
  description: 'Refly Documentation',

  // Remove .html extensions from URLs
  cleanUrls: true,

  // Ignore dead links in README.md and other files
  ignoreDeadLinks: true,

  // Configure head
  head: [
    ['link', { rel: 'icon', href: '/logo/logo.svg' }],
    [
      'script',
      {
        async: '',
        src: 'https://www.googletagmanager.com/gtag/js?id=G-RS0SJYDFJF',
      },
    ],
    [
      'script',
      {},
      `window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-RS0SJYDFJF');`,
    ],
  ],

  // File path rewrites to map /en/* files to root URLs
  rewrites: {
    'en/index.md': 'index.md',
    'en/:path*': ':path*',
  },

  // i18n configuration
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      title: 'Refly Docs',
      description: 'Refly Documentation',
      themeConfig: {
        nav: enNav,
        sidebar: sidebar.en,
        siteTitle: 'Refly Docs',
        outline: [2, 4],
        outlineTitle: 'On this page',
        docFooter: {
          prev: 'Previous page',
          next: 'Next page',
        },
        returnToTopLabel: 'Return to top',
        sidebarMenuLabel: 'Menu',
        darkModeSwitchLabel: 'Theme',
        search: {
          provider: 'local',
          options: {
            translations: {
              button: {
                buttonText: 'Search',
                buttonAriaLabel: 'Search',
              },
              modal: {
                noResultsText: 'No results for',
                resetButtonTitle: 'Reset search',
                footer: {
                  selectText: 'to select',
                  navigateText: 'to navigate',
                  closeText: 'to close',
                },
              },
            },
          },
        },
      },
    },
    zh: {
      label: '简体中文',
      lang: 'zh',
      title: 'Refly 文档',
      description: 'Refly 开发文档',
      themeConfig: {
        nav: zhNav,
        sidebar: sidebar.zh,
        siteTitle: 'Refly 文档',
        outline: [2, 4],
        outlineTitle: '本页目录',
        docFooter: {
          prev: '上一页',
          next: '下一页',
        },
        returnToTopLabel: '返回顶部',
        sidebarMenuLabel: '菜单',
        darkModeSwitchLabel: '主题',
        search: {
          provider: 'local',
          options: {
            translations: {
              button: {
                buttonText: '搜索',
                buttonAriaLabel: '搜索',
              },
              modal: {
                noResultsText: '未找到相关结果',
                resetButtonTitle: '清除搜索',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭',
                },
              },
            },
          },
        },
      },
    },
  },

  themeConfig: {
    // Logo configuration
    logo: {
      light: '/logo/logo.svg',
      dark: '/logo/logo.svg',
    },

    // Social links
    socialLinks: [{ icon: 'github', link: 'https://github.com/refly-ai/refly' }],

    // Language selection
    langMenuLabel: 'Change Language',

    // Enable search
    search: {
      provider: 'local',
    },
    outline: [2, 4], // 添加此行
  },
});
