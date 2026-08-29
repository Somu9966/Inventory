import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import { env } from "./config/env";
import { authRouter } from "./routes/auth.routes";
import { tyresRouter } from "./routes/tyres.routes";
import { uploadsRouter } from "./routes/uploads.routes";
import { ensureUploadDir, UPLOAD_DIR, UPLOAD_ROUTE } from "./lib/storage";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRouter);
app.use("/tyres", tyresRouter);
app.use("/uploads", uploadsRouter);

// Images are served unauthenticated so <Image> can load them without carrying
// a token; the filenames are random UUIDs, so a URL is not guessable from a SKU.
app.use(UPLOAD_ROUTE, express.static(UPLOAD_DIR, { maxAge: "1y", index: false }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "Image must be 5MB or smaller" : err.message;
    return res.status(status).json({ error: message });
  }
  // fileFilter rejections arrive as plain Errors with a client-safe message.
  if (err.message?.startsWith("Only JPEG")) {
    return res.status(400).json({ error: err.message });
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

ensureUploadDir()
  .then(() => {
    app.listen(env.port, () => {
      console.log(`Tyre inventory API listening on port ${env.port}`);
    });
  })
  .catch((err) => {
    console.error("Could not create upload directory", err);
    process.exit(1);
  });
