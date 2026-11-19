import { dotnet } from './_framework/dotnet.js';

let loading;

/** Loads the .NET runtime once and resolves to the engine's exports. Works on the main thread and in a Web Worker. */
export function loadEngine() {
  loading ??= (async () => {
    const runtime = await dotnet.withDiagnosticTracing(false).create();
    const { Exports } = await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName);
    return {
      EngineVersion: Exports.EngineVersion,
      Parse: Exports.Parse,
      Reset: Exports.Reset,
      AddPending: Exports.AddPending,
      Complete: Exports.Complete,
      TakeMatch: Exports.TakeMatch,
      heapBytes: () => runtime.Module.HEAPU8.byteLength,
    };
  })();
  return loading;
}
