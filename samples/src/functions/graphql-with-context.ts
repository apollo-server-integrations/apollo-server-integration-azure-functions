import { ApolloServer } from '@apollo/server';
import { app, HttpRequest, InvocationContext } from '@azure/functions';
import { startServerAndCreateHandler } from '../../..';

// The GraphQL schema
const typeDefs = `#graphql
  type Query {
    hello: String
    roles: [String]
  }
`;

// A map of functions which return data for the schema.
const resolvers = {
  Query: {
    hello: () => 'world',
    roles: (_: any, _args: any, ctx: Context) => ctx.roles,
  },
};

type Context = {
  userID: string;
  roles: string[];
  // ...
};

async function createContext(
  _req: HttpRequest,
  _context: InvocationContext,
  _body: any,
): Promise<Context> {
  // Assuming a database or external call
  const roles = ['admin'];

  return { userID: 'xyz', roles };
}

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
