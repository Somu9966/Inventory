import { Request, Response } from "express";
import { publicUrl } from "../lib/storage";

export async function uploadImage(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: "No image was uploaded" });
  }
  return res.status(201).json({ url: publicUrl(req.file.filename) });
}
