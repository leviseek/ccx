import test from "node:test";
import assert from "node:assert/strict";
import { IChannelSDK } from "../src/channel_sdk.mjs";
import { createChannel, CHANNELS, WeChatChannel, DouyinChannel } from "../src/mock_channels.mjs";

test("channel: 微信适配器 pay/share/login 可用", () => {
  const wx = createChannel("wechat");
  assert.ok(wx instanceof WeChatChannel);
  const p = wx.pay({ amount: 6 });
  assert.equal(p.ok, true);
  assert.ok(p.orderId.startsWith("wx-6"));
  const l = wx.login();
  assert.equal(l.token, "wx-token-demo");
  assert.equal(wx.has("pay"), true);
  assert.equal(wx.has("ads"), false, "微信未实现 ads");
});

test("channel: 抖音未实现 login 明确报错", () => {
  const dy = createChannel("douyin");
  assert.ok(dy instanceof DouyinChannel);
  const l = dy.login();
  assert.equal(l.ok, false);
  assert.ok(l.error.includes("douyin"));
  assert.equal(dy.has("vibrate"), true);
});

test("channel: 未知渠道与基类占位", () => {
  assert.equal(createChannel("kaka"), null);
  const base = new IChannelSDK("test");
  const r = base.showAd("rewarded");
  assert.equal(r.ok, false);
  assert.ok(r.error.includes("未实现"));
  assert.equal(base.has("ads"), true);
});
