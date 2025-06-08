const express = require("express");
const router = express.Router();
const contentCtrl = require("../controllers/contentController");
const upload = require("../middleware/upload");
const authMw = require("../middleware/authMiddleware");
const contentModel = require("../models/contentModel");
const fs = require("fs");
const path = require("path");
const uploadDir = process.env.UPLOAD_DIR || "/var/data/uploads";

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
  if (!item) return res.sendStatus(404);

  const mime = item.type === "pdf" ? "application/pdf" : "video/mp4";
  res.set("Content-Type", mime);

  if (item.type === "pdf") {
    if (req.query.download) {
      res.set(
        "Content-Disposition",
        `attachment; filename="${item.title.replace(/"/g, "")}.pdf"`
      );
    }
    return res.send(item.data);
  }

  const filePath = path.join(uploadDir, item.data.toString());
  fs.createReadStream(filePath)
    .on("error", () => res.sendStatus(404))
    .pipe(res);
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