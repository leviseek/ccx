// CCX 平台桥 · Web 适配器实现（Display/Input/Channel 契约，align engine/platform bridge.h）
// 桥接层：平台差异（DOM/WebAudio/wx/tt）封装于此；游戏只调用 bridge 接口
import { fitViewport, availableViewport } from './viewport.js';

                                                                                                           
                                                                                        
                                
                           
                           
                       
                                                                         
                                                                         
                                 
 
                                
                        
                                                                      
                             
                                                                                    
 
                                 
                         
                         
                                       
                                        
                                       
                                                       
 

                                                                                                                               
                                                                                      
                                                                    

/** 构造 Web 平台桥（设计分辨率 baseWxbaseH；canvas 承载显示） */
export function createWebBridge(opts   
                            
                  
                 
                 
 )                 {
  const win         = (opts.target ?? window)                     ;
  const baseW = opts.baseW ?? 768;
  const baseH = opts.baseH ?? 384;
  let resizeCb                      = null;

  const display                = {
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
  const channel                = hostChannel
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
  const inputQueue                     = [];
  const keymap                            = {
    ArrowLeft: 'Left', KeyA: 'Left',
    ArrowRight: 'Right', KeyD: 'Right',
    ArrowUp: 'Jump', Space: 'Jump', KeyW: 'Jump',
    KeyR: 'Record', KeyE: 'Summon', KeyQ: 'Swap', KeyP: 'Pause',
  };
  const win2 = opts.target ?? window;
  win2.addEventListener('keydown', (ev               ) => {
    const k = keymap[ev.code]; if (!k) return;
    ev.preventDefault();
    inputQueue.push({ type: 'Press', key: k });
  });
  win2.addEventListener('keyup', (ev               ) => {
    const k = keymap[ev.code]; if (!k) return;
    inputQueue.push({ type: 'Release', key: k });
  });
  const touchToKey                            = {
    'left': 'Left', 'right': 'Right', 'jump': 'Jump',
    'record': 'Record', 'summon': 'Summon', 'swap': 'Swap',
  };
  function bindTouchButton(id        , kind                )       {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); inputQueue.push({ type: kind === 'hold' ? 'Press' : 'Tap', key: touchToKey[id.replace('ccx-btn-', '')]  }); });
    if (kind === 'hold') {
      el.addEventListener('pointerup', () => {
        const k = touchToKey[id.replace('ccx-btn-', '')] ;
        inputQueue.push({ type: 'Release', key: k });
      });
      el.addEventListener('pointerleave', () => {
        const k = touchToKey[id.replace('ccx-btn-', '')] ;
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
