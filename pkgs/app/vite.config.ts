import inject from "@rollup/plugin-inject";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import { createRequire } from "module";
import stdLibBrowser from "node-stdlib-browser";
import path from "path";
import { defineConfig, type Plugin } from "vite";
import wasm from "vite-plugin-wasm";

const _require = createRequire(import.meta.url);

// Resolve onchain-runtime-v3 browser entry explicitly (avoid Node's `node` condition).
// compact-runtime@0.15.0 is pure ESM and re-exports from onchain-runtime-v3.
// In Bun's module layout, onchain-runtime-v3 is nested inside compact-runtime's
// Bun cache scope, so locate it from compact-runtime's package.json:
//   pkg/package.json -> pkg/ -> @midnight-ntwrk/ -> node_modules/
const _crPkgPath = _require.resolve(
  "@midnight-ntwrk/compact-runtime/package.json",
);
const _crNodeModules = path.dirname(path.dirname(path.dirname(_crPkgPath)));
const onchainRuntimeBrowserPath = path.join(
  _crNodeModules,
  "@midnight-ntwrk",
  "onchain-runtime-v3",
  "midnight_onchain_runtime_wasm.js",
);

// `util`/`assert` aren't direct dependencies of this package (only
// node-stdlib-browser's), and they share their names with Node.js core
// modules, so they can't be resolved via `_require.resolve` from here — read
// the paths node-stdlib-browser itself already resolved for its polyfills.
const utilPkgDir = stdLibBrowser.util as unknown as string;
const assertPkgDir = stdLibBrowser.assert as unknown as string;
const cryptoPkgDir = stdLibBrowser.crypto as unknown as string;
// crypto-browserify's own legacy CJS dependency tree (cipher-base, hash-base,
// randombytes, asn1.js, ...) references bare Node builtin specifiers like
// `stream`/`vm`/`util` that esbuild's `platform: "browser"` resolver refuses
// to resolve on its own (it has no knowledge of Vite's `resolve.alias`).
// Reuse the same polyfill directories node-stdlib-browser already resolved so
// esbuild can fully inline the whole tree as one clean ESM unit.
const nodeBuiltinAliasesForEsbuild = Object.fromEntries(
  Object.entries(stdLibBrowser).filter(([find]) => !find.startsWith("node:")),
) as Record<string, string>;
const pathPkgDir = stdLibBrowser.path as unknown as string;
// semver IS a direct dependency (used in wallet.ts for Lace connector API
// version checks); resolve the exact copy this package's own imports use.
const semverEntry = _require.resolve("semver");

// NOTE: reactEsmShimPlugin was removed. Vite's needsInterop mechanism handles
// React CJS→ESM named export interop natively. All React packages have
// needsInterop:true which makes Vite generate proxy modules with named exports.
// The shim created a second React instance causing "Invalid hook call".
// NOTE: compactRuntimeEsmShimPlugin was removed. compact-runtime@0.15.0 is pure
// ESM and no longer requires a CJS→ESM shim. WASM loading is handled by
// vite-plugin-wasm and optimizeDeps.exclude.
/**
 * Virtual ESM shim for @midnight-ntwrk/midnight-js-utils (production only).
 *
 * midnight-js-utils ships a CJS build that unconditionally requires
 * wallet-sdk-address-format at the top of the file. wallet-sdk-address-format
 * is ESM-only with WASM loading — esbuild cannot bundle it, and Rollup's
 * commonjs plugin leaves the require() call intact, causing a runtime crash.
 *
 * This shim intercepts the import and re-exports only the named members our
 * app actually uses, implemented inline, so the CJS file is never loaded.
 */
function midnightJsUtilsShimPlugin(): Plugin {
  const VIRTUAL_ID = "\0virtual:midnight-js-utils-shim";
  return {
    name: "midnight-js-utils-shim",
    apply: "build",
    enforce: "pre",
    resolveId(id) {
      if (id === "@midnight-ntwrk/midnight-js-utils") return VIRTUAL_ID;
    },
    load(id) {
      if (id !== VIRTUAL_ID) return;
      return `
export const toHex = (bytes) => Buffer.from(bytes).toString("hex");
export const fromHex = (hex) => new Uint8Array(Buffer.from(hex, "hex"));
export const isHex = (s) => typeof s === "string" && /^[0-9a-fA-F]*$/.test(s);
export const parseHex = (s) => { if (!isHex(s)) throw new Error("Not hex: " + s); return s; };
export const assertIsHex = parseHex;
export const assertDefined = (v, msg) => { if (v == null) throw new Error(msg ?? "Expected defined"); return v; };
export const assertUndefined = (v, msg) => { if (v != null) throw new Error(msg ?? "Expected undefined"); };
export const assertIsContractAddress = (addr) => { if (!addr || !isHex(addr)) throw new Error("Invalid contract address: " + addr); };
export const ttlOneHour = () => new Date(Date.now() + 3600_000);
export const parseCoinPublicKeyToHex = (k) => toHex(k);
export const parseEncPublicKeyToHex = (k) => toHex(k);
`;
    },
  };
}

/**
 * Virtual ESM shim for @midnight-ntwrk/onchain-runtime-v3.
 *
 * onchain-runtime-v3 uses top-level await for WASM initialization which
 * esbuild cannot handle. This plugin redirects the import to the explicit
 * browser WASM entry point, bypassing the Node.js conditional export.
 */
function onchainRuntimeV3ShimPlugin(onchainRuntimePath: string): Plugin {
  const ONCHAIN_RUNTIME_V3_ID = "@midnight-ntwrk/onchain-runtime-v3";

  return {
    name: "onchain-runtime-v3-shim",
    enforce: "pre",
    resolveId(id) {
      if (id === ONCHAIN_RUNTIME_V3_ID) {
        return onchainRuntimePath;
      }
    },
  };
}

/**
 * Production-only React ESM shim.
 *
 * In dev mode, Vite pre-bundles React via esbuild with needsInterop:true, which
 * generates named-export proxy modules automatically — no shim needed.
 * In production (Rollup), React's index.js has a conditional require() that
 * Rollup's commonjs plugin cannot statically analyse for named exports.
 * This plugin (apply:'build') intercepts all React imports and inlines the CJS
 * production files as IIFEs, providing explicit named ESM exports.
 */
function reactBuildShimPlugin(): Plugin {
  const rDir = path.dirname(_require.resolve("react/package.json"));
  const rdDir = path.dirname(_require.resolve("react-dom/package.json"));
  // scheduler is a peer dep of react-dom; resolve from react-dom's scope
  const rdRequire = createRequire(path.join(rdDir, "package.json"));
  const schedDir = path.dirname(rdRequire.resolve("scheduler/package.json"));
  // use-sync-external-store is used by react-i18next; resolve from its scope
  const rI18nDir = path.dirname(_require.resolve("react-i18next/package.json"));
  const rI18nRequire = createRequire(path.join(rI18nDir, "package.json"));
  const usseDir = path.dirname(
    rI18nRequire.resolve("use-sync-external-store/package.json"),
  );

  const REACT_ID = "\0virtual:react-build";
  const REACT_DOM_ID = "\0virtual:react-dom-build";
  const REACT_DOM_CLIENT_ID = "\0virtual:react-dom-client-build";
  const JSX_RUNTIME_ID = "\0virtual:jsx-runtime-build";
  const JSX_DEV_RUNTIME_ID = "\0virtual:jsx-dev-runtime-build";
  const USSE_SHIM_ID = "\0virtual:use-sync-external-store-shim-build";

  return {
    name: "react-build-shim",
    apply: "build",
    enforce: "pre",
    resolveId(id) {
      if (id === "react") return REACT_ID;
      if (id === "react-dom") return REACT_DOM_ID;
      if (id === "react-dom/client") return REACT_DOM_CLIENT_ID;
      if (id === "react/jsx-runtime") return JSX_RUNTIME_ID;
      if (id === "react/jsx-dev-runtime") return JSX_DEV_RUNTIME_ID;
      if (id === "use-sync-external-store/shim") return USSE_SHIM_ID;
    },
    load(id) {
      if (id === REACT_ID) {
        const cjsCode = fs.readFileSync(
          path.join(rDir, "cjs/react.production.js"),
          "utf-8",
        );
        return `
var _r = {};
(function(exports) {
${cjsCode}
})(_r);
export const {
  Activity, Children, Component, Fragment, Profiler, PureComponent,
  StrictMode, Suspense,
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
  __COMPILER_RUNTIME,
  cache, cacheSignal, cloneElement, createContext, createElement, createRef,
  forwardRef, isValidElement, lazy, memo, startTransition,
  unstable_useCacheRefresh, use, useActionState, useCallback, useContext,
  useDebugValue, useDeferredValue, useEffect, useEffectEvent, useId,
  useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo,
  useOptimistic, useReducer, useRef, useState, useSyncExternalStore,
  useTransition, version,
} = _r;
export default _r;
`;
      }
      if (id === REACT_DOM_ID) {
        const cjsCode = fs.readFileSync(
          path.join(rdDir, "cjs/react-dom.production.js"),
          "utf-8",
        );
        return `
import _react from "react";
var _rd = {};
(function(exports, require) {
${cjsCode}
})(_rd, function(id) {
  if (id === "react") return _react;
  throw new Error("[react-dom-build-shim] Unknown module: " + id);
});
export const {
  __DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
  createPortal, flushSync, preconnect, prefetchDNS, preinit, preinitModule,
  preload, preloadModule, requestFormReset, unstable_batchedUpdates,
  useFormState, useFormStatus, version,
} = _rd;
export default _rd;
`;
      }
      if (id === REACT_DOM_CLIENT_ID) {
        const schedCode = fs.readFileSync(
          path.join(schedDir, "cjs/scheduler.production.js"),
          "utf-8",
        );
        const cjsCode = fs.readFileSync(
          path.join(rdDir, "cjs/react-dom-client.production.js"),
          "utf-8",
        );
        return `
import _react from "react";
import _rd from "react-dom";
var _sched = {};
(function(exports) {
${schedCode}
})(_sched);
var _rdc = {};
(function(exports, require) {
${cjsCode}
})(_rdc, function(id) {
  if (id === "react") return _react;
  if (id === "react-dom") return _rd;
  if (id === "scheduler") return _sched;
  throw new Error("[react-dom-client-build-shim] Unknown module: " + id);
});
export const { createRoot, hydrateRoot } = _rdc;
export default _rdc;
`;
      }
      if (id === JSX_RUNTIME_ID) {
        const cjsCode = fs.readFileSync(
          path.join(rDir, "cjs/react-jsx-runtime.production.js"),
          "utf-8",
        );
        return `
import _react from "react";
var _jsx = {};
(function(exports, require) {
${cjsCode}
})(_jsx, function(id) {
  if (id === "react") return _react;
  throw new Error("[react-jsx-runtime-build-shim] Unknown module: " + id);
});
export const { Fragment, jsx, jsxs } = _jsx;
export default _jsx;
`;
      }
      if (id === JSX_DEV_RUNTIME_ID) {
        const cjsCode = fs.readFileSync(
          path.join(rDir, "cjs/react-jsx-dev-runtime.production.js"),
          "utf-8",
        );
        return `
import _react from "react";
var _jsxd = {};
(function(exports, require) {
${cjsCode}
})(_jsxd, function(id) {
  if (id === "react") return _react;
  throw new Error("[react-jsx-dev-runtime-build-shim] Unknown module: " + id);
});
export const { Fragment, jsxDEV } = _jsxd;
export default _jsxd;
`;
      }
      if (id === USSE_SHIM_ID) {
        const cjsCode = fs.readFileSync(
          path.join(usseDir, "cjs/use-sync-external-store-shim.production.js"),
          "utf-8",
        );
        return `
import _react from "react";
var _usse = {};
(function(exports, require) {
${cjsCode}
})(_usse, function(id) {
  if (id === "react") return _react;
  throw new Error("[use-sync-external-store-shim-build] Unknown module: " + id);
});
export const { useSyncExternalStore } = _usse;
export default _usse;
`;
      }
    },
  };
}

interface CjsInteropEntry {
  /** Bare specifiers this entry should intercept (e.g. "util", "node:util"). */
  specifiers: string[];
  /** Absolute directory node-stdlib-browser/node_modules resolved this package to. */
  pkgDir: string;
  /** Path to the actual CJS entry file, relative to `pkgDir`. */
  entryFile: string;
  /** Import specifiers esbuild should leave unbundled (see esbuild's `external`). */
  external?: string[];
  /**
   * When `external` is set, esbuild can no longer prove there are no
   * externally-caused side effects, so it stops synthesizing named ES exports
   * and only emits `export default <cjsModuleExports>` instead. List the
   * module's known `exports.foo = ...` names here to re-destructure them off
   * that default export (same trick as this file's React CJS shim).
   */
  namedExports?: string[];
  /**
   * Import specifiers esbuild should resolve to another path instead of its
   * normal node_modules lookup (see esbuild's `alias`). Used to hand esbuild
   * the real polyfill path for bare Node builtin specifiers (e.g. "stream")
   * that its `platform: "browser"` resolver otherwise refuses to resolve, so
   * the whole dependency tree can be inlined as one clean ESM unit instead of
   * leaving more broken CJS files for Rollup to mishandle individually.
   */
  alias?: Record<string, string>;
}

/**
 * Production-only shim for CJS packages that @rollup/plugin-commonjs only
 * partially transforms.
 *
 * Several unrelated CJS modules reachable from this app (the `util` Node
 * polyfill pulled in by node-stdlib-browser's `vm`/`stream` aliases, the
 * `assert` polyfill, and @midnight-ntwrk/midnight-js-utils's CJS build)
 * exhibit the same failure: some internal helper submodule gets wrapped in an
 * IIFE correctly, but the entry file's top-level `exports.foo = ...` /
 * `module.exports = ...` assignments are left as bare, unbound references —
 * this throws "Uncaught ReferenceError: exports is not defined" in the
 * browser, since ES modules (unlike Node's CJS loader) have no implicit
 * `exports`/`module` binding. Bundling each one with esbuild directly
 * sidesteps the bug: esbuild's CJS→ESM interop handles these module shapes
 * correctly where Rollup's does not.
 */
function cjsInteropBuildShimPlugin(entries: CjsInteropEntry[]): Plugin {
  const resolved = entries.map((e, i) => ({
    ...e,
    virtualId: `\0virtual:cjs-interop-build-${i}`,
    entryPath: path.join(e.pkgDir, e.entryFile),
  }));
  const cache = new Map<string, string>();

  return {
    name: "cjs-interop-build-shim",
    apply: "build",
    enforce: "pre",
    resolveId(id) {
      for (const e of resolved) {
        // node-stdlib-browser's `resolve.alias` entries (and Vite's own
        // package resolution) are resolved before this hook runs, so by the
        // time we see it a bare specifier may already be the resolved
        // absolute package directory (with or without a trailing slash), or
        // the resolved entry file itself.
        if (
          e.specifiers.includes(id) ||
          id === e.pkgDir ||
          id === `${e.pkgDir}/` ||
          id === e.entryPath
        ) {
          return e.virtualId;
        }
      }
    },
    async load(id) {
      const e = resolved.find((r) => r.virtualId === id);
      if (!e) return;
      const cached = cache.get(e.virtualId);
      if (cached) return cached;
      const viteRequire = createRequire(_require.resolve("vite/package.json"));
      const esbuild = await import(viteRequire.resolve("esbuild"));
      const result = await esbuild.build({
        entryPoints: [e.entryPath],
        bundle: true,
        format: "esm",
        platform: "browser",
        write: false,
        target: "es2020",
        external: e.external,
        alias: e.alias,
        define: {
          "process.env.NODE_ENV": '"production"',
          "process.browser": "true",
          "process.version": '"v22.0.0"',
          process: JSON.stringify({ env: { NODE_ENV: "production" }, browser: true, version: "v22.0.0", nextTick: undefined }),
        },
      });
      let code = result.outputFiles[0].text;
      if (e.namedExports) {
        // Match the LAST "export default <expr>;" (there can be trailing
        // license-comment banners after it, so don't anchor to end-of-file).
        const matches = [...code.matchAll(/export default ([^;]+);/g)];
        const lastMatch = matches.at(-1);
        if (!lastMatch) {
          throw new Error(
            `[cjs-interop-build-shim] expected an "export default <expr>;" to rewrite for ${e.entryPath}`,
          );
        }
        const before = code.slice(0, lastMatch.index);
        const after = code.slice(lastMatch.index + lastMatch[0].length);
        code = `${before}const __shimExports = ${lastMatch[1]};
export default __shimExports;
export const { ${e.namedExports.join(", ")} } = __shimExports;
${after}`;
      }
      cache.set(e.virtualId, code);
      return code;
    },
  };
}

export default defineConfig({
  plugins: [
    midnightJsUtilsShimPlugin(),
    reactBuildShimPlugin(),
    cjsInteropBuildShimPlugin([
      {
        specifiers: ["util", "node:util"],
        pkgDir: utilPkgDir,
        entryFile: "util.js",
      },
      {
        specifiers: ["assert", "node:assert"],
        pkgDir: assertPkgDir,
        entryFile: "build/assert.js",
      },
      {
        specifiers: ["crypto", "node:crypto"],
        pkgDir: cryptoPkgDir,
        entryFile: "index.js",
        // Node's `crypto` (randomBytes/pbkdf2Sync/createCipheriv/createDecipheriv/
        // createHash) genuinely IS used at runtime, to encrypt the private-state
        // (move/salt) LevelDB store — see @midnight-ntwrk/midnight-js-level-private-state-provider.
        // crypto-browserify's legacy dependency tree references bare Node builtins
        // (stream, vm, util, ...) that esbuild can't resolve standalone; alias
        // them to the same polyfills node-stdlib-browser resolves elsewhere so
        // esbuild can inline the whole tree as one clean ESM unit.
        alias: nodeBuiltinAliasesForEsbuild,
        namedExports: [
          "randomBytes",
          "rng",
          "pseudoRandomBytes",
          "prng",
          "createHash",
          "Hash",
          "createHmac",
          "Hmac",
          "getHashes",
          "pbkdf2",
          "pbkdf2Sync",
          "Cipher",
          "createCipher",
          "Cipheriv",
          "createCipheriv",
          "Decipher",
          "createDecipher",
          "Decipheriv",
          "createDecipheriv",
          "getCiphers",
          "listCiphers",
          "DiffieHellmanGroup",
          "createDiffieHellmanGroup",
          "getDiffieHellman",
          "createDiffieHellman",
          "DiffieHellman",
          "createSign",
          "Sign",
          "createVerify",
          "Verify",
          "createECDH",
          "publicEncrypt",
          "privateEncrypt",
          "publicDecrypt",
          "privateDecrypt",
          "randomFill",
          "randomFillSync",
          "createCredentials",
          "constants",
          // Not implemented by crypto-browserify at all; the consumer feature-
          // detects it (`typeof crypto.timingSafeEqual === 'function'`) and
          // falls back to a manual comparison, so `undefined` here is correct.
          "timingSafeEqual",
        ],
      },
      {
        specifiers: ["path", "node:path"],
        pkgDir: pathPkgDir,
        entryFile: "index.js",
      },
      {
        specifiers: ["semver"],
        pkgDir: path.dirname(semverEntry),
        entryFile: path.basename(semverEntry),
      },
    ]),
    onchainRuntimeV3ShimPlugin(onchainRuntimeBrowserPath),
    react(),
    tailwindcss(),
    wasm(),
    inject({ process: "process/browser", Buffer: ["buffer", "Buffer"] }),
  ],
  server: {
    // Proxy proof-server requests through the dev server so the browser never
    // fetches http://127.0.0.1:6300 directly.  Lace's service worker intercepts
    // all fetch calls from the page; requests to 127.0.0.1 from a service worker
    // context are blocked by Chrome (ERR_FAILED).  Routing via a same-origin path
    // (/proof-server/...) lets the service worker pass through the request to
    // Vite's Node.js process, which then proxies it server-side—bypassing all
    // browser security restrictions on localhost access.
    proxy: {
      "/proof-server": {
        target: "http://127.0.0.1:6300",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proof-server/, ""),
      },
    },
  },
  resolve: {
    // Force all packages to resolve a single copy of React so hooks from
    // react-i18next and app code share the same dispatcher.
    dedupe: ["react", "react-dom"],
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      // Ensure compact-runtime always resolves from app's node_modules regardless
      // of which workspace package (contract/counter or contract/rps) imports it.
      // Without this, Rollup can't find compact-runtime when resolving from
      // pkgs/contract/dist/managed/*/contract/index.js in production builds.
      {
        find: "@midnight-ntwrk/compact-runtime",
        replacement: path.dirname(_crPkgPath),
      },
      // Node.js stdlib browser polyfills, including `vm`/`stream`/`crypto`.
      // Nothing in this app's own source imports `vm`/`stream`/`crypto`
      // directly, but crypto-browserify's legacy CJS dependency tree (hash-base,
      // cipher-base, ...) does `require("stream").Transform` and
      // `Transform.call(this)` in its constructors, and `crypto` itself is
      // needed by @midnight-ntwrk/midnight-js-level-private-state-provider to
      // encrypt the private-state LevelDB store. Without these three aliased,
      // the dev server's esbuild-based dep optimizer resolves them to Vite's
      // default "browser-external" stub (a Proxy that warns and returns
      // undefined for every property access), which breaks at runtime the
      // moment createHash/Transform/etc. is actually called (dev only —
      // nothing else in the app reaches these three polyfills' code paths).
      // In production, cjsInteropBuildShimPlugin below still intercepts
      // `crypto` before this alias applies (it runs `enforce: "pre"`), using
      // its own independent `stream`/`vm` aliasing scoped to that one esbuild
      // call — so `crypto`'s subtree never reaches Rollup's commonjs plugin
      // (the thing that actually mishandles it) regardless of what's aliased
      // here. This `stream`/`vm` alias is therefore inert in production: it's
      // never resolved because nothing importing them ever reaches Rollup.
      ...Object.entries(stdLibBrowser).map(([find, replacement]) => ({
        find,
        replacement: replacement as string,
      })),
    ],
  },
  optimizeDeps: {
    // Exclude packages that esbuild cannot handle:
    // - onchain-runtime-v3: ESM with top-level await for WASM initialization
    // - onchain-runtime: legacy name (kept for safety)
    // compact-runtime@0.15.0 IS pre-bundled by esbuild. Its import of
    // onchain-runtime-v3 is marked external (excluded above), so esbuild
    // doesn't try to process TLA. The shim plugin handles the import at
    // request time, serving the browser WASM entry as native ESM.
    exclude: [
      "@midnight-ntwrk/onchain-runtime",
      "@midnight-ntwrk/onchain-runtime-v3",
    ],
    // Pre-bundle the contract workspace package so esbuild can transform the
    // compiled Compact contract (managed/counter/contract/index.cjs) from CJS
    // to ESM. Without this, Vite serves index.cjs raw and `require()` fails in
    // the browser. compact-runtime is excluded above so esbuild marks it as an
    // external import — handled by our virtual shim plugin at runtime.
    include: [
      "contract",
      "@midnight-ntwrk/wallet-sdk-address-format",
      // Explicitly pre-bundle React and react-dom/client so esbuild can split
      // them into the shared chunk (chunk-OJL3457Z.js). needsInterop:true on
      // all of these tells Vite to generate named-export proxy modules.
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  define: {
    // randombytes/browser.js and other Node.js polyfills use `global`
    // which is not defined in the browser. Replace with globalThis.
    global: "globalThis",
  },
  build: {
    target: "esnext",
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/node_modules/],
      strictRequires: true,
    },
  },
  worker: {
    format: "es",
    plugins: () => [wasm()],
  },
});
