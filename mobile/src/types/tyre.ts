export type VehicleType = "CAR" | "BIKE" | "TRUCK";

export interface Tyre {
  id: string;
  sku: string;
  brand: string;
  model: string;
  size: string;
  vehicleType: VehicleType;
  quantity: number;
  costPrice: string;
  sellingPrice: string;
  supplier: string | null;
  minStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export type TyreInput = Omit<Tyre, "id" | "createdAt" | "updatedAt">;
