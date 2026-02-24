import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL missing");

export const pool = new Pool({ connectionString });

export async function query<T = any>(text: string, params?: unknown[]) {
  return (pool.query(text, params) as unknown) as Promise<{ rows: T[] }>;
}
