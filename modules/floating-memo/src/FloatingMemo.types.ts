export type FloatingMemoSaveEvent = {
  /** 用户通过悬浮窗快速输入框保存的文字内容 */
  text: string;
};

export type FloatingMemoDismissEvent = {
  /** 关闭原因，例如 longPress / notificationAction */
  reason: string;
};

export type FloatingMemoUndoEvent = {
  /** 撤回来源，例如 undoButton */
  reason: string;
};

export type FloatingMemoEvents = {
  onSave(event: FloatingMemoSaveEvent): void;
  onDismiss(event: FloatingMemoDismissEvent): void;
  onUndo(event: FloatingMemoUndoEvent): void;
};

export type FloatingMemoNativeModule = {
  hasOverlayPermission(): Promise<boolean>;
  requestOverlayPermission(): Promise<boolean>;
  show(): Promise<boolean>;
  hide(): Promise<void>;
  isShowing(): Promise<boolean>;
  setDarkMode(dark: boolean): Promise<void>;
};
