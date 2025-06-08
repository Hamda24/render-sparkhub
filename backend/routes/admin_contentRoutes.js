const express = require("express");
const router = express.Router();
const path    = require("path");  
const fs      = require("fs");
const contentCtrl = require("../controllers/contentController");
const upload = require("../middleware/upload");
const authMw = require("../middleware/authMiddleware");
const { isAdmin } = require("../middleware/authMiddleware");
const contentModel = require("../models/contentModel");

// 1) Allow preview/download via ?token=…
router.use((req, res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = "Bearer " + req.query.token;
  }
  next();
});

// 2) Protect all admin content routes
router.use(authMw(), isAdmin);

// 3) List all content items for a given course
router.get("/courses/:courseId/content", contentCtrl.list);

// 4) Serve raw PDF/video bytes (preview/download)
router.get("/content/:id/raw", authMw(), async (req, res, next) => {
  try {
    // 1) Load metadata
    const item = await contentModel.findById(req.params.id);
    if (!item || !item.file_path) {
      return res.status(404).json({ error: "Not found" });
    }

    // 2) Resolve disk path
    const filename = path.basename(item.file_path);
    const diskPath = path.join(__dirname, "../uploads", filename);

    // 3) Stat the file
    const stat = await fs.promises.stat(diskPath).catch(() => null);
    if (!stat) {
      return res.status(404).json({ error: "Missing file on disk" });
    }

    // 4) Pick MIME
    const isPdf = item.type === "pdf";
    const mime  = isPdf ? "application/pdf" : "video/mp4";

    // 5) PDFs
    if (isPdf) {
      if (req.query.download === "1") {
        // force “Save As…”
        return res.download(
          diskPath,
          `${item.title}${path.extname(diskPath)}`
        );
      }
      // inline preview
      res.setHeader("Content-Type", mime);
      return res.sendFile(diskPath);
    }

    // 6) Videos — support Range for streaming/seek
    const range = req.headers.range;
    if (!range) {
      res.writeHead(200, {
        "Content-Type": mime,
        "Content-Length": stat.size,
        "Accept-Ranges": "bytes",
      });
      return fs.createReadStream(diskPath).pipe(res);
    }

    const matches = range.match(/bytes=(\d+)-(\d*)/);
    if (!matches) return res.status(416).end();

    const start = parseInt(matches[1], 10);
    const end   = matches[2] ? parseInt(matches[2], 10) : stat.size - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": mime,
    });
    return fs.createReadStream(diskPath, { start, end }).pipe(res);

  } catch (err) {
    next(err);
  }
});


// 5) Upload new content (PDF or video):
router.post(
  "/courses/:courseId/content",
  upload.single("file"), // <– expects exactly one “file” field
  contentCtrl.create
);

// 6) Update content (optional file replacement):
router.put(
  "/content/:id",
  upload.single("file"), // <– still expects a single “file” field if present
  contentCtrl.update
);

// 7) Delete a content‐item:
router.delete("/content/:id", contentCtrl.delete);

// 8) Reorder content items:
router.put("/content/reorder", contentCtrl.reorder);

module.exports = router;