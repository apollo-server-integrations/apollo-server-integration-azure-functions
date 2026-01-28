# Apollo Server Integration for Azure Functions

[![Build](https://img.shields.io/github/actions/workflow/status/apollo-server-integrations/apollo-server-integration-azure-functions/ci.yaml)](https://github.com/apollo-server-integrations/apollo-server-integration-azure-functions/actions) [![Release](https://img.shields.io/github/actions/workflow/status/apollo-server-integrations/apollo-server-integration-azure-functions/release-pr.yaml)](https://github.com/apollo-server-integrations/apollo-server-integration-azure-functions/actions) [![npm (scoped)](https://img.shields.io/npm/v/@as-integrations/azure-functions)](https://www.npmjs.com/package/@as-integrations/azure-functions)

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

### **Basic Setup**

1. Setup an [Azure Function with TypeScript](https://learn.microsoft.com/azure/azure-functions/create-first-function-vs-code-typescript) (or [JavaScript](https://learn.microsoft.com/azure/azure-functions/create-first-function-vs-code-node)) using the v4 programming model
2. Create a new [HTTP Trigger](https://learn.microsoft.com/azure/azure-functions/functions-bindings-http-webhook-trigger?tabs=in-process%2Cfunctionsv2&pivots=programming-language-javascript)
3. Update your function file (e.g., `src/functions/graphql.ts`) to use the Apollo integration:

```ts
import { ApolloServer } from '@apollo/server';
import { app } from '@azure/functions';
import { startServerAndCreateHandler } from '@as-integrations/azure-functions';

// The GraphQL schema
const typeDefs = `#graphql
  type Query {
    hello: String
  }
`;

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
  handler: startServerAndCreateHandler(server),
});
```

4. Run the Azure Functions app and navigate to the function endpoint (e.g., `http://localhost:7071/api/graphql`)

### **Using Context**

You can pass custom context to your resolvers:

```ts
import { ApolloServer } from '@apollo/server';
import { app, HttpRequest, InvocationContext } from '@azure/functions';
import { startServerAndCreateHandler } from '@as-integrations/azure-functions';

// Define the context type
type MyContext = {
  user: string | null;
  isAuthenticated: boolean;
};

// Context creation function
async function createContext(
  req: HttpRequest,
  _context: InvocationContext,
  _body: any,
): Promise<MyContext> {
  const authHeader = req.headers.get('authorization');

  return {
    user: authHeader ? authHeader : null,
    isAuthenticated: authHeader !== null,
  };
}

const server = new ApolloServer<MyContext>({
  typeDefs,
  resolvers,
});

app.http('graphql', {
  handler: startServerAndCreateHandler(server, {
    context: async (args) => createContext(args.req, args.context, args.body),
  }),
});
```

## **Deployment**

To deploy your GraphQL API to Azure:

1. **Using VS Code:**
   - Install the [Azure Functions extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions)
   - Right-click your function app in the Azure Functions panel and select "Deploy to Function App"

2. **Using Azure CLI:**
   ```bash
   # Build your app
   npm run build

   # Deploy to Azure
   func azure functionapp publish <YOUR_FUNCTION_APP_NAME>
   ```

3. **Using CI/CD:**
   - Configure [GitHub Actions](https://learn.microsoft.com/azure/azure-functions/functions-how-to-github-actions) or [Azure DevOps](https://learn.microsoft.com/azure/azure-functions/functions-how-to-azure-devops) for automated deployments

For more details, see the [Azure Functions deployment documentation](https://learn.microsoft.com/azure/azure-functions/functions-deployment-technologies).

## **Examples**

Several working examples are available in the [samples](./samples) folder, including:

- Simple GraphQL setup
- GraphQL with context
- GraphQL with error handling

## **Contributing**

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## **Support**

- [Documentation](https://www.apollographql.com/docs/apollo-server/)
- [GitHub Issues](https://github.com/apollo-server-integrations/apollo-server-integration-azure-functions/issues)
- [Azure Functions Documentation](https://learn.microsoft.com/azure/azure-functions/)

## **Contributors**

- Aaron Powell ([aaronpowell](https://github.com/aaronpowell))
- Charles Fonseca ([barddoo](https://github.com/barddoo))
