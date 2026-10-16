import { MongoClient, Db } from 'mongodb';
import { ensureDatabaseIndexes } from './ensure-indexes';

const uri = process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DB || 'arkebank';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 50,
    minPoolSize: 5,
    maxIdleTimeMS: 60000,
    serverSelectionTimeoutMS: 8000,
  });

  await client.connect();
  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  // Background index maintenance (non-blocking)
  ensureDatabaseIndexes(db).catch(() => {});

  return { client, db };
}
