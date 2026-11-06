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

export default requireNativeModule<FloatingMemoModule>('FloatingMemo');
