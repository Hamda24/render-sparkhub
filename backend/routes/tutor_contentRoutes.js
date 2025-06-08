const express = require("express");
const router = express.Router();
const path    = require("path");
const contentCtrl = require("../controllers/contentController");
const upload = require("../middleware/upload");
const authMw = require("../middleware/authMiddleware");
const contentModel = require("../models/contentModel");

// 1) Allow preview/download via ?token=…
router.use((req, res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = "Bearer " + req.query.token;
  }
  next();
});

// 2) Protect all admin content routes
router.use(authMw());

const {
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseById
} = require('../controllers/tutorController');


router.get(
  '/courses',
  listCourses
);

router.post(
  '/courses',
  upload.single('thumbnail'),
  createCourse
);

router.put(
  '/courses/:id',
  upload.single('thumbnail'), 
  updateCourse
);

router.delete(
  '/courses/:id',
  deleteCourse
);

router.get(
  '/courses/:id',
  getCourseById
);

// 3) List all content items for a given course
router.get("/courses/:courseId/content", contentCtrl.list);

// 4) Serve raw PDF/video bytes (preview/download)

router.get("/content/:id/raw", async (req, res) => {
  const item = await contentModel.findById(req.params.id);
  if (!item || !item.file_path) return res.sendStatus(404);

  const diskPath = path.join(__dirname, "../uploads", path.basename(item.file_path));
  const stat     = await fs.promises.stat(diskPath).catch(() => null);
  if (!stat) return res.sendStatus(404);

  const mime = item.type === "video"
    ? "video/mp4"
    : "application/pdf";

  // PDFs can be sent inline without ranges:
  if (item.type === "pdf" && !req.query.download) {
    res.setHeader("Content-Type", mime);
    return res.sendFile(diskPath);
  }
  // force download for PDF if requested
  if (item.type === "pdf" && req.query.download) {
    return res.download(diskPath, `${item.title}.pdf`);
  }

  // At this point it's a video → handle Range
  const range = req.headers.range;
  if (!range) {
    // If no range, send entire file
    res.writeHead(200, {
      "Content-Type": mime,
      "Content-Length": stat.size,
      "Accept-Ranges": "bytes"
    });
    fs.createReadStream(diskPath).pipe(res);
  } else {
    // Parse Range: "bytes=start-end"
    const [ , rangeVals ] = range.match(/bytes=(\d+)-(\d*)/);
    let [ start, end ] = rangeVals.split("-").map(Number);
    end = end || stat.size - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": mime,
    });
    fs.createReadStream(diskPath, { start, end }).pipe(res);
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