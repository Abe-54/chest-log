import { loadEngine } from '/engine/engine.js';

const describe = error => ({ name: error?.name, message: error?.message, text: String(error) });

const handlers = {
  async init() {
    const started = performance.now();
    const engine = await loadEngine();
    return { loadMs: performance.now() - started, version: engine.EngineVersion(), isolated: self.crossOriginIsolated, heap: engine.heapBytes() };
  },

  async parse({ folder, name, timeZone }) {
    const engine = await loadEngine();
    const bytes = new Uint8Array(await (await fetch(`/${folder}/${encodeURIComponent(name)}`)).arrayBuffer());
    const started = performance.now();
    try {
      const json = engine.Parse(bytes, name, timeZone);
      return { ok: true, json, ms: performance.now() - started, bytes: bytes.length, heap: engine.heapBytes() };
    } catch (error) {
      return { ok: false, error: describe(error), ms: performance.now() - started, bytes: bytes.length };
    }
  },

  async complete({ pendings, failures, ids }) {
    const engine = await loadEngine();
    engine.Reset();
    let started = performance.now();
    for (const pending of pendings) engine.AddPending(pending);
    const addMs = performance.now() - started;
    started = performance.now();
    const completed = engine.Complete(JSON.stringify(failures));
    const completeMs = performance.now() - started;
    const heapAfterComplete = engine.heapBytes();
    started = performance.now();
    const matches = {};
    for (const id of ids) matches[id] = engine.TakeMatch(id);
    const takeMs = performance.now() - started;
    let takenTwice;
    try { engine.TakeMatch(ids[0]); takenTwice = 'returned a match'; } catch (error) { takenTwice = describe(error).message; }
    return { completed, matches, addMs, completeMs, takeMs, heapAfterComplete, heapAfterTake: engine.heapBytes(), takenTwice };
  },

  async addBadPending({ json }) {
    const engine = await loadEngine();
    engine.Reset();
    try { engine.AddPending(json); return { accepted: true }; } catch (error) { return { accepted: false, error: describe(error) }; }
  },
};

self.onmessage = async ({ data: { id, op, ...args } }) => {
  try {
    self.postMessage({ id, ok: true, result: await handlers[op](args) });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.stack ?? error) });
  }
};
