import dns from "node:dns";
import mongoose from "mongoose";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const globalCache = globalThis as unknown as { __mongoose?: Cache };
const cache: Cache = (globalCache.__mongoose ??= { conn: null, promise: null });

export async function connectDb() {
  const uri = process.env.MONGODB_URL?.trim() || process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MongoDB connection is not configured: set MONGODB_URL or MONGODB_URI");
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  if (mongoose.connection.readyState === 0) {
    cache.conn = null;
    cache.promise = null;
  }

  if (!cache.promise) {
    const servers = process.env.MONGODB_DNS_SERVERS?.split(",").map((s) => s.trim()).filter(Boolean);
    if (servers?.length) dns.setServers(servers);
    // Background driver errors (e.g. SRV lookups) must not crash the process
    if (!mongoose.connection.listenerCount("error")) mongoose.connection.on("error", (err) => console.error("[mongo]", err.message));
    cache.promise = mongoose.connect(uri, {
      dbName: "yousell",
      serverSelectionTimeoutMS: 8000,
    });
  }
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}
