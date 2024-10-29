import neo4j from 'neo4j-driver';
import { Neo4jConfig } from '@/interfaces';

export const createDriver = async (config: Neo4jConfig) => {
  return neo4j.driver(
    `${config.scheme}://${config.host}:${config.port}`,
    neo4j.auth.basic(config.username, config.password),
  );
};
