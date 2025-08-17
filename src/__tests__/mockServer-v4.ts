import {
  HttpHandler,
  InvocationContext,
  type HttpMethod,
  type HttpRequest,
} from '@azure/functions-v4';
import type { IncomingMessage, Server, ServerResponse } from 'http';
import type { AddressInfo } from 'net';
import { ReadableStream } from 'stream/web';

export function urlForHttpServer(httpServer: Server): string {
  const { address, port } = httpServer.address() as AddressInfo;

  // Convert IPs which mean "any address" (IPv4 or IPv6) into localhost
  // corresponding loopback ip. Note that the url field we're setting is
  // primarily for consumption by our test suite. If this heuristic is wrong for
  // your use case, explicitly specify a frontend host (in the `host` option
  // when listening).
  const hostname = address === '' || address === '::' ? 'localhost' : address;

  return `http://${hostname}:${port}`;
}

export const createMockServer = (handler: HttpHandler) => {
  return (req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));

    req.on('end', async () => {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        headers.set(key, value as string);
      }

      const azReq: HttpRequest = {
        method: (req.method as HttpMethod) || null,
        url: new URL(req.url || '', 'http://localhost').toString(),
        headers,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(body));
            controller.close();
          },
        }),
        query: new URLSearchParams(req.url),
        params: {},
        user: null,
        arrayBuffer: async () => {
          return Buffer.from(body).buffer;
        },
        text: async () => {
          return body;
        },
        json: async () => {
          return JSON.parse(body);
        },
        blob: async () => {
          throw new Error('Not implemented');
        },
        bodyUsed: false,
        formData: async () => {
          throw new Error('Not implemented');
        },
        clone: () => {
          throw new Error('Not implemented');
        },
      };

      const context = new InvocationContext({
        invocationId: 'mock',
        functionName: 'mock',
        logHandler: console.log,
      });

      const azRes = await handler(azReq, context);

      res.statusCode = azRes.status || 200;
      Object.entries(azRes.headers ?? {}).forEach(([key, value]) => {
        res.setHeader(key, value!.toString());
      });
      try {
        const body: any = azRes.body;
        if (body && typeof body[Symbol.asyncIterator] === 'function') {
          // If the body is an async iterable, we stream it
          for await (const chunk of body as AsyncIterable<any>) {
            res.write(chunk);
          }
        } else if (body !== undefined && body !== null) {
          res.write(body);
        }
      } catch (error) {
        console.error('Error writing response:', error);
      }
      res.end();
    });
  };
};
