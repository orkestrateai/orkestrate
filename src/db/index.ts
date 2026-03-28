import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Gracefully handle missing DATABASE_URL during build or in edge cases
  console.warn("DATABASE_URL is not defined in environment variables.");
}

export const client = connectionString ? postgres(connectionString, { prepare: false }) : {} as any;
export const db = drizzle(client, { schema });
