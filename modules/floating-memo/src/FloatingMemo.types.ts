// 悬浮备忘原生模块的 TypeScript 类型。

export type FloatingMemoSaveEvent = {
  /** 用户通过悬浮窗快速输入框保存的文字内容 */
  text: string;
};

export type FloatingMemoDismissEvent = {
  /** 关闭原因，例如 longPress（长按气泡） */
  reason: string;
};

export type FloatingMemoEvents = {
  onSave(event: FloatingMemoSaveEvent): void;
  onDismiss(event: FloatingMemoDismissEvent): void;
};

export type FloatingMemoNativeModule = {
  /** 是否已授予「悬浮在其他应用上层」权限 */
  hasOverlayPermission(): Promise<boolean>;
  /** 若未授权则跳转系统授权页；返回当前是否已授权 */
  requestOverlayPermission(): Promise<boolean>;
  /** 显示悬浮气泡；无权限时返回 false */
  show(): Promise<boolean>;
  hide(): Promise<void>;
  isShowing(): Promise<boolean>;
  /** 设置悬浮输入框是否为深色 */
  setDarkMode(dark: boolean): Promise<void>;
  /** 订阅「快速保存」/「长按关闭」事件 */
  addListener(
    event: 'onSave' | 'onDismiss',
    listener: (event: FloatingMemoSaveEvent | FloatingMemoDismissEvent) => void,
  ): { remove(): void };
  removeAllListeners(event: 'onSave' | 'onDismiss'): void;
};
