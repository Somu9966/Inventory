import { Request, Response } from "express";
import { Prisma, VehicleType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const vehicleTypeEnum = z.nativeEnum(VehicleType);

const tyreInputSchema = z.object({
  sku: z.string().min(1),
  brand: z.string().min(1),
  model: z.string().min(1),
  size: z.string().min(1),
  vehicleType: vehicleTypeEnum,
  quantity: z.number().int().min(0),
  costPrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  supplier: z.string().optional(),
  minStockThreshold: z.number().int().min(0).optional(),
});

const tyreUpdateSchema = tyreInputSchema.partial();

export async function listTyres(req: Request, res: Response) {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const vehicleType = typeof req.query.vehicleType === "string" ? req.query.vehicleType : undefined;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const where: Prisma.TyreWhereInput = {
    ...(vehicleType && vehicleTypeEnum.safeParse(vehicleType).success
      ? { vehicleType: vehicleType as VehicleType }
      : {}),
    ...(search
      ? {
          OR: [
            { brand: { contains: search, mode: "insensitive" } },
            { model: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
            { size: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.tyre.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tyre.count({ where }),
  ]);

  res.json({ items, total, page, limit });
}

export async function getTyre(req: Request, res: Response) {
  const tyre = await prisma.tyre.findUnique({ where: { id: req.params.id } });
  if (!tyre) return res.status(404).json({ error: "Tyre not found" });
  res.json(tyre);
}

export async function createTyre(req: Request, res: Response) {
  const parsed = tyreInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const tyre = await prisma.tyre.create({ data: parsed.data });
    res.status(201).json(tyre);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "A tyre with this SKU already exists" });
    }
    throw err;
  }
}

export async function updateTyre(req: Request, res: Response) {
  const parsed = tyreUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const tyre = await prisma.tyre.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(tyre);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return res.status(404).json({ error: "Tyre not found" });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "A tyre with this SKU already exists" });
    }
    throw err;
  }
}

export async function deleteTyre(req: Request, res: Response) {
  try {
    await prisma.tyre.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return res.status(404).json({ error: "Tyre not found" });
    }
    throw err;
  }
}
