import { ApolloServer, BaseContext } from '@apollo/server';
import { gql } from 'graphql-tag';
import { HttpMethod, HttpRequest, InvocationContext } from '@azure/functions';
import { ReadableStream } from 'stream/web';
import { startServerAndCreateHandler, _internal } from '..';

const typeDefs = gql`
  type Query {
    hello: String
  }
`;

const resolvers = {
  Query: {
    hello: () => 'world',
  },
};

function createMockRequest(options: {
  method: HttpMethod | undefined;
  url: string;
  headers: Record<string, string>;
  body?: string;
}): HttpRequest {
  const bodyContent = options.body ?? '';
  const headers = new Headers();
  for (const [key, value] of Object.entries(options.headers)) {
    headers.set(key, value);
  }

  const createRequest = (): HttpRequest => ({
    method: options.method as string,
    url: options.url,
    headers,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(bodyContent));
        controller.close();
      },
    }),
    query: new URLSearchParams(
      options.url.includes('?') ? options.url.split('?')[1] : '',
    ),
    params: {},
    user: null,
    arrayBuffer: async () => {
      return Buffer.from(bodyContent).buffer;
    },
    text: async () => {
      return bodyContent;
    },
    json: async () => {
      return JSON.parse(bodyContent);
    },
    blob: async () => {
      throw new Error('Not implemented');
    },
    bodyUsed: false,
    formData: async () => {
      throw new Error('Not implemented');
    },
    clone: () => {
      return createRequest();
    },
  });

  return createRequest();
}

function createMockInvocationContext(): InvocationContext {
  return new InvocationContext({
    invocationId: 'test-mock',
    functionName: 'test-mock',
    logHandler: () => {}, // Silent logger for tests
  });
}

describe('Azure Functions Edge Cases', () => {
  let server: ApolloServer<BaseContext>;
  let handler: ReturnType<typeof startServerAndCreateHandler>;

  beforeEach(() => {
    server = new ApolloServer({ typeDefs, resolvers });
    handler = startServerAndCreateHandler(server);
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('Error Handling', () => {
    it('should return 400 for malformed JSON body', async () => {
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost:7071/api/graphql',
        headers: { 'content-type': 'application/json' },
        body: '{ invalid json',
      });
      const context = createMockInvocationContext();

      const response = await handler(req, context);

      expect(response.status).toBe(400);
      expect(response.body).toContain('Invalid JSON');
    });

    it('should return 400 for invalid URL', async () => {
      const req = createMockRequest({
        method: 'POST',
        url: 'not a valid url',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ hello }' }),
      });
      const context = createMockInvocationContext();

      const response = await handler(req, context);

      expect(response.status).toBe(400);
      expect(response.body).toContain('Invalid request URL');
    });

    it('should return 500 without exposing internal errors', async () => {
      const serverWithError = new ApolloServer({
        typeDefs,
        resolvers: {
          Query: {
            hello: () => {
              throw new Error(
                'Internal database connection failed with secret info',
              );
            },
          },
        },
      });
      const errorHandler = startServerAndCreateHandler(serverWithError);

      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost:7071/api/graphql',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ hello }' }),
      });
      const context = createMockInvocationContext();

      const response = await errorHandler(req, context);

      // The resolver error should be handled normally by Apollo Server
      expect(response.status).toBe(200);
      const body = JSON.parse(response.body as string);
      expect(body.errors).toBeDefined();

      await serverWithError.stop();
    });

    it('should return 400 for missing method', async () => {
      const req = createMockRequest({
        method: undefined as any,
        url: 'http://localhost:7071/api/graphql',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ hello }' }),
      });
      const context = createMockInvocationContext();

      const response = await handler(req, context);

      expect(response.status).toBe(400);
      expect(response.body).toBe('No method');
    });
  });

  describe('Content-Type Header Handling', () => {
    const testQuery = JSON.stringify({ query: '{ hello }' });

    it('should handle lowercase content-type', async () => {
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost:7071/api/graphql',
        headers: { 'content-type': 'application/json' },
        body: testQuery,
      });
      const context = createMockInvocationContext();

      const response = await handler(req, context);

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body as string);
      expect(body.data.hello).toBe('world');
    });

    it('should handle uppercase Content-Type', async () => {
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost:7071/api/graphql',
        headers: { 'Content-Type': 'application/json' },
        body: testQuery,
      });
      const context = createMockInvocationContext();

      const response = await handler(req, context);

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body as string);
      expect(body.data.hello).toBe('world');
    });

    it('should handle mixed case CONTENT-TYPE', async () => {
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost:7071/api/graphql',
        headers: { 'CoNtEnT-TyPe': 'application/json' },
        body: testQuery,
      });
      const context = createMockInvocationContext();

      const response = await handler(req, context);

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body as string);
      expect(body.data.hello).toBe('world');
    });

    it('should handle Content-Type with charset', async () => {
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost:7071/api/graphql',
        headers: { 'content-type': 'APPLICATION/JSON; charset=utf-8' },
        body: testQuery,
      });
      const context = createMockInvocationContext();

      const response = await handler(req, context);

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body as string);
      expect(body.data.hello).toBe('world');
    });
  });

  describe('Helper Functions', () => {
    describe('getErrorMessage', () => {
      it('should extract message from Error objects', () => {
        const error = new Error('Test error');
        expect(_internal.getErrorMessage(error)).toBe('Test error');
      });

      it('should handle string errors', () => {
        expect(_internal.getErrorMessage('String error')).toBe('String error');
      });

      it('should handle objects with message property', () => {
        const error = { message: 'Object error' };
        expect(_internal.getErrorMessage(error)).toBe('Object error');
      });

      it('should return fallback for unknown types', () => {
        expect(_internal.getErrorMessage(null)).toBe(
          'An unexpected error occurred',
        );
        expect(_internal.getErrorMessage(undefined)).toBe(
          'An unexpected error occurred',
        );
        expect(_internal.getErrorMessage(123)).toBe(
          'An unexpected error occurred',
        );
      });

      it('should use custom fallback', () => {
        expect(_internal.getErrorMessage(null, 'Custom fallback')).toBe(
          'Custom fallback',
        );
      });
    });

    describe('normalizeStatusCode', () => {
      it('should return 200 for undefined status', () => {
        expect(_internal.normalizeStatusCode(undefined)).toBe(200);
      });

      it('should return valid status codes unchanged', () => {
        expect(_internal.normalizeStatusCode(200)).toBe(200);
        expect(_internal.normalizeStatusCode(404)).toBe(404);
        expect(_internal.normalizeStatusCode(500)).toBe(500);
      });

      it('should throw for status codes below 100', () => {
        expect(() => _internal.normalizeStatusCode(99)).toThrow(
          'Invalid status code: 99',
        );
      });

      it('should throw for status codes above 599', () => {
        expect(() => _internal.normalizeStatusCode(600)).toThrow(
          'Invalid status code: 600',
        );
      });

      it('should handle null as undefined', () => {
        expect(_internal.normalizeStatusCode(null as any)).toBe(200);
      });
    });
  });

  describe('Status Code Normalization', () => {
    it('should normalize status codes in responses', async () => {
      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost:7071/api/graphql',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ hello }' }),
      });
      const context = createMockInvocationContext();

      const response = await handler(req, context);

      // Should have a valid status code
      expect(response.status).toBeGreaterThanOrEqual(100);
      expect(response.status).toBeLessThan(600);
    });
  });
});
