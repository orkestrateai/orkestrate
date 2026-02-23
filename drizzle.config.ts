import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url: typeof process.env.DATABASE_URL === 'string'
            ? process.env.DATABASE_URL.includes('pooler.supabase.com') && !process.env.DATABASE_URL.includes('pgbouncer=true')
                ? `${process.env.DATABASE_URL}?pgbouncer=true&connection_limit=1`
                : process.env.DATABASE_URL
            : '',
    },
});
