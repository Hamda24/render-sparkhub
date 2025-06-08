const express = require("express");
const router = express.Router();
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
router.get("/content/:id/raw", async (req, res) => {
const item = await contentModel.findById(req.params.id);
  if (!item) return res.sendStatus(404);

  const total = item.data.length;
  const range = req.headers.range;
  // no Range header ⇢ send entire file
  if (!range) {
    res.set({
      "Content-Type": item.type === "pdf" 
                       ? "application/pdf" 
                       : "video/mp4",
      "Content-Length": total,
      "Accept-Ranges": "bytes"
    });
    return res.send(item.data);
  }

  // parse “bytes=start-end”
  const [ , raw ] = range.split("=");
  let [ start, end ] = raw.split("-").map(Number);
  end = isNaN(end) ? total - 1 : end;
  const chunk = item.data.slice(start, end + 1);

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${total}`,
    "Accept-Ranges": "bytes",
    "Content-Length": chunk.length,
    "Content-Type": "video/mp4",
  });
  res.end(chunk);
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