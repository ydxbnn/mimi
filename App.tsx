import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
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
  loadFloatingEnabled,
  loadIgnoredVersion,
  loadMemos,
  loadThemeMode,
  prependMemo,
  removeLatestMemo,
  saveFloatingEnabled,
  saveIgnoredVersion,
  saveMemos,
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
  const [loaded, setLoaded] = useState(false);

  const pendingEnableRef = useRef(false);

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

  // 持久化防抖
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

  // 悬浮窗「快速保存」
  useEffect(() => {
    const sub = FloatingMemo.addListener('onSave', (e) => {
      addMemo(e.text);
    });
    return () => sub.remove();
  }, [addMemo]);

  // 关闭悬浮窗（长按 / 通知按钮）后同步开关
  useEffect(() => {
    const sub = FloatingMemo.addListener('onDismiss', () => {
      setFloatingEnabled(false);
      saveFloatingEnabled(false);
    });
    return () => sub.remove();
  }, []);

  // 悬浮窗「撤回最新」
  useEffect(() => {
    const sub = FloatingMemo.addListener('onUndo', () => {
      undoLatest();
    });
    return () => sub.remove();
  }, [undoLatest]);

  // 首次加载
  useEffect(() => {
    (async () => {
      const [m, f, t] = await Promise.all([
        loadMemos(),
        loadFloatingEnabled(),
        loadThemeMode(),
      ]);
      setMemos(m);
      setThemeMode(t);
      setLoaded(true);

      if (f) {
        await ensureNotificationPermission();
        const ok =
          (await FloatingMemo.hasOverlayPermission()) && (await FloatingMemo.show());
        setFloatingEnabled(ok);
      }
    })();
  }, []);

  // 主题变化
  useEffect(() => {
    saveThemeMode(themeMode);
    FloatingMemo.setDarkMode(isDark).catch(() => {});
  }, [themeMode, isDark]);

  // 从授权页返回后自动开启
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

  // 回到前台时对齐真实状态
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      try {
        if (floatingEnabled && !(await FloatingMemo.isShowing())) {
          setFloatingEnabled(false);
          saveFloatingEnabled(false);
        }
      } catch {
        // 忽略
      }
    });
    return () => sub.remove();
  }, [floatingEnabled]);

  // 佛系更新检查
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
      // 无网络 / API 失败：静默
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    checkUpdate(false);
  }, [checkUpdate]);

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
          <Text style={[styles.title, { color: palette.text }]}>悬浮便签 Lite</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>只留最纯粹的随手记</Text>
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
        renderItem={({ item }) => (
          <SwipeableRow
            actionLabel="☐ 设为待办"
            onAction={() => setTodo(item.id)}
            enabled={!item.isTodo}
            palette={palette}
          >
            <MemoItem
              memo={item}
              palette={palette}
              maskable={false}
              masked={false}
              onToggleReveal={() => {}}
              onToggleDone={() => toggleDone(item.id)}
              onCopy={copyMemo}
              onDelete={deleteMemo}
            />
          </SwipeableRow>
        )}
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
  updateBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  updateBtnText: {
    fontSize: 15,
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
