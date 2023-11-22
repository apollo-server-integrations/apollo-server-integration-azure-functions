import {
  ApolloServer,
  BaseContext,
  ContextFunction,
  HTTPGraphQLRequest,
  HeaderMap,
} from '@apollo/server';
import type {
  HttpHandler,
  HttpRequest,
  InvocationContext,
} from '@azure/functions-v4';

import type { WithRequired } from '@apollo/utils.withrequired';

export interface AzureFunctionsContextFunctionArgument {
  context: InvocationContext;
  req: HttpRequest;
}

export interface AzureFunctionsMiddlewareOptions<TContext extends BaseContext> {
  context?: ContextFunction<[AzureFunctionsContextFunctionArgument], TContext>;
}

const defaultContext: ContextFunction<
  [AzureFunctionsContextFunctionArgument],
  any
> = async () => ({});

export function startServerAndCreateHandler(
  server: ApolloServer<BaseContext>,
  options?: AzureFunctionsMiddlewareOptions<BaseContext>,
): HttpHandler;
export function startServerAndCreateHandler<TContext extends BaseContext>(
  server: ApolloServer<TContext>,
  options: WithRequired<AzureFunctionsMiddlewareOptions<TContext>, 'context'>,
): HttpHandler;
export function startServerAndCreateHandler<TContext extends BaseContext>(
  server: ApolloServer<TContext>,
  options?: AzureFunctionsMiddlewareOptions<TContext>,
): HttpHandler {
  server.startInBackgroundHandlingStartupErrorsByLoggingAndFailingAllRequests();
  return async (req: HttpRequest, context: InvocationContext) => {
    const contextFunction = options?.context ?? defaultContext;
    try {
      const normalizedRequest = await normalizeRequest(req);

      const { body, headers, status } = await server.executeHTTPGraphQLRequest({
        httpGraphQLRequest: normalizedRequest,
        context: () => contextFunction({ context, req }),
      });

      if (body.kind === 'chunked') {
        throw Error('Incremental delivery not implemented');
      }

      return {
        status: status || 200,
        headers: {
          ...Object.fromEntries(headers),
          'content-length': Buffer.byteLength(body.string).toString(),
        },
        body: body.string,
      };
    } catch (e) {
      context.error('Failure processing GraphQL request', e);
      return {
        status: 400,
        body: (e as Error).message,
      };
    }
  };
}

async function normalizeRequest(req: HttpRequest): Promise<HTTPGraphQLRequest> {
  if (!req.method) {
    throw new Error('No method');
  }

  return {
    method: req.method,
    headers: normalizeHeaders(req),
    search: new URL(req.url).search,
    body: await parseBody(req),
  };
}

async function parseBody(req: HttpRequest): Promise<unknown> {
  const isValidContentType = req.headers
    .get('content-type')
    ?.startsWith('application/json');
  const isValidPostRequest = req.method === 'POST' && isValidContentType;

  if (isValidPostRequest) {
    return req.json();
  }

  return null;
}

function normalizeHeaders(req: HttpRequest): HeaderMap {
  const headerMap = new HeaderMap();

  for (const [key, value] of req.headers.entries()) {
    headerMap.set(key, value ?? '');
  }
  return headerMap;
}
