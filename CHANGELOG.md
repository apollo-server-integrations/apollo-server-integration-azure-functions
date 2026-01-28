# @as-integrations/azure-functions

## 0.3.0

### Major Changes

- **BREAKING:** Dropped support for @azure/functions v3. This package now requires @azure/functions v4.

  The v3 programming model is no longer supported. Users must migrate to Azure Functions v4 programming model.

### Minor Changes

- Updated minimum Node.js version from v18 to v22
- Improved package bundle size with better tree-shaking support
  - Added `sideEffects: false` flag
  - Added `exports` field for better ESM/CJS compatibility
  - Added `files` field to limit published content
- Enhanced package.json with keywords for better discoverability
- Updated TypeScript compilation target from ES2019 to ES2022
- Updated dependencies to latest versions

### Improvements

- **Moved samples to root level** (`src/samples/` → `/samples/`) for better discoverability and clearer project structure
- Enhanced sample implementations with more detailed examples
- Fixed `start:host` script path to use new samples location
- Removed obsolete npm 8.5 installation script

## 0.1.2

### Patch Changes

- [#35](https://github.com/apollo-server-integrations/apollo-server-integration-azure-functions/pull/35) [`a682f85`](https://github.com/apollo-server-integrations/apollo-server-integration-azure-functions/commit/a682f852ee2eed465cf800a4be0475a34a646164) Thanks [@abartolotdf](https://github.com/abartolotdf)! - Fix a regression w.r.t body parsing introduced in https://github.com/apollo-server-integrations/apollo-server-integration-azure-functions/pull/28.

  Bodies which are already parsed object should just be returned outright rather than treated as invalid.

  This issue manifests for users as an invalid POST request from Apollo Server.
