# @as-integrations/azure-functions

## 0.1.2

### Patch Changes

- [#35](https://github.com/apollo-server-integrations/apollo-server-integration-azure-functions/pull/35) [`a682f85`](https://github.com/apollo-server-integrations/apollo-server-integration-azure-functions/commit/a682f852ee2eed465cf800a4be0475a34a646164) Thanks [@abartolotdf](https://github.com/abartolotdf)! - Fix a regression w.r.t body parsing introduced in https://github.com/apollo-server-integrations/apollo-server-integration-azure-functions/pull/28.

  Bodies which are already parsed object should just be returned outright rather than treated as invalid.

  This issue manifests for users as an invalid POST request from Apollo Server.
