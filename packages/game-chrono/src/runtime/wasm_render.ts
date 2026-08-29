// 时之三重奏 · 引擎 wasm 桥接（渐进增强：加载 CCX 引擎软件光栅 -> 真引擎帧渲染；失败回退 JS 精灵渲染）
export interface EngineRect { x: number; y: number; w: number; h: number; color: number }  // color=RGBA32
export interface EngineRenderer {
  ready: boolean;
  /** 世界矩形批量 -> 引擎光栅 -> 像素（RGBA8）；返回 false=不可用 */
  renderFrame(rects: EngineRect[], camX: number, camY: number, viewW: number, viewH: number, out: Uint8Array): boolean;
}

const RECT_CAP = 400;      // 矩形上限（*5 float = 20B）
const RECT_OFFSET = 0;
const PIX_OFFSET = RECT_OFFSET + RECT_CAP * 20;

export async function createEngineRenderer(wasmPath = 'chrono_game.wasm'): Promise<EngineRenderer> {
  const none: EngineRenderer = { ready: false, renderFrame: () => false };
  try {
    const resp = await fetch(wasmPath);
    if (!resp.ok) return none;
    const buf = await resp.arrayBuffer();
    const inst = (await WebAssembly.instantiate(buf, {})).instance as WebAssembly.Instance & {
      exports: { ccx_render_frame: (p: number, n: number, cx: number, cy: number, vw: number, vh: number, out: number) => void; memory: WebAssembly.Memory };
    };
    const ex = inst.exports;
    const rects = new Float32Array(RECT_CAP * 5);
    const colorBits = new Uint32Array(1);
    return {
      ready: true,
      renderFrame(rs, camX, camY, viewW, viewH, out) {
        const n = Math.min(rs.length, RECT_CAP);
        for (let i = 0; i < n; i++) {
          const r = rs[i]; const o = i * 5;
          rects[o] = r.x; rects[o + 1] = r.y; rects[o + 2] = r.w; rects[o + 3] = r.h;
          colorBits[0] = r.color >>> 0;
          rects[o + 4] = new Float32Array(colorBits.buffer)[0];  // 位型携带 RGBA32
        }
        try {
          const mem = ex.memory.buffer;
          new Float32Array(mem, RECT_OFFSET, RECT_CAP * 5).set(rects.subarray(0, n * 5));
          ex.ccx_render_frame(RECT_OFFSET, n, camX, camY, viewW, viewH, PIX_OFFSET);
          out.set(new Uint8Array(mem, PIX_OFFSET, out.length));
          return true;
        } catch { return false; }
      },
    };
  } catch { return none; }
}
