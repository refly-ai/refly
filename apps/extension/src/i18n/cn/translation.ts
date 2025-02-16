import cnTranslation from '@refly/i18n/zh-Hans/ui';

export const translation = {
  ...cnTranslation,
  extension: {
    loginPage: {
      title: '登录或注册以继续使用 Refly',
      loginBtn: '立即登录',
      loggingStatus: '登录中...',
      and: '及',
      utilText: '注册即表明您同意 ',
      privacyPolicy: '隐私政策',
      terms: '服务条款',
      status: {
        failed: '登录失败',
        success: '登录成功',
      },
    },
    loggedHomePage: {
      newThreadText: '新会话',
      homePage: {
        title: 'AI 原生创作引擎',
        header: {
          fullscreen: '全屏',
          settings: '设置',
          account: '账户',
          close: '关闭',
        },
        contentSelector: {
          tip: {
            select: '选择网页内容',
            cancelSelect: '取消选择',
          },
        },
        selectedWeblink: {
          title: '基于选中网页提问：',
        },
        selectedContent: {
          title: '选中要操作的内容如下：',
          clear: '清空所有选中',
          exit: '退出',
          empty: '暂无选中内容...',
        },
        weblinkList: {
          title: '知识库',
          selectedCnt: '已选择 {{count}} 项',
          drawer: {
            cancel: '取消',
            confirm: '确认',
          },
          item: {
            read: '已处理',
            unread: '未处理',
          },
        },
        recommendQuickAction: {
          title: '推荐快捷操作：',
          summary: {
            title: '总结',
            tip: {
              title: '总结',
              current: '对当前网页进行快速{{action}}',
              selectedWeblink: '对选中的网页进行{{action}}',
              currentSelectedContent: '基于实时选择内容{{action}}',
            },
            status: {
              contentHandling: '处理内容中...',
              createFailed: '创建新会话失败！',
              contentHandleSuccessNotify: '处理成功，正在跳转到会话页面...',
              contentHandleFailedNotify: '处理失败！',
            },
          },
          save: {
            title: '保存',
            tip: '保存此网页以供后续阅读',
            status: {
              contentHandling: '内容保存中...',
              createFailed: '创建新会话失败！',
              contentHandleSuccessNotify: '保存成功！',
              contentHandleFailedNotify: '处理失败！',
            },
          },
        },
        searchPlaceholder: {
          all: '对全部知识库进行提问...',
          selectedWeblink: '对选中的网页进行提问...',
          current: '对当前网页进行提问...',
          internet: '输入关键词进行网络搜索...',
          currentSelectedContent: '基于实时选择内容提问...',
        },
        status: {
          emptyNotify: '提问内容不能为空',
          contentHandling: '处理内容中...',
          createFailed: '创建新会话失败！',
          contentHandleSuccessNotify: '处理成功，正在跳转到会话页面...',
          contentHandleFailedNotify: '处理失败！',
        },
      },
      siderMenu: {
        homePage: '主页',
        threadLibrary: '会话库',
        getHelp: '获得帮助',
        download: '下载插件',
        newResource: '导入资源',
      },
    },
    floatingSphere: {
      saveResource: '保存到 Refly',
      saveSelectedContent: '保存',
      saveSelectedContentTooltip: '保存选中内容到知识库',
      copySelectedContent: '复制',
      copySelectedContentTooltip: '复制选中内容',
      clipSelectedContent: '剪藏',
      clipSelectedContentTooltip: '剪藏选中内容',
      selectContentToAsk: '选择内容剪藏',
      enableSelectContentToAskNotify: '启用选择内容剪藏',
      disableSelectContentToAskNotify: '禁用选择内容剪藏',
      closeContentSelector: '关闭选择内容',
      toggleCopilot: '唤起 Refly',
      toggleCopilotClose: '悬浮球已关闭，可以刷新页面重新展示',
      toggleCopilotTooltip: '关闭悬浮球，可以刷新页面重新展示',
      copySuccess: '内容已复制到剪切板',
      copyError: '复制内容失败',
    },
    webClipper: {
      placeholder: {
        enterOrClipContent: '输入内容或点击剪藏按钮获取当前页面内容...',
        title: '标题',
        enterTitle: '输入标题或使用当前页面标题',
        url: '网址',
        enterUrl: '输入网址或使用当前页面网址',
        content: '内容',
        metadata: '标题和网址',
      },
      action: {
        clip: '剪藏当前页面',
        clear: '清空',
        save: '保存',
        fromClipboard: '从剪贴板粘贴',
      },
      info: {
        saveToLibrary: '保存到知识库',
      },
      error: {
        clipContentFailed: '剪藏内容失败',
        contentRequired: '内容不能为空',
        saveFailed: '保存内容失败',
        clipboardEmpty: '剪贴板为空',
        clipboardReadFailed: '读取剪贴板失败',
      },
      success: {
        saved: '内容保存成功',
      },
    },
    popup: {
      welcome: '欢迎使用 Refly！',
      pleaseLogin: '请先登录以使用完整功能',
      loginRegister: '登录/注册',
      unsupportedTitle: '感谢使用 Refly！',
      unsupportedDesc: '😵 由于浏览器安全限制，Refly 无法在以下页面工作：',
      unsupportedPages: {
        chromeStore: 'Chrome Web 商店页面',
        chromePages: 'Chrome 页面',
        newTab: '新标签页',
      },
      unsupportedHint: '您可以在另一个页面上尝试 Refly。',
      openSidebar: '打开侧边栏提问',
      refresh: '刷新页面',
      home: '主页',
      docs: '文档',
      examplePage: '例如此页面',
      loading: '加载中...',
      languageSettings: '语言设置',
      settings: {
        title: '设置',
        language: '语言设置',
        description: '更改界面语言',
      },
    },
  },
};
