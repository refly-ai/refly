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
        title: 'Where knowledge thrives',
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
              contentHandleSuccessNotify: 'Processing successful, redirecting to the session page...',
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
      selectContentToAsk: 'Select content to ask',
      enableSelectContentToAskNotify: 'Enable select content to ask',
      disableSelectContentToAskNotify: 'Disable select content to ask',
      closeContentSelector: 'Close content selector',
      toggleCopilot: 'Toggle Copilot',
      toggleCopilotClose: 'The floating sphere is closed, you can refresh the page to redisplay',
      toggleCopilotTooltip: 'Close the floating sphere, you can refresh the page to redisplay',
    },
  },
};
