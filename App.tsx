import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  Platform,
  PermissionsAndroid,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Switch,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import FloatingMemo from './modules/floating-memo';
import MemoItem from './src/components/MemoItem';
import {
  loadFloatingEnabled,
  loadMemos,
  loadThemeMode,
  saveFloatingEnabled,
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

  const addMemo = useCallback((text: string) => {
    const memo: Memo = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      createdAt: Date.now(),
    };
    setMemos((prev) => {
      const next = [memo, ...prev];
      saveMemos(next);
      return next;
    });
  }, []);

  const deleteMemo = useCallback((id: string) => {
    setMemos((prev) => {
      const next = prev.filter((m) => m.id !== id);
      saveMemos(next);
      return next;
    });
  }, []);

  const copyMemo = useCallback(async (text: string) => {
    await Clipboard.setStringAsync(text);
  }, []);

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

  // 首次加载本地数据
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
        data={memos}
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
            </View>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              全部备忘{loaded ? ` · ${memos.length}` : ''}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <MemoItem memo={item} palette={palette} onCopy={copyMemo} onDelete={deleteMemo} />
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
