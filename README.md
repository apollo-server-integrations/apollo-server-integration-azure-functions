# Apollo Server Integration for Azure Functions

## **Introduction**

**An Apollo Server integration for use with Azure Functions.**

This is a simple package allows you to integrate Apollo Server into an Azure Functions app.

## **Requirements**

- **[Node.js v16](https://nodejs.org/)** or later
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

4. Update the `function.json` HTTP output binding to use `$return` as the name, as the integration returns from the Function Handler:

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
