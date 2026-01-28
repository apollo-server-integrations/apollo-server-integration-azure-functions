import { ApolloServer } from '@apollo/server';
import { GraphQLError } from 'graphql';
import { app, HttpRequest, InvocationContext } from '@azure/functions';
import { startServerAndCreateHandler } from '../../..';

// The GraphQL schema
const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
    roles: [String!]!
  }

  type Query {
    # Public query - no authentication required
    hello: String

    # Protected query - requires authentication
    me: User

    # Protected query - requires specific role
    adminData: String

    # Optional authentication - behavior changes based on auth status
    greeting: String
  }
`;

// Mock user database (in real app, this would be a database lookup)
const users = new Map([
  [
    'user-123',
    {
      id: 'user-123',
      name: 'Alice',
      email: 'alice@example.com',
      roles: ['user'],
    },
  ],
  [
    'user-456',
    {
      id: 'user-456',
      name: 'Bob',
      email: 'bob@example.com',
      roles: ['user', 'admin'],
    },
  ],
]);

// Define the context type
type Context = {
  user: {
    id: string;
    name: string;
    email: string;
    roles: string[];
  } | null;
  isAuthenticated: boolean;
};

// Helper function to validate and decode token
async function getUserFromToken(token: string): Promise<Context['user']> {
  // In a real app, this would:
  // 1. Verify JWT signature
  // 2. Check expiration
  // 3. Look up user in database

  // Mock implementation - extract user ID from token
  if (token.startsWith('Bearer ')) {
    const userId = token.replace('Bearer ', '');
    const user = users.get(userId);

    if (user) {
      return user;
    }
  }

  return null;
}

// Context creation function
async function createContext(
  req: HttpRequest,
  _context: InvocationContext,
  _body: any,
): Promise<Context> {
  // Extract authorization header
  const authHeader = req.headers.get('authorization');

  // Attempt to authenticate user
  let user: Context['user'] = null;

  if (authHeader) {
    try {
      user = await getUserFromToken(authHeader);
    } catch (error) {
      // Log error but don't fail context creation
      // This allows queries to determine if they need auth
      console.error('Authentication error:', error);
    }
  }

  return {
    user,
    isAuthenticated: user !== null,
  };
}

// Helper function to ensure user is authenticated
function requireAuth(
  ctx: Context,
): asserts ctx is Context & { user: NonNullable<Context['user']> } {
  if (!ctx.isAuthenticated || !ctx.user) {
    throw new GraphQLError('You must be logged in to access this resource', {
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 },
      },
    });
  }
}

// Helper function to check if user has required role
function requireRole(ctx: Context, role: string): void {
  requireAuth(ctx);

  if (!ctx.user.roles.includes(role)) {
    throw new GraphQLError(
      `You need the '${role}' role to access this resource`,
      {
        extensions: {
          code: 'FORBIDDEN',
          http: { status: 403 },
        },
      },
    );
  }
}

// Resolvers with authentication and authorization
const resolvers = {
  Query: {
    // Public query - no auth required
    hello: () => 'world',

    // Protected query - requires authentication
    me: (_: any, _args: any, ctx: Context) => {
      requireAuth(ctx);
      return ctx.user;
    },

    // Protected query - requires admin role
    adminData: (_: any, _args: any, ctx: Context) => {
      requireRole(ctx, 'admin');
      return 'Secret admin data';
    },

    // Optional authentication - changes response based on auth status
    greeting: (_: any, _args: any, ctx: Context) => {
      if (ctx.isAuthenticated && ctx.user) {
        return `Hello, ${ctx.user.name}!`;
      }
      return 'Hello, guest!';
    },
  },
};

// Set up Apollo Server
const server = new ApolloServer<Context>({
  typeDefs,
  resolvers,
});

app.http('graphql-with-context', {
  handler: startServerAndCreateHandler(server, {
    context: async (args) => createContext(args.req, args.context, args.body),
  }),
});
