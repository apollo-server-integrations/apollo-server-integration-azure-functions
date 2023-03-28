---
'@as-integrations/azure-functions': patch
---

Fix a regression w.r.t body parsing introduced in https://github.com/apollo-server-integrations/apollo-server-integration-azure-functions/pull/28.

Bodies which are already parsed object should just be returned outright rather than treated as invalid.

This issue manifests for users as an invalid POST request from Apollo Server.
