import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const here = import.meta.dirname;
const remoteEntry = join(here, "..", "bin", "remote_daemon.mjs");

test("M4 exit 3: TLS remote daemon RPC with token auth", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ccx-tls-"));
  const key = join(dir, "key.pem");
  const crt = join(dir, "cert.pem");
  // openssl 环境加固（本机 miniconda openssl 需显式 OPENSSL_CONF）
  if (!process.env.OPENSSL_CONF && process.env.CONDA_PREFIX) {
    process.env.OPENSSL_CONF = process.env.CONDA_PREFIX + '\\Library\\ssl\\openssl.cnf';
  }
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", crt, "-days", "1", "-subj", "/CN=ccx"], { stdio: "ignore" });
  assert.ok(existsSync(key) && existsSync(crt), "cert generated");

  const { spawn } = await import("node:child_process");
  const { RpcClient } = await import("../src/client.mjs");
  const port = 44112 + Math.floor(Math.random() * 1000);
  const env = { ...process.env, CCX_TLS_KEY: key, CCX_TLS_CERT: crt, CCX_REMOTE_PORT: String(port), CCX_TOKEN: "cloud-tok-1" };
  const proc = spawn(process.execPath, [remoteEntry], { env, stdio: ["ignore", "ignore", "inherit"] });
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const client = await RpcClient.tls({ host: "127.0.0.1", port, ca: crt, servername: "ccx", rejectUnauthorized: false });
    await assert.rejects(client.request("asset.list"), /Unauthorized|超时/);
    client.close();
    const client2 = await RpcClient.tls({ host: "127.0.0.1", port, ca: crt, servername: "ccx", rejectUnauthorized: false });
    const list = await client2.request("asset.list", {}, 5000, "cloud-tok-1");
    assert.ok(Array.isArray(list.assets), "TLS + token list");
    client2.close();
  } finally {
    proc.kill();
    rmSync(dir, { recursive: true, force: true });
  }
});
