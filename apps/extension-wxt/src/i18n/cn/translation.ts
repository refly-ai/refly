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
        title: '知识，在此繁茂',
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
      selectContentToAsk: '选择内容提问',
      enableSelectContentToAskNotify: '启用选择内容提问',
      disableSelectContentToAskNotify: '禁用选择内容提问',
      closeContentSelector: '关闭选择内容',
      toggleCopilot: '唤起 Refly',
      toggleCopilotClose: '悬浮球已关闭，可以刷新页面重新展示',
      toggleCopilotTooltip: '关闭悬浮球，可以刷新页面重新展示',
    },
  },
};
