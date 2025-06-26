import enTranslation from '@refly/i18n/en-US/ui';

export const translation = {
  ...enTranslation,
  extension: {
    loginPage: {
      title: 'Sign In or Register to start using Refly',
      loginBtn: 'Sign In',
      loggingStatus: 'Signing in...',
      and: 'and',
      utilText: 'By registering, you agree to our',
      privacyPolicy: 'Privacy Policy',
      terms: 'Terms of Service',
      status: {
        failed: 'Login failed',
        success: 'Login successful',
      },
    },
    loggedHomePage: {
      newThreadText: 'New Thread',
      homePage: {
        title: 'The Open Source Vibe Workflow Platform',
        header: {
          fullscreen: 'Fullscreen',
          settings: 'Settings',
          account: 'Account',
          close: 'Close',
        },
        contentSelector: {
          tip: {
            select: 'Select web page content',
            cancelSelect: 'Cancel selection',
          },
        },
        selectedWeblink: {
          title: 'Ask a Question Based on the Selected Web Page:',
        },
        selectedContent: {
          title: 'The content you have selected for action is as follows:',
          clear: 'Clear All Selections',
          exit: 'Exit',
          empty: 'No content is currently selected...',
        },
        weblinkList: {
          title: 'Knowledge Base',
          selectedCnt: 'Selected {{count}} items',
          drawer: {
            cancel: 'Cancel',
            confirm: 'Confirm',
          },
          item: {
            read: 'Read',
            unread: 'Unread',
          },
        },
        recommendQuickAction: {
          title: 'Recommended Quick Actions:',
          summary: {
            title: 'Summary',
            tip: {
              title: 'summary',
              current: 'Quickly {{action}} the current web page',
              selectedWeblink: 'Perform {{action}} on the selected web page',
              currentSelectedContent: 'Perform {{action}} based on the currently selected content',
            },
            status: {
              contentHandling: 'Processing content...',
              createFailed: 'Failed to create a new session!',
              contentHandleSuccessNotify:
                'Processing successful, redirecting to the session page...',
              contentHandleFailedNotify: 'Processing failed!',
            },
          },
          save: {
            title: 'Save',
            tip: 'Save this web page for future reading',
            status: {
              contentHandling: 'Saving content...',
              createFailed: 'Failed to create a new session!',
              contentHandleSuccessNotify: 'Content saved successfully!',
              contentHandleFailedNotify: 'Content processing failed!',
            },
          },
        },
        searchPlaceholder: {
          all: 'Ask a question about the entire knowledge base...',
          selectedWeblink: 'Ask a question about the selected web page...',
          current: 'Ask a question about the current web page...',
          internet: 'Enter keywords for an internet search...',
          currentSelectedContent: 'Ask a question based on the currently selected content...',
        },
        status: {
          emptyNotify: 'The question field cannot be empty.',
          contentHandling: 'Processing content...',
          createFailed: 'Failed to create a new session!',
          contentHandleSuccessNotify: 'Processing successful, redirecting to the session page...',
          contentHandleFailedNotify: 'Processing failed!',
        },
      },
      siderMenu: {
        homePage: 'Home',
        threadLibrary: 'Threads',
        getHelp: 'Get Help',
        download: 'Download Extension',
        newResource: 'New Resource',
      },
    },
    floatingSphere: {
      saveResource: 'Save to Refly',
      saveSelectedContent: 'Save',
      saveSelectedContentTooltip: 'Save selected content to knowledge base',
      copySelectedContent: 'Copy',
      copySelectedContentTooltip: 'Copy selected content',
      clipSelectedContent: 'Clip',
      clipSelectedContentTooltip: 'Clip selected content',
      selectContentToAsk: 'Select content to clip',
      enableSelectContentToAskNotify: 'Enable select content to clip',
      disableSelectContentToAskNotify: 'Disable select content to clip',
      closeContentSelector: 'Close content selector',
      toggleCopilot: 'Toggle Copilot',
      toggleCopilotClose: 'The floating sphere is closed, you can refresh the page to redisplay',
      toggleCopilotTooltip: 'Close the floating sphere, you can refresh the page to redisplay',
      copySuccess: 'Content copied to clipboard',
      copyError: 'Failed to copy content',
    },
    webClipper: {
      placeholder: {
        enterOrClipContent: 'Enter content or click clip button to get current page content...',
        title: 'Title',
        enterTitle: 'Enter title or use current page title',
        url: 'URL',
        enterUrl: 'Enter URL or use current page URL',
        content: 'Content',
        metadata: 'Title & URL',
      },
      action: {
        clip: 'Clip Current Page',
        clear: 'Clear',
        save: 'Save',
        fromClipboard: 'Paste from Clipboard',
      },
      info: {
        saveToLibrary: 'Save to Knowledge Base',
      },
      error: {
        clipContentFailed: 'Failed to clip content',
        contentRequired: 'Content is required',
        saveFailed: 'Failed to save content',
        clipboardEmpty: 'Clipboard is empty',
        clipboardReadFailed: 'Failed to read from clipboard',
      },
      success: {
        saved: 'Content saved successfully',
      },
    },
    popup: {
      welcome: 'Welcome to Refly!',
      pleaseLogin: 'Please login to use all features',
      loginRegister: 'Login/Register',
      unsupportedTitle: 'Thanks for using Refly!',
      unsupportedDesc:
        '😵 Due to browser security restrictions, Refly cannot work on the following pages:',
      unsupportedPages: {
        chromeStore: 'Chrome Web Store pages',
        chromePages: 'Chrome pages',
        newTab: 'New tab',
      },
      unsupportedHint: 'You can try Refly on another page.',
      openSidebar: 'Open sidebar to ask',
      refresh: 'Refresh page',
      home: 'Home',
      docs: 'Documentation',
      examplePage: 'For example, this page',
      loading: 'Loading...',
      languageSettings: 'Language Settings',
      settings: {
        title: 'Settings',
        language: 'Language Settings',
        description: 'Change interface language',
      },
    },
  },
};
