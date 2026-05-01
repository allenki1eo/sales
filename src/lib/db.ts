import { createClient, Client } from "@libsql/client";

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) {
      throw new Error("TURSO_DATABASE_URL is not set");
    }
    client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

// Proxy that lazily creates the client on first method access.
// This avoids calling createClient during Next.js build/static generation
// when environment variables may not be available.
const handler: ProxyHandler<Record<string, unknown>> = {
  get(_target, prop) {
    const c = getClient();
    const value = (c as unknown as Record<string, unknown>)[prop as string];
    return typeof value === "function" ? (value as Function).bind(c) : value;
  },
};

const db = new Proxy({}, handler) as unknown as Client;

export default db;
