import {ApolloServer, ApolloServerOptions, BaseContext} from '@apollo/server';
import {startServerAndCreateHandler} from '..';
import {
    CreateServerForIntegrationTestsOptions,
    defineIntegrationTestSuite,
} from '@apollo/server-integration-testsuite';
import {createServer} from 'http';
import type {AzureFunction} from '@azure/functions';
import {createMockServer, urlForHttpServer} from './mockServer';

describe('Azure Functions', () => {
    defineIntegrationTestSuite(
        async function (
            serverOptions: ApolloServerOptions<BaseContext>,
            testOptions?: CreateServerForIntegrationTestsOptions,
        ) {
            const httpServer = createServer();
            const server = new ApolloServer({
                ...serverOptions,
            });

            const handler: AzureFunction = testOptions
                ? startServerAndCreateHandler(server, testOptions)
                : startServerAndCreateHandler(server);

            await new Promise<void>((resolve) => {
                httpServer.listen({port: 0}, resolve);
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

    describe('parseBody', () => {

        test('can parse application/json', () => {});
        test('can parse application/json; charset=utf-8', () => {});
        test('can parse application/graphql-response+json;charset=utf-8', () => {});
    });
});
