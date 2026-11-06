import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatRelativeTime } from '../format';
import type { Palette } from '../theme';
import type { Memo } from '../types';

type Props = {
  memo: Memo;
  palette: Palette;
  /** 该条是否允许打码（仅「剪贴板自动记录」且隐私保护开启时） */
  maskable: boolean;
  /** 当前是否处于打码显示状态 */
  masked: boolean;
  onToggleReveal: () => void;
  onToggleDone: () => void;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
};

function maskText(text: string): string {
  const len = Math.min(Math.max(text.length, 3), 20);
  return '*'.repeat(len);
}

function MemoItem({
  memo,
  palette,
  maskable,
  masked,
  onToggleReveal,
  onToggleDone,
  onCopy,
  onDelete,
}: Props) {
  const [copied, setCopied] = useState(false);
  const count = memo.count ?? 1;
  const done = !!memo.done;

  const handleCopy = () => {
    // 复制始终是纯文字，不带任何勾选框符号
    onCopy(memo.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.textRow}>
        {memo.isTodo ? (
          <Pressable onPress={onToggleDone} hitSlop={10} style={styles.checkbox}>
            <Text style={[styles.checkboxText, { color: done ? palette.success : palette.text }]}>
              {done ? '☑' : '☐'}
            </Text>
          </Pressable>
        ) : null}
        <Text
          style={[
            styles.text,
            { color: done ? palette.textSecondary : palette.text },
            done ? styles.doneText : null,
          ]}
          selectable={!masked}
        >
          {masked ? maskText(memo.text) : memo.text}
        </Text>
        {count > 1 ? (
          <View style={[styles.countBadge, { backgroundColor: palette.accent }]}>
            <Text style={styles.countText}>×{count}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.footer}>
        <View style={styles.metaRow}>
          {memo.source === 'clipboard' ? (
            <Text style={[styles.tag, { color: palette.textSecondary }]}>剪贴板</Text>
          ) : null}
          <Text style={[styles.time, { color: palette.textSecondary }]}>
            {formatRelativeTime(memo.createdAt)}
          </Text>
        </View>
        <View style={styles.actions}>
          {maskable ? (
            <Pressable
              onPress={onToggleReveal}
              hitSlop={8}
              style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.iconText, { color: palette.textSecondary }]}>
                {masked ? '👁' : '🙈'}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleCopy}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: palette.surfaceMuted, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[styles.btnText, { color: copied ? palette.success : palette.text }]}>
              {copied ? '已复制' : '复制'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onDelete(memo.id)}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: palette.surfaceMuted, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[styles.btnText, { color: palette.danger }]}>删除</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default memo(MemoItem);

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    marginRight: 8,
    marginTop: -1,
  },
  checkboxText: {
    fontSize: 20,
  },
  text: {
    flex: 1,
    fontSize: 16,
    lineHeight: 23,
  },
  doneText: {
    textDecorationLine: 'line-through',
  },
  countBadge: {
    marginLeft: 8,
    marginTop: 2,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tag: {
    fontSize: 11,
  },
  time: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  iconText: {
    fontSize: 16,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
