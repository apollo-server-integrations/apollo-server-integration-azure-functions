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
} from '@azure/functions';

import type { WithRequired } from '@apollo/utils.withrequired';
import { HttpError, BadRequestError, InternalServerError } from './errors';

/**
 * Safely extracts an error message from an unknown error value.
 * Handles Error objects, strings, and objects with message properties.
 *
 * @param error - The error value to extract a message from
 * @param fallback - Default message if extraction fails
 * @returns The extracted error message or fallback
 * @internal
 */
function getErrorMessage(
  error: unknown,
  fallback = 'An unexpected error occurred',
): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

/**
 * Validates and normalizes an HTTP status code.
 * Ensures the status code is within the valid HTTP range (100-599).
 *
 * @param status - The status code to normalize
 * @returns The normalized status code (defaults to 200 if undefined)
 * @throws {InternalServerError} If status code is outside valid range
 * @internal
 */
function normalizeStatusCode(status: number | undefined): number {
  if (status == null) return 200;
  if (status < 100 || status > 599) {
    throw new InternalServerError(`Invalid status code: ${status}`);
  }
  return status;
}

export interface AzureFunctionsContextFunctionArgument {
  context: InvocationContext;
  req: HttpRequest;
  /**
   * The parsed request body. This is already parsed from the request stream
   * and should be used instead of calling `req.json()` for better performance.
   * For POST requests with `application/json` content-type, this contains the parsed JSON object.
   * For other requests, this will be `null`.
   */
  body: unknown;
}

export interface AzureFunctionsMiddlewareOptions<TContext extends BaseContext> {
  context?: ContextFunction<[AzureFunctionsContextFunctionArgument], TContext>;
}

const defaultContext: ContextFunction<
  [AzureFunctionsContextFunctionArgument],
  BaseContext
> = async () => ({});

/**
 * Transforms an async iterable of strings into an async iterable of Uint8Array.
 * Used for streaming chunked GraphQL responses.
 *
 * @param source - An async iterable of string chunks
 * @returns An async iterable of Uint8Array chunks encoded as UTF-8
 * @internal
 */
async function* toUint8ArrayStream(
  source: AsyncIterable<string>,
): AsyncIterable<Uint8Array> {
  const encoder = new TextEncoder();
  for await (const chunk of source) {
    yield encoder.encode(chunk);
  }
}

/**
 * Creates an Azure Functions HTTP handler for Apollo Server.
 *
 * Integrates Apollo Server with Azure Functions v4, handling request/response
 * transformation. The server starts in the background.
 *
 * ## Usage Examples
 *
 * Basic:
 * ```typescript
 * const server = new ApolloServer({ typeDefs, resolvers });
 * export default startServerAndCreateHandler(server);
 * ```
 *
 * With context:
 * ```typescript
 * export default startServerAndCreateHandler(server, {
 *   context: async ({ req, body, context }) => ({ user: await getUser(req) }),
 * });
 * ```
 *
 * ## Important Notes
 *
 * - Do not call `req.json()` in context function - use the `body` parameter instead
 * - Errors return 400 (bad requests) or 500 (internal errors) without exposing details
 *
 * @param server - The Apollo Server instance
 * @param options - Optional configuration including context function
 * @returns An Azure Functions HTTP handler
 */
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
    const contextFunction = (options?.context ??
      defaultContext) as ContextFunction<
      [AzureFunctionsContextFunctionArgument],
      TContext
    >;
    try {
      // Clone request BEFORE normalizeRequest consumes it.
      // normalizeRequest() will consume the original request's body stream via req.json().
      // The clone is preserved and passed to the context function for user access.
      // This ensures users can still read request properties from an unconsumed request.
      const cloneReq = req.clone();
      const normalizedRequest = await normalizeRequest(req);

      const { body, headers, status } = await server.executeHTTPGraphQLRequest({
        httpGraphQLRequest: normalizedRequest,
        context: () =>
          contextFunction({
            context,
            req: cloneReq,
            body: normalizedRequest.body,
          }),
      });

      if (body.kind === 'chunked') {
        return {
          status: normalizeStatusCode(status),
          headers: {
            // Apollo Server provides headers via HeaderMap.
            // Convert to plain object for Azure Functions.
            // Note: If Apollo Server sets Transfer-Encoding, this will be overridden.
            ...Object.fromEntries(headers),
            'Transfer-Encoding': 'chunked',
          },
          body: toUint8ArrayStream(body.asyncIterator),
        };
      }

      return {
        status: normalizeStatusCode(status),
        headers: {
          // Apollo Server provides headers via HeaderMap.
          // Convert to plain object for Azure Functions.
          // Note: We explicitly set content-length for non-chunked responses.
          ...Object.fromEntries(headers),
          'content-length': Buffer.byteLength(body.string).toString(),
        },
        body: body.string,
      };
    } catch (e) {
      context.error('Failure processing GraphQL request', e);

      // Return appropriate HTTP status based on error type.
      // Never expose internal error details for security.
      if (e instanceof HttpError) {
        return {
          status: e.statusCode,
          body: e.exposeMessage ? e.message : 'Bad Request',
        };
      }

      // Unexpected errors are treated as internal server errors.
      return {
        status: 500,
        body: 'Internal Server Error',
      };
    }
  };
}

/**
 * Normalizes an Azure Functions HttpRequest to Apollo Server's HTTPGraphQLRequest format.
 *
 * @param req - The Azure Functions HTTP request
 * @returns A normalized HTTPGraphQLRequest
 * @throws {BadRequestError} If the request method is missing or URL is malformed
 * @throws {BadRequestError} If the request body is invalid JSON
 * @internal
 */
async function normalizeRequest(req: HttpRequest): Promise<HTTPGraphQLRequest> {
  if (!req.method) {
    throw new BadRequestError('No method');
  }

  let search: string;
  try {
    search = new URL(req.url).search;
  } catch (e) {
    throw new BadRequestError(
      `Invalid request URL: ${getErrorMessage(e, 'Malformed URL')}`,
    );
  }

  return {
    method: req.method,
    headers: normalizeHeaders(req),
    search,
    body: await parseBody(req),
  };
}

/**
 * Parses the request body for POST requests with JSON content.
 *
 * Note: This function consumes the request body stream. The request cannot be
 * read again after this function is called.
 *
 * @param req - The Azure Functions HTTP request
 * @returns The parsed JSON body for valid POST requests, null otherwise
 * @throws {BadRequestError} If the JSON body is malformed
 * @internal
 */
async function parseBody(req: HttpRequest): Promise<unknown> {
  // Early exit for non-POST requests
  if (req.method !== 'POST') {
    return null;
  }

  // Headers.get() is case-insensitive per Web API spec (RFC 7230)
  const contentType = req.headers.get('content-type');
  if (!contentType?.toLowerCase().startsWith('application/json')) {
    return null;
  }

  try {
    return await req.json();
  } catch (e) {
    throw new BadRequestError(
      `Invalid JSON in request body: ${getErrorMessage(e, 'Malformed JSON')}`,
    );
  }
}

/**
 * Converts Azure Functions HTTP headers to Apollo Server's HeaderMap format.
 * @param req - The Azure Functions HTTP request
 * @returns A HeaderMap containing all request headers
 * @internal
 */
function normalizeHeaders(req: HttpRequest): HeaderMap {
  const headerMap = new HeaderMap();

  for (const [key, value] of req.headers.entries()) {
    headerMap.set(key, value ?? '');
  }
  return headerMap;
}

// Re-export error classes for user error handling
export { HttpError, BadRequestError, InternalServerError } from './errors';

// Export internal utilities for testing purposes
export const _internal = {
  getErrorMessage,
  normalizeStatusCode,
};
