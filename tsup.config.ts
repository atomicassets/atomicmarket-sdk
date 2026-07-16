import { defineConfig } from 'tsup';

// Single-file dual output, mirroring the atomicassets-sdk build. esbuild bundles
// every internal import into each bundle, so the ESM output loads under raw Node
// ESM, bundlers, and (via the CJS twin) CommonJS, with no separate runtime files.
export default defineConfig([
    {
        entry: { index: 'src/index.ts' },
        outDir: 'build',
        format: ['cjs', 'esm'],
        target: 'es2020',
        platform: 'node',
        dts: true,
        sourcemap: true,
        clean: true,
        outExtension({ format }) {
            return { js: format === 'cjs' ? '.cjs' : '.mjs' };
        }
    },
    {
        entry: { atomicmarket: 'src/index.ts' },
        outDir: 'build',
        format: ['iife'],
        globalName: 'atomicmarket',
        target: 'es2020',
        platform: 'browser',
        dts: false,
        sourcemap: false,
        outExtension() {
            return { js: '.global.js' };
        }
    }
]);
