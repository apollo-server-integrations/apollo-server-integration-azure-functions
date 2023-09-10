import { build } from 'esbuild-azure-functions';
import { nodeExternalsPlugin } from 'esbuild-node-externals';

await build({
  project: '.',
  entryPoints: ['src/sample/graphql/index.ts'],
  esbuildOptions: {
    format: 'esm',
    plugins: [nodeExternalsPlugin()],
  },
});
