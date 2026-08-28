// IChannelSDK 接口（platform-spec §4：ads/pay/share/login；每渠道实现，独立插件不进核心）

// 渠道能力集合（大小游戏渠道公共面 + 渠道差异位）
export const CHANNEL_CAPS = ["ads", "pay", "share", "login", "vibrate"];

export class IChannelSDK {
  constructor(channel = "generic") {
    this.channel = channel;
    this.capabilities = CHANNEL_CAPS;
  }

  /** 生命周期适配：渠道启动参数注入 */
  init(params = {}) { return { ok: true, channel: this.channel, params }; }

  /** 广告：激励视频/插屏 */
  showAd(placement = "rewarded") {
    return this._notImplemented("showAd", placement);
  }

  /** 支付：下单/查询 */
  pay(order = {}) {
    return this._notImplemented("pay", order);
  }

  /** 分享 */
  share(payload = {}) {
    return this._notImplemented("share", payload);
  }

  /** 登录：获取渠道 token */
  login() {
    return this._notImplemented("login");
  }

  /** 能力查询（渠道可实现/不支持区分） */
  has(cap) { return this.capabilities.includes(cap); }

  _notImplemented(name, arg) {
    return { ok: false, error: "[" + this.channel + "] " + name + " 未实现" + (arg ? " (" + JSON.stringify(arg) + ")" : "") };
  }
}
