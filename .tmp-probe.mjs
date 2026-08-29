import { RpcClient } from "./packages/service-core/src/client.mjs";
try {
  const c1 = await RpcClient.tls({ host: "127.0.0.1", port: 44331, ca: process.argv[2], servername: "ccx" });
  try { await c1.request("asset.list"); console.log("P1: no-reject (BAD)"); }
  catch (e) { console.log("P1 rejected:", e.message); }
  c1.close();
  const c2 = await RpcClient.tls({ host: "127.0.0.1", port: 44331, ca: process.argv[2], servername: "ccx" });
  const list = await c2.request("asset.list", {}, 5000, "cloud-tok-1");
  console.log("P2 assets:", Array.isArray(list.assets), list.assets && list.assets.length);
  c2.close();
  console.log("PROBE-OK");
} catch (e) { console.log("PROBE-FAIL:", e.stack || e); }
process.exit(0);
