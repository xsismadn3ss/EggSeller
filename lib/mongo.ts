import mongoose from "mongoose"

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined
}

const cached: MongooseCache = globalThis.__mongooseCache ?? {
  conn: null,
  promise: null,
}
globalThis.__mongooseCache = cached

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error("Falta variable de entorno MONGODB_URI")
  return uri
}

export async function connectMongo(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn
  cached.promise ??= mongoose.connect(getMongoUri())
  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }
  return cached.conn
}
