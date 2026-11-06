import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ThemeMode } from './theme';
import type { Memo } from './types';

const MEMOS_KEY = '@floating_memo/memos';
const FLOATING_KEY = '@floating_memo/floating_enabled';
const THEME_KEY = '@floating_memo/theme';

export async function loadMemos(): Promise<Memo[]> {
  try {
    const raw = await AsyncStorage.getItem(MEMOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Memo[]) : [];
  } catch {
    return [];
  }
}

export async function saveMemos(memos: Memo[]): Promise<void> {
  try {
    await AsyncStorage.setItem(MEMOS_KEY, JSON.stringify(memos));
  } catch {
    // 存储失败时静默处理，不影响界面交互
  }
}

export async function loadFloatingEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(FLOATING_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function saveFloatingEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(FLOATING_KEY, enabled ? '1' : '0');
  } catch {
    // 忽略
  }
}

export async function loadThemeMode(): Promise<ThemeMode> {
  try {
    const v = await AsyncStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
    return 'system';
  } catch {
    return 'system';
  }
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_KEY, mode);
  } catch {
    // 忽略
  }
}
