import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Palette } from '../theme';

const ACTION_WIDTH = 116;

type Props = {
  children: ReactNode;
  actionLabel: string;
  onAction: () => void;
  /** 只有普通记录允许左滑 */
  enabled: boolean;
  palette: Palette;
};

/**
 * 左滑露出单个操作按钮。用 PanResponder 实现，不引入额外原生依赖，
 * 只响应「水平方向」手势，避免和列表的上下滚动冲突。
 */
export default function SwipeableRow({ children, actionLabel, onAction, enabled, palette }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const close = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        enabledRef.current && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderMove: (_, g) => {
        const next = Math.max(-ACTION_WIDTH, Math.min(0, g.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const open = g.dx < -ACTION_WIDTH / 2;
        Animated.spring(translateX, {
          toValue: open ? -ACTION_WIDTH : 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      },
      onPanResponderTerminate: close,
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  useEffect(() => {
    if (!enabled) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.actionLayer, { backgroundColor: palette.accent }]}>
        <Pressable
          onPress={() => {
            close();
            onAction();
          }}
          style={styles.actionBtn}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      </View>
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    flex: 1,
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
