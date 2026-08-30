import * as Crypto from "expo-crypto";
import { getDatabase } from "./database";
import { Tyre, TyreInput, VehicleType } from "../types/tyre";
import { deleteImageFile } from "../storage/images";

export class NotFoundError extends Error {
  constructor() {
    super("Tyre not found");
  }
}

export class DuplicateSkuError extends Error {
  constructor() {
    super("A tyre with this SKU already exists");
  }
}

export class InsufficientStockError extends Error {
  quantity: number;
  constructor(quantity: number) {
    super(`Only ${quantity} left in stock`);
    this.quantity = quantity;
  }
}

const VEHICLE_TYPES: VehicleType[] = ["CAR", "BIKE", "TRUCK"];

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
}

interface ListParams {
  search?: string;
  vehicleType?: string;
  page?: number;
  limit?: number;
}

interface ListResult {
  items: Tyre[];
  total: number;
  page: number;
  limit: number;
}

export async function listTyres(params: ListParams = {}): Promise<ListResult> {
  const db = await getDatabase();

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const vehicleType =
    params.vehicleType && VEHICLE_TYPES.includes(params.vehicleType as VehicleType)
      ? (params.vehicleType as VehicleType)
      : undefined;
  const search = params.search?.trim();

  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (vehicleType) {
    conditions.push("vehicleType = ?");
    args.push(vehicleType);
  }
  if (search) {
    conditions.push(
      "(brand LIKE ? COLLATE NOCASE OR model LIKE ? COLLATE NOCASE OR sku LIKE ? COLLATE NOCASE OR size LIKE ? COLLATE NOCASE)"
    );
    const pattern = `%${search}%`;
    args.push(pattern, pattern, pattern, pattern);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const items = await db.getAllAsync<Tyre>(
    `SELECT * FROM tyres ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
    [...args, limit, (page - 1) * limit]
  );
  const countRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) as total FROM tyres ${where}`,
    args
  );

  return { items, total: countRow?.total ?? 0, page, limit };
}

export async function getTyre(id: string): Promise<Tyre | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Tyre>("SELECT * FROM tyres WHERE id = ?", [id]);
}

export async function createTyre(input: TyreInput): Promise<Tyre> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await db.runAsync(
      `INSERT INTO tyres
        (id, sku, brand, model, size, vehicleType, quantity, costPriceCents, sellingPriceCents, supplier, imageUri, minStockThreshold, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.sku,
        input.brand,
        input.model,
        input.size,
        input.vehicleType,
        input.quantity,
        input.costPriceCents,
        input.sellingPriceCents,
        input.supplier,
        input.imageUri,
        input.minStockThreshold,
        now,
        now,
      ]
    );
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new DuplicateSkuError();
    throw err;
  }

  return (await getTyre(id))!;
}

const UPDATABLE_FIELDS: (keyof TyreInput)[] = [
  "sku",
  "brand",
  "model",
  "size",
  "vehicleType",
  "quantity",
  "costPriceCents",
  "sellingPriceCents",
  "supplier",
  "imageUri",
  "minStockThreshold",
];

export async function updateTyre(id: string, patch: Partial<TyreInput>): Promise<Tyre> {
  const db = await getDatabase();

  const previous = await getTyre(id);
  if (!previous) throw new NotFoundError();

  const fields = UPDATABLE_FIELDS.filter((key) => key in patch);
  const setClause = [...fields.map((f) => `${f} = ?`), "updatedAt = ?"].join(", ");
  const values = [...fields.map((f) => patch[f] as string | number | null), new Date().toISOString()];

  try {
    await db.runAsync(`UPDATE tyres SET ${setClause} WHERE id = ?`, [...values, id]);
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new DuplicateSkuError();
    throw err;
  }

  const updated = (await getTyre(id))!;

  if (previous.imageUri && previous.imageUri !== updated.imageUri) {
    await deleteImageFile(previous.imageUri);
  }

  return updated;
}

export async function deleteTyre(id: string): Promise<void> {
  const db = await getDatabase();
  const tyre = await getTyre(id);
  if (!tyre) throw new NotFoundError();

  await db.runAsync("DELETE FROM tyres WHERE id = ?", [id]);
  await deleteImageFile(tyre.imageUri);
}

export async function adjustQuantity(id: string, delta: number): Promise<Tyre> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const guard = delta < 0 ? "AND quantity >= ?" : "";
  const args = delta < 0 ? [delta, now, id, -delta] : [delta, now, id];

  const result = await db.runAsync(
    `UPDATE tyres SET quantity = quantity + ?, updatedAt = ? WHERE id = ? ${guard}`,
    args
  );

  if (result.changes === 0) {
    const current = await getTyre(id);
    if (!current) throw new NotFoundError();
    throw new InsufficientStockError(current.quantity);
  }

  return (await getTyre(id))!;
}
