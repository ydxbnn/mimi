import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import Slider from '@react-native-community/slider';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  Linking,
  Platform,
  PermissionsAndroid,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Switch,
  Text,
  ToastAndroid,
  useColorScheme,
  View,
} from 'react-native';

import FloatingMemo from './modules/floating-memo';
import MemoItem from './src/components/MemoItem';
import SwipeableRow from './src/components/SwipeableRow';
import {
  loadAutoClipboard,
  loadFloatingEnabled,
  loadIdleMinutes,
  loadIgnoredVersion,
  loadMemos,
  loadPrivacyMode,
  loadThemeMode,
  prependMemo,
  removeLatestMemo,
  saveAutoClipboard,
  saveFloatingEnabled,
  saveIdleMinutes,
  saveIgnoredVersion,
  saveMemos,
  savePrivacyMode,
  saveThemeMode,
} from './src/storage';
import {
  THEME_CYCLE,
  effectiveScheme,
  resolvePalette,
  themeModeLabel,
  type ThemeMode,
} from './src/theme';
import type { Memo } from './src/types';

const IDLE_MIN = 1;
const IDLE_MAX = 120;

function parseVersion(v: string): number[] | null {
  const m = v.trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function compareVersion(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// Android 13+ 需要通知权限，前台服务的常驻通知才能显示。
// 即使未授权，前台服务仍可运行（只是通知不可见），因此这里不影响主流程。
async function ensureNotificationPermission() {
  if (Platform.OS !== 'android') return;
  if (Number(Platform.Version) < 33) return;
  try {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // 忽略
  }
}

export default function App() {
  const systemScheme = useColorScheme();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [floatingEnabled, setFloatingEnabled] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [privacyMode, setPrivacyMode] = useState(false);
  const [autoClipboard, setAutoClipboard] = useState(false);
  const [idleMinutes, setIdleMinutes] = useState(30);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const pendingEnableRef = useRef(false);
  const lastClipboardRef = useRef('');

  const palette = useMemo(
    () => resolvePalette(themeMode, systemScheme),
    [themeMode, systemScheme],
  );
  const isDark = useMemo(
    () => effectiveScheme(themeMode, systemScheme) === 'dark',
    [themeMode, systemScheme],
  );

  // 已完成的待办自动排到列表最下方
  const sortedMemos = useMemo(() => {
    const active = memos.filter((m) => !(m.isTodo && m.done));
    const done = memos.filter((m) => m.isTodo && m.done);
    return [...active, ...done];
  }, [memos]);

  // 持久化做防抖：避免连续剪贴板事件频繁写盘造成卡顿
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<Memo[] | null>(null);
  const persistMemos = useCallback((list: Memo[]) => {
    pendingSaveRef.current = list;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const toSave = pendingSaveRef.current;
      pendingSaveRef.current = null;
      saveTimerRef.current = null;
      if (toSave) saveMemos(toSave);
    }, 300);
  }, []);

  // 离开时把未落盘的数据写掉
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (pendingSaveRef.current) saveMemos(pendingSaveRef.current);
      pendingSaveRef.current = null;
    };
  }, []);

  // 新增记录（含查重折叠）
  const addMemo = useCallback(
    (text: string, source: 'manual' | 'clipboard' = 'manual') => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setMemos((prev) => {
        const next = prependMemo(prev, trimmed, source);
        if (next !== prev) persistMemos(next);
        return next;
      });
    },
    [persistMemos],
  );

  const deleteMemo = useCallback(
    (id: string) => {
      setMemos((prev) => {
        const next = prev.filter((m) => m.id !== id);
        persistMemos(next);
        return next;
      });
    },
    [persistMemos],
  );

  // 撤回最新一条
  const undoLatest = useCallback(() => {
    setMemos((prev) => {
      const next = removeLatestMemo(prev);
      if (next !== prev) persistMemos(next);
      return next;
    });
  }, [persistMemos]);

  // 左滑「设为待办」
  const setTodo = useCallback(
    (id: string) => {
      setMemos((prev) => {
        const next = prev.map((m) => (m.id === id ? { ...m, isTodo: true, done: false } : m));
        persistMemos(next);
        return next;
      });
    },
    [persistMemos],
  );

  // 勾选 / 取消完成
  const toggleDone = useCallback(
    (id: string) => {
      setMemos((prev) => {
        const next = prev.map((m) =>
          m.id === id && m.isTodo ? { ...m, done: !m.done } : m,
        );
        persistMemos(next);
        return next;
      });
    },
    [persistMemos],
  );

  const copyMemo = useCallback(async (text: string) => {
    await Clipboard.setStringAsync(text);
  }, []);

  // 单条明文/打码切换
  const toggleReveal = useCallback((id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 剪贴板文本统一处理：防重复 + 过滤验证码 + 查重保存 + 气泡反馈
  const handleClipboardText = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      // 防死循环：与上一次处理的完全相同就直接跳过
      if (text === lastClipboardRef.current) return;
      lastClipboardRef.current = text;
      // 延后一帧再处理，避免阻塞当前 UI
      setTimeout(() => {
        addMemo(text, 'clipboard');
        FloatingMemo.flashBubble().catch(() => {});
      }, 0);
    },
    [addMemo],
  );

  // 悬浮窗「快速保存」事件
  useEffect(() => {
    const sub = FloatingMemo.addListener('onSave', (e) => {
      addMemo(e.text);
    });
    return () => sub.remove();
  }, [addMemo]);

  // 长按气泡关闭悬浮窗后，同步把开关置为关闭
  useEffect(() => {
    const sub = FloatingMemo.addListener('onDismiss', () => {
      setFloatingEnabled(false);
      saveFloatingEnabled(false);
    });
    return () => sub.remove();
  }, []);

  // 悬浮窗「撤回最新」按钮
  useEffect(() => {
    const sub = FloatingMemo.addListener('onUndo', () => {
      undoLatest();
    });
    return () => sub.remove();
  }, [undoLatest]);

  // 原生剪贴板监听事件
  useEffect(() => {
    const sub = FloatingMemo.addListener('onClipboard', (e) => {
      handleClipboardText(e.text);
    });
    return () => sub.remove();
  }, [handleClipboardText]);

  // 闲置超时自动休眠后，同步关闭主界面开关
  useEffect(() => {
    const sub = FloatingMemo.addListener('onAutoSleep', () => {
      setFloatingEnabled(false);
      saveFloatingEnabled(false);
    });
    return () => sub.remove();
  }, []);

  // 首次加载本地数据
  useEffect(() => {
    (async () => {
      const [m, f, t, p, a, idle] = await Promise.all([
        loadMemos(),
        loadFloatingEnabled(),
        loadThemeMode(),
        loadPrivacyMode(),
        loadAutoClipboard(),
        loadIdleMinutes(),
      ]);
      setMemos(m);
      setThemeMode(t);
      setPrivacyMode(p);
      setAutoClipboard(a);
      setIdleMinutes(idle);
      setLoaded(true);

      try {
        await FloatingMemo.setIdleTimeout(idle);
      } catch {
        // 忽略
      }

      if (a) {
        try {
          await FloatingMemo.startClipboardWatcher();
        } catch {
          // 忽略
        }
      }

      if (f) {
        await ensureNotificationPermission();
        const ok =
          (await FloatingMemo.hasOverlayPermission()) && (await FloatingMemo.show());
        setFloatingEnabled(ok);
      }
    })();
  }, []);

  // 佛系更新检查（force=true 时无视「别来烦我」记录）
  const checkingRef = useRef(false);
  const checkUpdate = useCallback(async (force: boolean) => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const current = parseVersion(Constants.expoConfig?.version ?? '0.0.0');
      if (!current) return;
      const ignored = force ? null : await loadIgnoredVersion();
      const res = await fetch('https://api.github.com/repos/ydxbnn/mimi/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      const tag = typeof data?.tag_name === 'string' ? data.tag_name : '';
      const latest = parseVersion(tag);
      if (!latest) return;

      if (compareVersion(latest, current) <= 0) {
        if (force && Platform.OS === 'android') {
          ToastAndroid.show('当前已是最新版本', ToastAndroid.SHORT);
        }
        return;
      }

      if (ignored === tag) return;

      Alert.alert('发现新版本', `最新版本 ${tag}，是否前往下载？`, [
        {
          text: '前往官网',
          onPress: () => {
            const url = String(data.html_url ?? 'https://github.com/ydxbnn/mimi/releases');
            Linking.openURL(url).catch(() => {});
          },
        },
        {
          text: '别来烦我',
          style: 'cancel',
          onPress: () => {
            saveIgnoredVersion(tag);
          },
        },
      ]);
    } catch {
      // 无网络 / API 失败：静默处理，绝不打扰
    } finally {
      checkingRef.current = false;
    }
  }, []);

  // 启动时静默检查一次
  useEffect(() => {
    checkUpdate(false);
  }, [checkUpdate]);

  // 主题变化：持久化 + 同步原生浮层深浅色
  useEffect(() => {
    saveThemeMode(themeMode);
    FloatingMemo.setDarkMode(isDark).catch(() => {});
  }, [themeMode, isDark]);

  // 从系统授权页返回后，若用户曾想开启悬浮窗，则自动开启
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !pendingEnableRef.current) return;
      pendingEnableRef.current = false;
      (async () => {
        if (await FloatingMemo.hasOverlayPermission()) {
          await ensureNotificationPermission();
          const ok = await FloatingMemo.show();
          setFloatingEnabled(ok);
          if (ok) await saveFloatingEnabled(true);
        }
      })();
    });
    return () => sub.remove();
  }, []);

  // 回到前台：对齐悬浮窗真实状态 + 补读一次剪贴板
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;

      // 自动休眠 / 进程被回收后，把 UI 开关同步成真实状态
      try {
        if (floatingEnabled && !(await FloatingMemo.isShowing())) {
          setFloatingEnabled(false);
          saveFloatingEnabled(false);
        }
      } catch {
        // 忽略
      }

      if (!autoClipboard) return;
      try {
        const text = await Clipboard.getStringAsync();
        if (text) handleClipboardText(text);
      } catch {
        // 读取被系统拒绝时静默失败
      }
    });
    return () => sub.remove();
  }, [autoClipboard, handleClipboardText, floatingEnabled]);

  const toggleFloating = useCallback(async (next: boolean) => {
    if (!next) {
      await FloatingMemo.hide();
      setFloatingEnabled(false);
      await saveFloatingEnabled(false);
      return;
    }
    if (await FloatingMemo.hasOverlayPermission()) {
      await ensureNotificationPermission();
      const ok = await FloatingMemo.show();
      setFloatingEnabled(ok);
      if (ok) await saveFloatingEnabled(true);
      else Alert.alert('开启失败', '无法显示悬浮窗，请稍后重试。');
    } else {
      pendingEnableRef.current = true;
      await FloatingMemo.requestOverlayPermission();
      Alert.alert(
        '需要悬浮窗权限',
        '请在系统设置中开启「显示在其他应用上层」，然后回到本应用，悬浮窗会自动开启。',
      );
    }
  }, []);

  const togglePrivacy = useCallback((next: boolean) => {
    setPrivacyMode(next);
    savePrivacyMode(next);
    setRevealed(new Set());
  }, []);

  const toggleAutoClipboard = useCallback(async (next: boolean) => {
    setAutoClipboard(next);
    saveAutoClipboard(next);
    try {
      if (next) await FloatingMemo.startClipboardWatcher();
      else await FloatingMemo.stopClipboardWatcher();
    } catch {
      // 忽略
    }
  }, []);

  const changeIdle = useCallback((minutes: number) => {
    setIdleMinutes(minutes);
    saveIdleMinutes(minutes);
    FloatingMemo.setIdleTimeout(minutes).catch(() => {});
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeMode((prev) => {
      const idx = THEME_CYCLE.indexOf(prev);
      return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    });
  }, []);

  const topInset = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0;

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <View>
          <Text style={[styles.title, { color: palette.text }]}>悬浮备忘录</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>想到什么，随手记</Text>
        </View>
        <Pressable
          onPress={cycleTheme}
          style={({ pressed }) => [
            styles.themeBtn,
            { backgroundColor: palette.surfaceMuted, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.themeBtnText, { color: palette.text }]}>
            {themeModeLabel(themeMode)}
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={sortedMemos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View
              style={[
                styles.toggleCard,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextWrap}>
                  <Text style={[styles.toggleTitle, { color: palette.text }]}>悬浮窗</Text>
                  <Text style={[styles.toggleDesc, { color: palette.textSecondary }]}>
                    开启后屏幕边缘出现小气泡，点击即可快速记录，记完自动缩回
                  </Text>
                </View>
                <Switch
                  value={floatingEnabled}
                  onValueChange={toggleFloating}
                  trackColor={{ false: palette.border, true: palette.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[styles.divider, { backgroundColor: palette.border }]} />

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextWrap}>
                  <Text style={[styles.toggleTitle, { color: palette.text }]}>隐私保护</Text>
                  <Text style={[styles.toggleDesc, { color: palette.textSecondary }]}>
                    列表内容默认打码，点每条右侧的小眼睛查看
                  </Text>
                </View>
                <Switch
                  value={privacyMode}
                  onValueChange={togglePrivacy}
                  trackColor={{ false: palette.border, true: palette.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[styles.divider, { backgroundColor: palette.border }]} />

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextWrap}>
                  <Text style={[styles.toggleTitle, { color: palette.text }]}>自动记录剪贴板</Text>
                  <Text style={[styles.toggleDesc, { color: palette.textSecondary }]}>
                    复制文字后自动存一条（自动跳过验证码）
                  </Text>
                </View>
                <Switch
                  value={autoClipboard}
                  onValueChange={toggleAutoClipboard}
                  trackColor={{ false: palette.border, true: palette.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[styles.divider, { backgroundColor: palette.border }]} />

              <View style={styles.idleHeader}>
                <Text style={[styles.toggleTitle, { color: palette.text }]}>
                  闲置自动关闭（省电）
                </Text>
                <Text style={[styles.idleValue, { color: palette.accent }]}>
                  {idleMinutes} 分钟
                </Text>
              </View>
              <Text style={[styles.toggleDesc, { color: palette.textSecondary }]}>
                拖动滑块设置 1–120 分钟；悬浮窗开着但长时间没操作时自动收起
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={IDLE_MIN}
                maximumValue={IDLE_MAX}
                step={1}
                value={idleMinutes}
                onValueChange={(v) => setIdleMinutes(Math.round(v))}
                onSlidingComplete={(v) => changeIdle(Math.round(v))}
                minimumTrackTintColor={palette.accent}
                maximumTrackTintColor={palette.border}
                thumbTintColor={palette.accent}
              />

              <Pressable
                onPress={() => checkUpdate(true)}
                style={({ pressed }) => [
                  styles.updateBtn,
                  {
                    borderColor: palette.border,
                    backgroundColor: palette.surfaceMuted,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[styles.updateBtnText, { color: palette.text }]}>检查更新</Text>
              </Pressable>
            </View>

            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              全部备忘{loaded ? ` · ${memos.length}` : ''}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const maskable = privacyMode && item.source !== 'manual';
          return (
            <SwipeableRow
              actionLabel="☐ 设为待办"
              onAction={() => setTodo(item.id)}
              enabled={!item.isTodo}
              palette={palette}
            >
              <MemoItem
                memo={item}
                palette={palette}
                maskable={maskable}
                masked={maskable && !revealed.has(item.id)}
                onToggleReveal={() => toggleReveal(item.id)}
                onToggleDone={() => toggleDone(item.id)}
                onCopy={copyMemo}
                onDelete={deleteMemo}
              />
            </SwipeableRow>
          );
        }}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📝</Text>
              <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
                还没有备忘，打开悬浮窗随手记一条吧
              </Text>
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 3,
  },
  themeBtn: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
  },
  themeBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 48,
  },
  toggleCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTextWrap: {
    flex: 1,
    paddingRight: 16,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggleDesc: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  segRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  idleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  idleValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  slider: {
    width: '100%',
    height: 40,
    marginTop: 4,
  },
  updateBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  updateBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  segItem: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 14,
  },
  segText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 64,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
  },
});
