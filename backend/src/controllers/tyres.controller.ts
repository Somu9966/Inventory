import { Request, Response } from "express";
import { Prisma, VehicleType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { remove as removeImage } from "../lib/storage";

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
  // Only paths this API issued from POST /uploads are accepted, so a client
  // cannot point a record at an arbitrary remote URL. null clears the image.
  imageUrl: z
    .string()
    .regex(/^\/uploads\/[A-Za-z0-9-]+\.(jpg|png|webp)$/, "Invalid image reference")
    .nullable()
    .optional(),
  minStockThreshold: z.number().int().min(0).optional(),
});

const tyreUpdateSchema = tyreInputSchema.partial();

const quantityAdjustSchema = z.object({
  delta: z.number().int().refine((n) => n !== 0, { message: "delta must not be zero" }),
});

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
    const previous = await prisma.tyre.findUnique({
      where: { id: req.params.id },
      select: { imageUrl: true },
    });

    const tyre = await prisma.tyre.update({
      where: { id: req.params.id },
      data: parsed.data,
    });

    // Only once the write succeeded, and only if the image actually changed.
    if (previous?.imageUrl && previous.imageUrl !== tyre.imageUrl) {
      await removeImage(previous.imageUrl);
    }

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
    const tyre = await prisma.tyre.delete({ where: { id: req.params.id } });
    await removeImage(tyre.imageUrl);
    res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return res.status(404).json({ error: "Tyre not found" });
    }
    throw err;
  }
}

export async function adjustTyreQuantity(req: Request, res: Response) {
  const parsed = quantityAdjustSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { delta } = parsed.data;
  const { id } = req.params;

  // The increment is applied by the database, and for a decrement the `gte`
  // guard is part of the same statement — so two people adjusting the same
  // tyre cannot clobber each other's change or push stock below zero.
  const { count } = await prisma.tyre.updateMany({
    where: { id, ...(delta < 0 ? { quantity: { gte: -delta } } : {}) },
    data: { quantity: { increment: delta } },
  });

  if (count === 0) {
    // Either the tyre is gone, or the guard rejected an oversell.
    const current = await prisma.tyre.findUnique({
      where: { id },
      select: { quantity: true },
    });
    if (!current) {
      return res.status(404).json({ error: "Tyre not found" });
    }
    return res.status(409).json({
      error: `Only ${current.quantity} left in stock`,
      quantity: current.quantity,
    });
  }

  const tyre = await prisma.tyre.findUnique({ where: { id } });
  return res.json(tyre);
}
