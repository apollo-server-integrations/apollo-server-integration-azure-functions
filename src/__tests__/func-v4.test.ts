import { ApolloServer, ApolloServerOptions, BaseContext } from '@apollo/server';
import {
  CreateServerForIntegrationTestsOptions,
  defineIntegrationTestSuite,
} from '@apollo/server-integration-testsuite';
import { createServer } from 'http';
import { v4 } from '..';
import { createMockServer, urlForHttpServer } from './mockServer-v4';

describe('Azure Functions v4', () => {
  defineIntegrationTestSuite(
    async function (
      serverOptions: ApolloServerOptions<BaseContext>,
      testOptions?: CreateServerForIntegrationTestsOptions,
    ) {
      const httpServer = createServer();
      const server = new ApolloServer({
        ...serverOptions,
      });

      const handler = testOptions
        ? v4.startServerAndCreateHandler(server, testOptions)
        : v4.startServerAndCreateHandler(server);

      await new Promise<void>((resolve) => {
        httpServer.listen({ port: 0 }, resolve);
      });

      httpServer.addListener('request', createMockServer(handler));

      return {
        server,
        url: urlForHttpServer(httpServer),
        async extraCleanup() {
          await new Promise<void>((resolve) => {
            httpServer.close(() => resolve());
          });
        },
      };
    },
    {
      serverIsStartedInBackground: true,
      noIncrementalDelivery: true,
    },
  );
});
