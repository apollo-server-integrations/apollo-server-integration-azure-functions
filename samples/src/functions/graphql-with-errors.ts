import { ApolloServer } from '@apollo/server';
import { GraphQLError } from 'graphql';
import { app } from '@azure/functions';
import { startServerAndCreateHandler } from '../../..';

// Sample GraphQL schema with various operations that can throw errors
const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
  }

  type Query {
    user(id: ID!): User
    users: [User!]!
    throwValidationError: String
    throwAuthenticationError: String
    throwInternalError: String
  }

  type Mutation {
    createUser(name: String!, email: String!): User
  }
`;

// Mock user database
const users = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
];

const resolvers = {
  Query: {
    // Returns user or throws NOT_FOUND error
    user: (_: any, { id }: { id: string }) => {
      const user = users.find((u) => u.id === id);
      if (!user) {
        throw new GraphQLError('User not found', {
          extensions: {
            code: 'NOT_FOUND',
            http: { status: 404 },
          },
        });
      }
      return user;
    },

    // Returns all users
    users: () => users,

    // Demonstrates validation error
    throwValidationError: () => {
      throw new GraphQLError('Invalid input provided', {
        extensions: {
          code: 'BAD_USER_INPUT',
          http: { status: 400 },
          validationErrors: [
            { field: 'email', message: 'Email format is invalid' },
            { field: 'name', message: 'Name is required' },
          ],
        },
      });
    },

    // Demonstrates authentication error
    throwAuthenticationError: () => {
      throw new GraphQLError('You must be logged in to access this resource', {
        extensions: {
          code: 'UNAUTHENTICATED',
          http: { status: 401 },
        },
      });
    },

    // Demonstrates internal server error
    throwInternalError: () => {
      throw new GraphQLError('An unexpected error occurred', {
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
          http: { status: 500 },
        },
      });
    },
  },

  Mutation: {
    // Creates a user with validation
    createUser: (_: any, { name, email }: { name: string; email: string }) => {
      // Validate email format
      if (!email.includes('@')) {
        throw new GraphQLError('Invalid email format', {
          extensions: {
            code: 'BAD_USER_INPUT',
            http: { status: 400 },
            argumentName: 'email',
          },
        });
      }

      // Check for duplicate email
      if (users.some((u) => u.email === email)) {
        throw new GraphQLError('User with this email already exists', {
          extensions: {
            code: 'CONFLICT',
            http: { status: 409 },
          },
        });
      }

      // Create new user
      const newUser = {
        id: String(users.length + 1),
        name,
        email,
      };
      users.push(newUser);
      return newUser;
    },
  },
};

// Set up Apollo Server with error formatting
const server = new ApolloServer({
  typeDefs,
  resolvers,
  // Optional: Customize error formatting
  formatError: (formattedError) => {
    // Don't expose internal server errors details in production
    if (formattedError.extensions?.code === 'INTERNAL_SERVER_ERROR') {
      return {
        message: 'An unexpected error occurred',
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
        },
      };
    }

    // Return the formatted error as-is for other cases
    return formattedError;
  },
});

app.http('graphql-with-errors', {
  handler: startServerAndCreateHandler(server),
});
