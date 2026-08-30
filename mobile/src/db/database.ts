import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("tyre_inventory.db").then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS tyres (
          id TEXT PRIMARY KEY NOT NULL,
          sku TEXT NOT NULL UNIQUE,
          brand TEXT NOT NULL,
          model TEXT NOT NULL,
          size TEXT NOT NULL,
          vehicleType TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          costPriceCents INTEGER NOT NULL,
          sellingPriceCents INTEGER NOT NULL,
          supplier TEXT,
          imageUri TEXT,
          minStockThreshold INTEGER NOT NULL DEFAULT 5,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}
