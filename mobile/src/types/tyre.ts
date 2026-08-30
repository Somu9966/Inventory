export type VehicleType = "CAR" | "BIKE" | "TRUCK";

export interface Tyre {
  id: string;
  sku: string;
  brand: string;
  model: string;
  size: string;
  vehicleType: VehicleType;
  quantity: number;
  costPriceCents: number;
  sellingPriceCents: number;
  supplier: string | null;
  imageUri: string | null;
  minStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export type TyreInput = Omit<Tyre, "id" | "createdAt" | "updatedAt">;
