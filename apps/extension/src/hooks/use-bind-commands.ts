import { useEffect, useRef } from 'react';
import hotKeys from 'hotkeys-js';
import { useCopilotStore } from '@refly-packages/ai-workspace-common/stores/copilot';

export const useBindCommands = () => {
  // 快捷键相关
  const copilotStore = useCopilotStore();
  const _softKeyboardShortcutsEnabledRef = useRef(true);
  const _keyboardShortcutRef = useRef('');
  const _keyboardSendShortcutRef = useRef('');

  // const loadCommands = async () => {
  //   const commands = await apiRequest({
  //     name: 'getAllCommands',
  //   });
  //   commands?.data?.forEach((command) => {
  //     if (command?.name === '_execute_action' && command?.shortcut) {
  //       keyboardShortcutRef.current = command?.shortcut;
  //     }
  //   });

  //   const osType = reflyEnv.getOsType();
  //   if (!keyboardShortcutRef.current && softKeyboardShortcutsEnabledRef.current) {
  //     const defaultShortcutKey = reflyEnv.getDefaultShortcutKey();
  //     keyboardShortcutRef.current = osType === 'OSX' ? `Command+${defaultShortcutKey}` : `Ctrl+${defaultShortcutKey}`;
  //   }

  //   if (!keyboardSendShortcutRef.current) {
  //     const defaultSendShortcutKey = reflyEnv.getDefaultSendShortcutKey();
  //     keyboardSendShortcutRef.current =
  //       osType === 'OSX' ? `Command+${defaultSendShortcutKey}` : `Ctrl+${defaultSendShortcutKey}`;
  //   }

  //   handleBindHotkey();
  // };

  const handleBindHotkey = () => {
    hotKeys('command+j, ctrl+j', () => {
      console.log('hit hotkey');

      const { isCopilotOpen } = useCopilotStore.getState();
      copilotStore.setIsCopilotOpen(!isCopilotOpen);
    });
  };

  useEffect(() => {
    handleBindHotkey();

    return () => {};
  }, []);
};
