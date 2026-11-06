import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatRelativeTime } from '../format';
import type { Palette } from '../theme';
import type { Memo } from '../types';

type Props = {
  memo: Memo;
  palette: Palette;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
};

function MemoItem({ memo, palette, onCopy, onDelete }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(memo.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.text, { color: palette.text }]} selectable>
        {memo.text}
      </Text>
      <View style={styles.footer}>
        <Text style={[styles.time, { color: palette.textSecondary }]}>
          {formatRelativeTime(memo.createdAt)}
        </Text>
        <View style={styles.actions}>
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
    marginBottom: 12,
  },
  text: {
    fontSize: 16,
    lineHeight: 23,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  time: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
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
