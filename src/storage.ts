import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ThemeMode } from './theme';
import type { Memo, MemoSource } from './types';

const MEMOS_KEY = '@floating_memo/memos';
const FLOATING_KEY = '@floating_memo/floating_enabled';
const THEME_KEY = '@floating_memo/theme';
const PRIVACY_KEY = '@floating_memo/privacy_mode';
const AUTO_CLIPBOARD_KEY = '@floating_memo/auto_clipboard';
const IDLE_KEY = '@floating_memo/idle_minutes';
const IGNORED_VERSION_KEY = '@floating_memo/ignored_version';

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

/**
 * 查重折叠：把新内容与「最新一条」比较（列表第一个即最新）。
 * - 内容完全相同：计数 +1，时间更新为现在，保持在最前；
 * - 内容不同：作为新记录插到最前，计数从 1 开始。
 */
export function prependMemo(
  list: Memo[],
  rawText: string,
  source: MemoSource = 'manual',
): Memo[] {
  const text = rawText.trim();
  if (!text) return list;

  const latest = list[0];
  if (latest && latest.text === text) {
    // 只要参与折叠的任一方来自剪贴板，就按剪贴板来源处理（保证打码）
    const mergedSource: MemoSource =
      latest.source === 'clipboard' || source === 'clipboard' ? 'clipboard' : 'manual';
    const updated: Memo = {
      ...latest,
      count: (latest.count ?? 1) + 1,
      createdAt: Date.now(),
      source: mergedSource,
    };
    return [updated, ...list.slice(1)];
  }

  const fresh: Memo = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    createdAt: Date.now(),
    count: 1,
    source,
  };
  return [fresh, ...list];
}

/** 撤回：删除最新一条（列表第一个） */
export function removeLatestMemo(list: Memo[]): Memo[] {
  return list.length === 0 ? list : list.slice(1);
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

export async function loadPrivacyMode(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PRIVACY_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function savePrivacyMode(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PRIVACY_KEY, enabled ? '1' : '0');
  } catch {
    // 忽略
  }
}

export async function loadAutoClipboard(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(AUTO_CLIPBOARD_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function saveAutoClipboard(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTO_CLIPBOARD_KEY, enabled ? '1' : '0');
  } catch {
    // 忽略
  }
}

/** 闲置自动关闭时长（分钟），范围 1–120 */
export async function loadIdleMinutes(): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(IDLE_KEY);
    if (v === null) return 30;
    const n = Number(v);
    if (!Number.isFinite(n)) return 30;
    return Math.min(120, Math.max(1, Math.round(n)));
  } catch {
    return 30;
  }
}

export async function saveIdleMinutes(minutes: number): Promise<void> {
  try {
    await AsyncStorage.setItem(IDLE_KEY, String(minutes));
  } catch {
    // 忽略
  }
}

/** 用户选择「别来烦我」时记下的版本号 */
export async function loadIgnoredVersion(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(IGNORED_VERSION_KEY);
  } catch {
    return null;
  }
}

export async function saveIgnoredVersion(version: string): Promise<void> {
  try {
    await AsyncStorage.setItem(IGNORED_VERSION_KEY, version);
  } catch {
    // 忽略
  }
}
