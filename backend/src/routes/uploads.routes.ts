import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { upload } from "../lib/storage";
import { uploadImage } from "../controllers/uploads.controller";

export const uploadsRouter = Router();

uploadsRouter.post(
  "/",
  authenticate,
  requireAdmin,
  upload.single("image"),
  asyncHandler(uploadImage)
);
