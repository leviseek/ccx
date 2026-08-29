// 时之三重奏 · 浏览器渲染器（canvas 2D 执行 scene_draw 指令；像素风）
// 精灵纹理：sprite_data 像素 -> offscreen canvas（imageSmoothing=false 保像素感）
import { artPixels } from '../sprite_data.js';
                                                          

export const TILE = 32;              // 渲染像素/tile
export const VIEW_TILES_X = 24;      // 视口宽（tiles）
export const VIEW_TILES_Y = 12;      // 视口高（tiles）

                           
                            
                                
                                                 
 

export function createRenderer(canvas                   )           {
  const ctx = canvas.getContext('2d') ;
  canvas.width = VIEW_TILES_X * TILE;
  canvas.height = VIEW_TILES_Y * TILE;
  ctx.imageSmoothingEnabled = false;

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
    const viewW = canvas.width, viewH = canvas.height;
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
  return { canvas, ctx, draw };
}
