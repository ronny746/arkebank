import { MongoClient, Db } from 'mongodb';
import { ensureDatabaseIndexes } from './ensure-indexes';

const uri = process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DB || 'arkebank';

type Connection = { client: MongoClient; db: Db };

// Cache the *promise* (not the resolved client) on globalThis:
// - concurrent cold-start requests share one connect instead of each opening
//   a 5–50 socket pool and leaking all but the last;
// - dev hot-reload re-evaluates this module, and globalThis survives that.
const globalForMongo = globalThis as typeof globalThis & { __arkeMongo?: Promise<Connection> };

export async function connectToDatabase(): Promise<Connection> {
  if (!globalForMongo.__arkeMongo) {
    globalForMongo.__arkeMongo = (async () => {
      let client: MongoClient | null = null;
      try {
        // Inside the try: a malformed URI throws synchronously here, and that
        // failure must not stay cached for the life of the process either.
        client = new MongoClient(uri, {
          maxPoolSize: 50,
          minPoolSize: 5,
          maxIdleTimeMS: 60000,
          serverSelectionTimeoutMS: 8000,
        });
        await client.connect();
      } catch (error) {
        // Release the failed client and allow the next request to retry.
        globalForMongo.__arkeMongo = undefined;
        await client?.close().catch(() => {});
        throw error;
      }
      const db = client.db(dbName);
      // Background index maintenance (non-blocking)
      ensureDatabaseIndexes(db).catch(() => {});
      return { client, db };
    })();
  }
  return globalForMongo.__arkeMongo;
}
