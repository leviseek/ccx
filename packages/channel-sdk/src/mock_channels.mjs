// Mock 渠道实现（微信/抖音骨架）：pay/share/login 模拟；ads 未实现示例
import { IChannelSDK } from "./channel_sdk.mjs";

// 微信小游戏渠道适配器（IChannelSDK 独立插件形态）
export class WeChatChannel extends IChannelSDK {
  constructor() { super("wechat"); this.capabilities = ["pay", "share", "login"]; }
  pay(order = {}) {
    return { ok: true, channel: "wechat", orderId: "wx-" + (order.amount ?? 0) };
  }
  share(payload = {}) {
    return { ok: true, channel: "wechat", title: payload.title ?? "ccx" };
  }
  login() {
    return { ok: true, channel: "wechat", token: "wx-token-demo" };
  }
}

// 抖音字节跳动渠道适配器
export class DouyinChannel extends IChannelSDK {
  constructor() { super("douyin"); this.capabilities = ["pay", "share", "vibrate"]; }
  pay(order = {}) {
    return { ok: true, channel: "douyin", orderId: "dy-" + (order.amount ?? 0) };
  }
  share(payload = {}) {
    return { ok: true, channel: "douyin", title: payload.title ?? "ccx" };
  }
  login() {
    return this._notImplemented("login");  // 抖音未实现登录（示例）
  }
}

// 渠道注册表（builder 类插件：独立 npm/zip 包可由 register 挂载）
export const CHANNELS = { wechat: WeChatChannel, douyin: DouyinChannel };

export function createChannel(name) {
  const C = CHANNELS[name];
  return C ? new C() : null;
}
