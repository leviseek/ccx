#!/usr/bin/env node
// M4 云构建：远端 daemon 入口——TLS 行协议代理 -> 内部 stdio daemon（服务逻辑零复制）
// 用法：CCX_TLS_KEY=... CCX_TLS_CERT=... [CCX_TLS_CA=...] [CCX_REMOTE_PORT=41112] node remote_daemon.mjs
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:tls";
import * as rl from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.CCX_REMOTE_PORT ?? 41112);
const key = process.env.CCX_TLS_KEY;
const cert = process.env.CCX_TLS_CERT;
const ca = process.env.CCX_TLS_CA ?? null;
if (!key || !cert) {
  console.error("需 CCX_TLS_KEY / CCX_TLS_CERT");
  process.exit(1);
}

// 内部 stdio daemon 子进程（复用全部服务 + token 鉴权）；env 透传（含 CCX_TOKEN）
const inner = spawn(process.execPath, [join(here, "daemon.mjs")], { stdio: ["pipe", "pipe", "inherit"] });
const innerRl = rl.createInterface({ input: inner.stdout, crlfDelay: Infinity });

// 每 TLS 连接：socket 行 -> inner stdin；inner 行 -> socket
const server = createServer({ key: readFileSync(key), cert: readFileSync(cert), ca: ca ? readFileSync(ca) : undefined }, (socket) => {
  const sockRl = rl.createInterface({ input: socket, crlfDelay: Infinity });
  sockRl.on("line", (line) => { if (line.trim()) inner.stdin.write(line + "\n"); });
  innerRl.on("line", (line) => { if (line && !socket.destroyed) socket.write(line + "\n"); });
  socket.on("close", () => { innerRl.removeAllListeners("line"); });
  socket.on("error", () => innerRl.removeAllListeners("line"));
});

server.listen(port, () => console.error("[remote-daemon] TLS on :" + port));
