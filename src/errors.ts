/**
 * Custom error class for HTTP-specific errors with status codes.
 * Allows control over whether error messages are exposed to clients.
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly exposeMessage: boolean = false,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Error class for 400 Bad Request responses.
 * By default, the error message is safe to expose to clients.
 */
export class BadRequestError extends HttpError {
  constructor(message: string, exposeMessage: boolean = true) {
    super(message, 400, exposeMessage);
  }
}

/**
 * Error class for 500 Internal Server Error responses.
 * Error messages are never exposed to clients for security.
 */
export class InternalServerError extends HttpError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, false);
  }
}
