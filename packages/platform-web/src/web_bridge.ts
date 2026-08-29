// CCX 平台桥 · Web 适配器实现（Display/Input/Channel 契约，align engine/platform bridge.h）
// 桥接层：平台差异（DOM/WebAudio/wx/tt）封装于此；游戏只调用 bridge 接口
import { fitViewport, availableViewport } from './viewport.ts';

export type BridgeKey = 'Left' | 'Right' | 'Up' | 'Down' | 'Jump' | 'Record' | 'Summon' | 'Swap' | 'Pause';
export interface BridgeInputEvent { type: 'Press' | 'Release' | 'Tap'; key: BridgeKey; }
export interface BridgeDisplay {
  readonly clientW: number;
  readonly clientH: number;
  readonly dpr: number;
  applyViewport(): { logicalW: number; logicalH: number; scale: number };
  present(pixels: Uint8Array, w: number, h: number): void;   // 引擎软件光栅帧上屏
  onResize(cb: () => void): void;
}
export interface BridgeChannel {
  readonly name: string;
  readonly caps: { vibrate: boolean; share: boolean; login: boolean };
  vibrate(ms?: number): void;
  share(payload: { title: string; path?: string }): { ok: boolean; error?: string };
}
export interface PlatformBridge {
  display: BridgeDisplay;
  channel: BridgeChannel;
  /** 输入事件流（键盘/触钮统一入队；游戏帧循环 take 消费） */
  pushInput(ev: BridgeInputEvent): void;
  takeInput(): BridgeInputEvent | null;
  readonly caps: { touch: boolean; keyboard: boolean };
}

type MiniHost = { vibrateShort?(o?: { type?: string }): void; shareAppMessage?(o?: unknown): void; login?(o?: unknown): void };
interface WebEnv { innerWidth: number; innerHeight: number; devicePixelRatio: number }
declare global { interface Window { wx?: MiniHost; tt?: MiniHost } }

/** 构造 Web 平台桥（设计分辨率 baseWxbaseH；canvas 承载显示） */
export function createWebBridge(opts: {
  canvas: HTMLCanvasElement;
  target?: Window;
  baseW?: number;
  baseH?: number;
}): PlatformBridge {
  const win: WebEnv = (opts.target ?? window) as unknown as WebEnv;
  const baseW = opts.baseW ?? 768;
  const baseH = opts.baseH ?? 384;
  let resizeCb: (() => void) | null = null;

  const display: BridgeDisplay = {
    get clientW() { return win.innerWidth; },
    get clientH() { return win.innerHeight; },
    get dpr() { return win.devicePixelRatio || 1; },
    applyViewport() {
      const { availW, availH } = availableViewport(win.innerWidth, win.innerHeight);
      const vp = fitViewport(availW, availH, baseW, baseH, win.devicePixelRatio || 1);
      const c = opts.canvas;
      c.style.width = vp.logicalW + 'px';
      c.style.height = vp.logicalH + 'px';
      c.width = Math.round(vp.logicalW * vp.dpr);
      c.height = Math.round(vp.logicalH * vp.dpr);
      return { logicalW: vp.logicalW, logicalH: vp.logicalH, scale: vp.scale };
    },
    present(pixels, w, h) {
      const c = opts.canvas;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const img = ctx.createImageData(w, h);
      img.data.set(pixels);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.putImageData(img, 0, 0);
    },
    onResize(cb) { resizeCb = cb; },
  };

  const hostChannel = (opts.target ?? window).wx ?? (opts.target ?? window).tt;
  const channel: BridgeChannel = hostChannel
    ? {
        name: (opts.target ?? window).wx ? 'wechat' : 'douyin',
        caps: { vibrate: !!hostChannel.vibrateShort, share: !!hostChannel.shareAppMessage, login: !!hostChannel.login },
        vibrate: (ms = 20) => hostChannel.vibrateShort?.({ type: 'light' }) ?? void 0,
        share: (p) => {
          try { hostChannel.shareAppMessage?.({ title: p.title, path: p.path ?? '' }); return { ok: true }; }
          catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
        },
      }
    : {
        name: 'web',
        caps: { vibrate: false, share: false, login: false },
        vibrate: () => {},
        share: () => ({ ok: false, error: 'web 无分享能力（可由宿主套壳提供）' }),
      };

  // 输入事件流（平台 DOM/触钮 -> 队列 -> 引擎归一化模型）
  const inputQueue: BridgeInputEvent[] = [];
  const keymap: Record<string, BridgeKey> = {
    ArrowLeft: 'Left', KeyA: 'Left',
    ArrowRight: 'Right', KeyD: 'Right',
    ArrowUp: 'Jump', Space: 'Jump', KeyW: 'Jump',
    KeyR: 'Record', KeyE: 'Summon', KeyQ: 'Swap', KeyP: 'Pause',
  };
  const win2 = opts.target ?? window;
  win2.addEventListener('keydown', (ev: KeyboardEvent) => {
    const k = keymap[ev.code]; if (!k) return;
    ev.preventDefault();
    inputQueue.push({ type: 'Press', key: k });
  });
  win2.addEventListener('keyup', (ev: KeyboardEvent) => {
    const k = keymap[ev.code]; if (!k) return;
    inputQueue.push({ type: 'Release', key: k });
  });
  const touchToKey: Record<string, BridgeKey> = {
    'left': 'Left', 'right': 'Right', 'jump': 'Jump',
    'record': 'Record', 'summon': 'Summon', 'swap': 'Swap',
  };
  function bindTouchButton(id: string, kind: 'hold' | 'tap'): void {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); inputQueue.push({ type: kind === 'hold' ? 'Press' : 'Tap', key: touchToKey[id.replace('ccx-btn-', '')]! }); });
    if (kind === 'hold') {
      el.addEventListener('pointerup', () => {
        const k = touchToKey[id.replace('ccx-btn-', '')]!;
        inputQueue.push({ type: 'Release', key: k });
      });
      el.addEventListener('pointerleave', () => {
        const k = touchToKey[id.replace('ccx-btn-', '')]!;
        inputQueue.push({ type: 'Release', key: k });
      });
    }
  }
  bindTouchButton('ccx-btn-left', 'hold');
  bindTouchButton('ccx-btn-right', 'hold');
  bindTouchButton('ccx-btn-jump', 'hold');
  bindTouchButton('ccx-btn-rec', 'tap');
  bindTouchButton('ccx-btn-sum', 'tap');
  bindTouchButton('ccx-btn-swap', 'tap');

  return {
    display, channel,
    pushInput: (ev) => inputQueue.push(ev),
    takeInput: () => inputQueue.shift() ?? null,
    caps: { touch: 'ontouchstart' in win2, keyboard: true },
  };
}
