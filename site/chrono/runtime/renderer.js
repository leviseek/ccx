// 时之三重奏 · 浏览器渲染器（canvas 2D 执行 scene_draw 指令；像素风）
// 精灵纹理：sprite_data 像素 -> offscreen canvas（imageSmoothing=false 保像素感）
import { artPixels } from '../sprite_data.js';
                                                          

export const TILE = 32;              // 渲染像素/tile
export const VIEW_TILES_X = 24;      // 视口宽（tiles）
export const VIEW_TILES_Y = 12;      // 视口高（tiles）

                           
                            
                                
                                                
                                                                 
                                           
                                                                                                                                          
                                                 
 

                                                                                         

export function createRenderer(canvas                   )           {
  const ctx = canvas.getContext('2d') ;
  let viewW = VIEW_TILES_X * TILE;
  let viewH = VIEW_TILES_Y * TILE;
  let dpr = 1;
  canvas.width = viewW;
  canvas.height = viewH;
  ctx.imageSmoothingEnabled = false;

  function setView(logicalW        , logicalH        , deviceRatio        )       {
    viewW = Math.max(1, Math.round(logicalW));
    viewH = Math.max(1, Math.round(logicalH));
    dpr = Math.max(1, deviceRatio || 1);
    canvas.style.width = viewW + 'px';
    canvas.style.height = viewH + 'px';
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
  }

  let engine                     = null;
  let engineCanvas                           = null;
  let engineCtx                                  = null;
  let enginePixels                    = null;

  /** 世界 -> 引擎光栅矩形（主题色；残影半透明） */
  function worldRects(L           )               {
    const C = (r        , g        , b        , a = 255) => ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
    const rects               = [];
    const push = (x        , y        , w        , h        , color        ) => rects.push({ x, y, w, h, color });
    for (const s of L.solids) push(s.x, s.y, s.w, s.h, C(59, 61, 92));       // 暗砖
    for (const sw of L.switches) push(sw.x, sw.y, sw.w, sw.h, sw.on ? C(224, 82, 82) : C(107, 111, 143));
    for (const d of L.doors) if (!d.open) push(d.x, d.y, d.w, d.h, C(138, 95, 216));
    for (const c of L.collectibles) push(c.x, c.y, c.w, c.h, C(255, 215, 94));
    push(L.finish.x, L.finish.y, L.finish.w, L.finish.h, C(76, 191, 168));
    for (const e of L.echoes) push(e.x, e.y, e.w, e.h, C(76, 191, 168, 110));
    { const p = L.player; push(p.x, p.y, p.w, p.h, C(78, 107, 216)); }
    return rects;
  }

  const tex                                    = {};
  function texFor(name        )                    {
    if (!tex[name]) {
      const { pixels, w, h } = artPixels(name);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const cc = c.getContext('2d') ;
      const img = cc.createImageData(w, h);
      img.data.set(pixels);
      cc.putImageData(img, 0, 0);
      tex[name] = c;
    }
    return tex[name];
  }

  function draw(L           , hud         )       {
    const levelW = L.levelW * TILE, levelH = L.levelH * TILE;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // 物理像素 -> 逻辑坐标
    // 引擎渲染路径（wasm 软件光栅）：真引擎管线出帧
    if (engine) {
      const camX = Math.max(0, Math.min(L.player.x * TILE - viewW / 2, levelW - viewW));
      const camY = Math.max(0, Math.min(L.player.y * TILE - viewH / 2, levelH - viewH));
      if (!engineCanvas) {
        engineCanvas = document.createElement('canvas');
        engineCtx = engineCanvas.getContext('2d') ;
      }
      engineCanvas.width = viewW; engineCanvas.height = viewH;
      if (!enginePixels || enginePixels.length !== viewW * viewH * 4) enginePixels = new Uint8Array(viewW * viewH * 4);
      if (engine.renderFrame(worldRects(L), camX, camY, viewW, viewH, enginePixels)) {
        const img = engineCtx .createImageData(viewW, viewH);
        img.data.set(enginePixels);
        engineCtx .putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(engineCanvas, 0, 0, viewW, viewH);
        drawHud(hud);
        return;
      }
    }
    const camX = Math.max(0, Math.min(L.player.x * TILE - viewW / 2, levelW - viewW));
    const camY = Math.max(0, Math.min(L.player.y * TILE - viewH / 2, levelH - viewH));
    const at = (wx        , wy        )                   => [wx * TILE - camX, wy * TILE - camY];
    const onScreen = (sx        , sw        ) => sx < viewW && sx + sw > 0;

    ctx.fillStyle = '#0f1020';
    ctx.fillRect(0, 0, viewW, viewH);

    for (const s of L.solids) {
      const [sx, sy] = at(s.x, s.y);
      if (!onScreen(sx, s.w * TILE)) continue;
      for (let tx = 0; tx < Math.ceil(s.w); tx++) {
        for (let ty = 0; ty < Math.ceil(s.h); ty++) {
          ctx.drawImage(texFor('tile'), sx + tx * TILE, sy + ty * TILE, TILE, TILE);
        }
      }
    }
    for (const sw of L.switches) {
      const [sx, sy] = at(sw.x, sw.y);
      if (!onScreen(sx, sw.w * TILE)) continue;
      ctx.drawImage(texFor('switch'), sx, sy, sw.w * TILE, sw.h * TILE);
      if (sw.on) {
        ctx.fillStyle = 'rgba(224,82,82,0.55)';
        ctx.fillRect(sx, sy, sw.w * TILE, sw.h * TILE);
      }
    }
    for (const d of L.doors) {
      const [sx, sy] = at(d.x, d.y);
      if (!onScreen(sx, d.w * TILE)) continue;
      ctx.globalAlpha = d.open ? 0.25 : 1;
      ctx.drawImage(texFor('door'), sx, sy, d.w * TILE, d.h * TILE);
      ctx.globalAlpha = 1;
    }
    for (const c of L.collectibles) {
      const [sx, sy] = at(c.x, c.y);
      if (!onScreen(sx, c.w * TILE)) continue;
      ctx.drawImage(texFor('collectible'), sx, sy - TILE * 0.15, c.w * TILE, c.h * TILE);
    }
    {
      const [sx, sy] = at(L.finish.x, L.finish.y);
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(Date.now() / 300);
      ctx.drawImage(texFor('finish'), sx, sy, L.finish.w * TILE, L.finish.h * TILE);
      ctx.globalAlpha = 1;
    }
    for (const e of L.echoes) {
      const [sx, sy] = at(e.x, e.y);
      if (!onScreen(sx, e.w * TILE)) continue;
      ctx.globalAlpha = 0.45;
      ctx.drawImage(texFor('echo'), sx, sy, e.w * TILE, e.h * TILE);
      ctx.globalAlpha = 1;
    }
    {
      const [sx, sy] = at(L.player.x, L.player.y);
      if (onScreen(sx, L.player.w * TILE)) {
        ctx.save();
        if (L.player.facing === -1) {
          ctx.translate(sx + L.player.w * TILE, sy);
          ctx.scale(-1, 1);
          ctx.drawImage(texFor('player'), 0, 0, L.player.w * TILE, L.player.h * TILE);
        } else {
          ctx.drawImage(texFor('player'), sx, sy, L.player.w * TILE, L.player.h * TILE);
        }
        ctx.restore();
      }
    }
    // HUD
    ctx.fillStyle = 'rgba(12,14,26,0.78)';
    ctx.fillRect(0, 0, viewW, 34);
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#e8e8ff';
    ctx.fillText(hud.levelName, 10, 23);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#ffd75e';
    ctx.fillText('碎片 ' + hud.collected + '/' + hud.totalCollectibles, 320, 23);
    const slotTxt = hud.echoSlots.map((s) => s.id + ':' + (s.hasBlueprint ? '已录' : '未录') + (s.uses + 'x')).join('  ');
    ctx.fillStyle = '#9fe2d0';
    ctx.fillText('残影 ' + slotTxt, 480, 23);
    if (hud.hint && !hud.won) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(12,14,26,0.7)';
      const hw = Math.min(hud.hint.length * 7, viewW - 20);
      ctx.fillRect(10, viewH - 30, hw, 22);
      ctx.fillStyle = '#e8e8ff';
      ctx.font = '11px monospace';
      ctx.fillText(hud.hint, 16, viewH - 14);
      ctx.globalAlpha = 1;
    }
  }
  return { canvas, ctx, setView, draw };
}
