export type ICopilotType = 'extension-sidepanel' | 'extension-csui';
export type IRuntime =
  | 'web'
  | ICopilotType
  | 'extension-background'
  | 'extension-popup'
  | 'desktop';
