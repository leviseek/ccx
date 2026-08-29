// 时之三重奏 · 渠道适配层（platform-spec §4 语义：检测宿主 -> 能力面）
// 首发 Generic Web（GitHub Pages）；微信/抖音小游戏宿主检测预留（wx/tt Game 全局）
                                                                                 
                                 
                  
                    
                             
                                                                                    
 

                                                                                                                                   
                                                                            

export function detectChannel(env                                                                = {})                 {
  const wx = env.wx ?? (typeof window !== 'undefined' ? window.wx : undefined);
  const tt = env.tt ?? (typeof window !== 'undefined' ? window.tt : undefined);
  if (wx) return miniAdapter('wechat', wx);
  if (tt) return miniAdapter('douyin', tt);
  return {
    channel: 'web',
    caps: { vibrate: false, share: false, login: false },
    vibrate: () => {},
    share: () => ({ ok: false, error: 'web 无分享能力（浏览器原生分享可由宿主套壳）' }),
  };
}

function miniAdapter(channel        , host              )                 {
  return {
    channel,
    caps: { vibrate: !!host.vibrateShort, share: !!host.shareAppMessage, login: !!host.login },
    vibrate: (ms = 30) => { if (host.vibrateShort) host.vibrateShort({ type: 'light' }); else if (ms > 0 && host.vibrateShort) host.vibrateShort(); },
    share: (payload) => {
      if (!host.shareAppMessage) return { ok: false, error: '宿主不支持分享' };
      try { host.shareAppMessage({ title: payload.title, path: payload.path ?? '' }); return { ok: true }; }
      catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
    },
  };
}
