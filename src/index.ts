import type {
  AzureFunction,
  Context,
  HttpRequest,
  HttpRequestHeaders,
  HttpRequestQuery,
} from '@azure/functions';
import {
  ApolloServer,
  BaseContext,
  ContextFunction,
  HeaderMap,
  HTTPGraphQLRequest,
} from '@apollo/server';
import type { WithRequired } from '@apollo/utils.withrequired';

export interface AzureFunctionsContextFunctionArgument {
  context: Context;
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
): AzureFunction;
export function startServerAndCreateHandler<TContext extends BaseContext>(
  server: ApolloServer<TContext>,
  options: WithRequired<AzureFunctionsMiddlewareOptions<TContext>, 'context'>,
): AzureFunction;
export function startServerAndCreateHandler<TContext extends BaseContext>(
  server: ApolloServer<TContext>,
  options?: AzureFunctionsMiddlewareOptions<TContext>,
): AzureFunction {
  server.startInBackgroundHandlingStartupErrorsByLoggingAndFailingAllRequests();
  return async (context: Context, req: HttpRequest) => {
    const contextFunction = options?.context ?? defaultContext;
    try {
      const normalizedRequest = normalizeRequest(req);

      const { body, headers, status } = await server.executeHTTPGraphQLRequest({
        httpGraphQLRequest: normalizedRequest,
        context: () => contextFunction({ context }),
      });

      if (body.kind === 'chunked') {
        throw Error('Incremental delivery not implemented');
      }

      return {
        statusCode: status || 200,
        headers: {
          ...Object.fromEntries(headers),
          'content-length': Buffer.byteLength(body.string).toString(),
        },
        body: body.string,
      };
    } catch (e) {
      context.log.error('Failure processing GraphQL request', e);
      return {
        statusCode: 400,
        body: (e as Error).message,
      };
    }
  };
}

function normalizeRequest(req: HttpRequest): HTTPGraphQLRequest {
  if (!req.method) {
    throw new Error('No method');
  }

  return {
    method: req.method,
    headers: normalizeHeaders(req.headers),
    search: normalizeQueryStringParams(req.query),
    body: req.body,
  };
}

function normalizeHeaders(headers: HttpRequestHeaders): HeaderMap {
  const headerMap = new HeaderMap();
  for (const [key, value] of Object.entries(headers)) {
    headerMap.set(key, value ?? '');
  }
  return headerMap;
}

function normalizeQueryStringParams(
  queryStringParams: HttpRequestQuery | null,
): string {
  const queryStringRecord: Record<string, string> = {};
  for (const [key, value] of Object.entries(queryStringParams ?? {})) {
    queryStringRecord[key] = value ?? '';
  }
  return Object.keys(queryStringRecord).reduce(
    (acc, key) => `${acc}&${key}=${queryStringRecord[key]}`,
    '',
  );
}
