import { ApolloServer } from '@apollo/server';
import { app } from '@azure/functions';
import { startServerAndCreateHandler } from '../../..';

// The simplest example possible
const typeDefs = `#graphql
  type Query {
    hello: String
  }
`;

const resolvers = {
  Query: {
    hello: () => 'world',
  },
};

// Set up Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

app.http('graphql-simple', {
  handler: startServerAndCreateHandler(server),
});
