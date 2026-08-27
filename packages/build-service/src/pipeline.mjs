// Build pipeline: hooks state machine (contributes.builder convention, ADR-006)
// onBeforeInit -> [init] -> onAfterInit -> onBeforeBundle -> [bundle] -> onAfterBundle -> [afterBuild]
export async function runBuild(builder, ctx) {
  const trace = [];
  const step = async (name, fn, phase) => {
    trace.push({ phase, name, status: 'enter' });
    const out = fn ? await fn(ctx) : null;
    if (out && out.ok === false) {
      trace.push({ phase, name, status: 'error', error: out.error });
      return false;
    }
    trace.push({ phase, name, status: 'ok' });
    return true;
  };
  const h = builder.hooks;
  if (!(await step('onBeforeInit', h.onBeforeInit, 'init'))) return { ok: false, trace };
  if (!(await step('onAfterInit', h.onAfterInit, 'init'))) return { ok: false, trace };
  if (!(await step('onBeforeBundle', h.onBeforeBundle, 'bundle'))) return { ok: false, trace };
  ctx.manifest = await ctx.makeManifest();
  if (!(await step('onAfterBundle', h.onAfterBundle, 'bundle'))) return { ok: false, trace };
  if (!(await step('onAfterBuild', h.onAfterBuild, 'build'))) return { ok: false, trace };
  return { ok: true, trace };
}
