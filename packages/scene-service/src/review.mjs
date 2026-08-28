// DAM/协作评审骨架（roadmap M5）：场景变更 diff -> 评审摘要 + 状态流转
// 状态：draft -> reviewing -> approved | rejected -> (revise) -> reviewing
import { diffScenes } from "./diff.mjs";

export const REVIEW_STATES = ["draft", "reviewing", "approved", "rejected"];

// 生成评审摘要（diff 分类计数 + 变更列表）
export function buildReview(before, after, { reviewer = null, note = "" } = {}) {
  const changes = diffScenes(before, after);
  const byKind = {};
  for (const ch of changes) byKind[ch.kind] = (byKind[ch.kind] ?? 0) + 1;
  return {
    state: "draft",
    reviewer,
    note,
    summary: {
      total: changes.length,
      byKind,
    },
    changes,
  };
}

// 状态流转（合法路径校验）
export function transitionReview(review, to) {
  if (!REVIEW_STATES.includes(to)) return { ok: false, error: "未知状态: " + to };
  const LEGAL = { default: ["reviewing"], reviewing: ["approved", "rejected"], approved: [], rejected: ["reviewing"], draft: ["reviewing"] };
  const allowed = LEGAL[review.state] ?? LEGAL.default;
  if (!allowed.includes(to)) return { ok: false, error: "非法流转: " + review.state + " -> " + to };
  const next = { ...review, state: to };
  return { ok: true, review: next };
}

// 变更摘要文本（人类/CI 可读）
export function summaryText(review) {
  const s = review.summary;
  return "评审[" + review.state + "] 变更 " + s.total + " 项" +
    (s.byKind.entity ? "（实体 " + s.byKind.entity + "）" : "") +
    (s.byKind.component ? "（组件 " + s.byKind.component + "）" : "") +
    (s.byKind.field ? "（字段 " + s.byKind.field + "）" : "");
}
