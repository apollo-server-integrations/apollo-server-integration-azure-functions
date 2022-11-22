import type {
  AzureFunction,
  Context,
  HttpMethod,
  HttpRequest,
  HttpRequestHeaders,
  Logger,
} from '@azure/functions';
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  Server,
  ServerResponse,
} from 'http';
import type { AddressInfo } from 'net';
import { format } from 'url';

export function urlForHttpServer(httpServer: Server): string {
  const { address, port } = httpServer.address() as AddressInfo;

  // Convert IPs which mean "any address" (IPv4 or IPv6) into localhost
  // corresponding loopback ip. Note that the url field we're setting is
  // primarily for consumption by our test suite. If this heuristic is wrong for
  // your use case, explicitly specify a frontend host (in the `host` option
  // when listening).
  const hostname = address === '' || address === '::' ? 'localhost' : address;

  return format({
    protocol: 'http',
    hostname,
    port,
    pathname: '/',
  });
}

export const createMockServer = (handler: AzureFunction) => {
  return (req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));

    req.on('end', async () => {
      const azReq: HttpRequest = {
        method: (req.method as HttpMethod) || null,
        url: req.url || '',
        headers: processHeaders(req.headers),
        body,
        query: {},
        params: {},
        user: null,
        parseFormBody: () => {
          throw new Error('Not implemented');
        },
      };

      const context: Context = {
        invocationId: 'mock',
        executionContext: {
          invocationId: 'mock',
          functionName: 'mock',
          functionDirectory: 'mock',
          retryContext: null,
        },
        bindings: {},
        bindingData: {
          invocationId: 'mock',
        },
        log: createConsoleLogger(),
        bindingDefinitions: [],
        traceContext: {
          traceparent: '',
          tracestate: '',
          attributes: {},
        },
        done: () => {},
      };

      const azRes = await handler(context, azReq);

      res.statusCode = azRes.status || 200;
      Object.entries(azRes.headers ?? {}).forEach(([key, value]) => {
        res.setHeader(key, value!.toString());
      });
      res.write(azRes.body);
      res.end();
    });
  };
};

const processHeaders: (headers: IncomingHttpHeaders) => HttpRequestHeaders = (
  headers,
) => {
  const result: HttpRequestHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = Array.isArray(value) ? value.join(',') : value ?? '';
  }
  return result;
};

const createConsoleLogger = () => {
  const logger = console.log as Logger;
  logger.error = console.error;
  logger.warn = console.warn;
  logger.info = console.info;
  logger.verbose = console.log;
  return logger;
};
