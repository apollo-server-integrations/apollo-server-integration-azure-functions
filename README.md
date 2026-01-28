# Apollo Server Integration for Azure Functions

![Build](https://img.shields.io/github/actions/workflow/status/apollo-server-integrations/apollo-server-integration-azure-functions/ci.yaml) ![Release](https://img.shields.io/github/actions/workflow/status/apollo-server-integrations/apollo-server-integration-azure-functions/release-pr.yaml) ![npm (scoped)](https://img.shields.io/npm/v/@as-integrations/azure-functions)

## **Introduction**

**An Apollo Server integration for use with Azure Functions.**

This is a simple package allows you to integrate Apollo Server into an Azure Functions app.

## **Requirements**

- **[Node.js v22](https://nodejs.org/)** or later
- **[Azure Functions v4](https://learn.microsoft.com/azure/azure-functions/functions-overview)** or later
- **[GraphQL.js v16](https://graphql.org/graphql-js/)** or later
- **[Apollo Server v4](https://www.apollographql.com/docs/apollo-server/)** or later

## **Installation**

```bash
npm install @as-integrations/azure-functions @apollo/server graphql @azure/functions
```

## **Usage**

1. Setup an [Azure Function with TypeScript](https://learn.microsoft.com/azure/azure-functions/create-first-function-vs-code-typescript) (or [JavaScript](https://learn.microsoft.com/azure/azure-functions/create-first-function-vs-code-node)) as per normal.
2. Create a new [HTTP Trigger](https://learn.microsoft.com/azure/azure-functions/functions-bindings-http-webhook-trigger?tabs=in-process%2Cfunctionsv2&pivots=programming-language-javascript)
3. Update the `index.ts` to use the Apollo integration:

**v3**

```ts
import { ApolloServer } from '@apollo/server';
import { startServerAndCreateHandler } from '@as-integrations/azure-functions';

// The GraphQL schema
const typeDefs = `#graphql
  type Query {
    hello: String
  }
`;

// A map of functions which return data for the schema.
const resolvers = {
  Query: {
    hello: () => 'world',
  },
};

// Set up Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

export default startServerAndCreateHandler(server);
```

**v4**

```ts
import { ApolloServer } from '@apollo/server';
import { v4 } from '@as-integrations/azure-functions';

// The GraphQL schema
const typeDefs = `#graphql
  type Query {
    hello: String
  }
`;

// A map of functions which return data for the schema.
const resolvers = {
  Query: {
    hello: () => 'world',
  },
};

// Set up Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

app.http('graphql', {
  handler: v4.startServerAndCreateHandler(server),
});
```

4. Update the `function.json` HTTP output binding to use `$return` as the name, as the integration returns from the Function Handler **(v3 only)**:

```json
{
  "type": "http",
  "direction": "out",
  "name": "$return"
}
```

5. Run the Azure Functions app and navigate to the function endpoint

# Contributors

- Aaron Powell ([aaronpowell](https://github.com/aaronpowell))
- Charles Fonseca ([barddoo](https://github.com/barddoo))
