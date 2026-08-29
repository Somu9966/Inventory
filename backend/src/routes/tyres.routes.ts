import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";
import {
  createTyre,
  deleteTyre,
  getTyre,
  listTyres,
  updateTyre,
} from "../controllers/tyres.controller";

export const tyresRouter = Router();

tyresRouter.use(authenticate, requireAdmin);

tyresRouter.get("/", asyncHandler(listTyres));
tyresRouter.get("/:id", asyncHandler(getTyre));
tyresRouter.post("/", asyncHandler(createTyre));
tyresRouter.put("/:id", asyncHandler(updateTyre));
tyresRouter.delete("/:id", asyncHandler(deleteTyre));
