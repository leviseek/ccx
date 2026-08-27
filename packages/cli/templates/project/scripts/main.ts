// 入口脚本（ADR-004：TS 为唯一游戏脚本语言）
import { Game, Scene } from 'ccx';

Game.main(() => {
  const scene = new Scene('main');
  scene.open();
});
