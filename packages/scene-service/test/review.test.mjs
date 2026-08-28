import test from "node:test";
import assert from "node:assert/strict";
import { buildReview, transitionReview, summaryText, REVIEW_STATES } from "../src/review.mjs";

const before = { entities: [
  { id: 1, name: "bg", components: [{ type: "ccx.Transform", data: { position: [0, 0] } }] },
  { id: 2, name: "hero", components: [{ type: "ccx.Sprite", data: { atlas: 1 } }] },
] };
const after = { entities: [
  { id: 1, name: "bg", components: [{ type: "ccx.Transform", data: { position: [0, 0] } }] },
  { id: 2, name: "hero", components: [{ type: "ccx.Sprite", data: { atlas: 2 } }] },
  { id: 3, name: "coin", components: [{ type: "ccx.Sprite", data: { atlas: 1 } }] },
] };

test("review: diff 统计与摘要", () => {
  const r = buildReview(before, after, { note: "加点" });
  // before: bg + hero(atlas 1)；after: bg + hero(atlas 2) + coin => 实体 +1 字段 +1
  assert.equal(r.summary.total, 2);
  assert.equal(r.summary.byKind.entity, 1);
  assert.equal(r.summary.byKind.field, 1);
  assert.equal(r.state, "draft");
  assert.ok(summaryText(r).includes("变更 2 项"));
});

test("review: 状态流转合法路径", () => {
  let r = buildReview(before, after);
  r = transitionReview(r, "reviewing").review;
  assert.equal(r.state, "reviewing");
  r = transitionReview(r, "approved").review;
  assert.equal(r.state, "approved");
  // 已批准不可再转
  const bad = transitionReview(r, "reviewing");
  assert.equal(bad.ok, false);
});

test("review: 非法流转拒绝", () => {
  const r = buildReview(before, after);
  const t1 = transitionReview(r, "approved");
  assert.equal(t1.ok, false, "draft 不能直接 approved");
  const unknown = transitionReview(r, "archived");
  assert.equal(unknown.ok, false);
  assert.ok(REVIEW_STATES.length === 4);
});
