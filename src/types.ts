export type MemoSource = 'manual' | 'clipboard';

export type Memo = {
  id: string;
  text: string;
  createdAt: number;
  /** 重复次数（查重折叠后累加），至少为 1 */
  count?: number;
  /** 来源：手动输入 / 剪贴板自动记录。隐私打码只作用于剪贴板记录 */
  source?: MemoSource;
  /** 是否为待办事项 */
  isTodo?: boolean;
  /** 待办是否已完成 */
  done?: boolean;
};
