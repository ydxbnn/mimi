import { NativeModule, requireNativeModule } from 'expo';

import type { FloatingMemoEvents } from './FloatingMemo.types';

declare class FloatingMemoModule extends NativeModule<FloatingMemoEvents> {
  hasOverlayPermission(): Promise<boolean>;
  requestOverlayPermission(): Promise<boolean>;
  show(): Promise<boolean>;
  hide(): Promise<void>;
  isShowing(): Promise<boolean>;
  setDarkMode(dark: boolean): Promise<void>;
}

// 在 Web 平台上会解析到 FloatingMemoModule.web.ts（空实现），原生平台则解析到真实模块。
export default requireNativeModule<FloatingMemoModule>('FloatingMemo');
