import { ApolloServer, ApolloServerOptions, BaseContext } from '@apollo/server';
import {
  CreateServerForIntegrationTestsOptions,
  defineIntegrationTestSuite,
} from '@apollo/server-integration-testsuite';
import { createServer } from 'http';
import { startServerAndCreateHandler } from '..';
import { createMockServer, urlForHttpServer } from './mockServer';

describe('Azure Functions', () => {
  defineIntegrationTestSuite(
    async function (
      serverOptions: ApolloServerOptions<BaseContext>,
      testOptions?: CreateServerForIntegrationTestsOptions,
    ) {
      const httpServer = createServer();
      const server = new ApolloServer(serverOptions);

      const handler = testOptions
        ? startServerAndCreateHandler(server, testOptions)
        : startServerAndCreateHandler(server);

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
    { serverIsStartedInBackground: true, noIncrementalDelivery: false },
  );
});
