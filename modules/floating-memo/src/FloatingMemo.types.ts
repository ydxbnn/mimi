// 悬浮备忘原生模块的 TypeScript 类型。

export type FloatingMemoSaveEvent = {
  /** 用户通过悬浮窗快速输入框保存的文字内容 */
  text: string;
};

export type FloatingMemoDismissEvent = {
  /** 关闭原因，例如 longPress（长按气泡） */
  reason: string;
};

export type FloatingMemoUndoEvent = {
  /** 撤回来源，例如 undoButton（输入框顶部按钮） */
  reason: string;
};

export type FloatingMemoClipboardEvent = {
  /** 已过滤（去验证码）的剪贴板文本 */
  text: string;
};

export type FloatingMemoAutoSleepEvent = {
  /** 休眠原因，例如 idle（闲置超时） */
  reason: string;
};

export type FloatingMemoEvents = {
  onSave(event: FloatingMemoSaveEvent): void;
  onDismiss(event: FloatingMemoDismissEvent): void;
  onUndo(event: FloatingMemoUndoEvent): void;
  onClipboard(event: FloatingMemoClipboardEvent): void;
  onAutoSleep(event: FloatingMemoAutoSleepEvent): void;
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
  /** 设置闲置自动关闭时长（分钟，0 表示永不） */
  setIdleTimeout(minutes: number): Promise<void>;
  /** 自动记录成功后的气泡微反馈 */
  flashBubble(): Promise<void>;
  /** 开始监听剪贴板变化 */
  startClipboardWatcher(): Promise<void>;
  /** 停止监听剪贴板变化 */
  stopClipboardWatcher(): Promise<void>;
  /** 订阅事件（onSave / onDismiss / onUndo / onClipboard） */
  addListener(
    event: 'onSave' | 'onDismiss' | 'onUndo' | 'onClipboard' | 'onAutoSleep',
    listener: (event: unknown) => void,
  ): { remove(): void };
  removeAllListeners(
    event: 'onSave' | 'onDismiss' | 'onUndo' | 'onClipboard' | 'onAutoSleep',
  ): void;
};
