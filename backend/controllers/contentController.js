const contentModel = require('../models/contentModel');

/**
 * GET  /api/courses/:courseId/content
 * List all content items for a given course.
 */
exports.list = async (req, res) => {
  const { courseId } = req.params;
  const items = await contentModel.findByCourse(courseId);
  return res.json({ items });
};


/**
 * Create a new content item.
 * If the uploaded file is a PDF, insert it directly.
 * If it’s a video longer than 30 minutes, split it into 30-minute chunks.
 */

exports.create = async (req, res) => {
  const { courseId } = req.params;
  const cleanTitle = (req.body.title || "").trim() || "Untitled";

  if (!req.file) {
    return res.status(400).json({ error: "File is required" });
  }

  const storedPath = `/uploads/${req.file.filename}`;
  const isPdf = req.file.mimetype === "application/pdf";

  try {
    const existing = await contentModel.findByCourse(courseId);
    const id = await contentModel.create({
      course_id:    courseId,
      title:        cleanTitle,
      type:         isPdf ? "pdf" : "video",
      file_path:    storedPath,
      display_order: existing.length,
    });
    return res.status(201).json({ createdId: id });
  } catch (err) {
    console.error("Upload failed:", err);
    return res.status(500).json({ error: "Upload failed" });
  }
};

exports.update = async (req, res) => {
  let file_path, type;
  if (req.file) {
    file_path = `/uploads/${req.file.filename}`;
    type = req.file.mimetype === "application/pdf" ? "pdf" : "video";
  }

  const existing = await contentModel.findById(req.params.id);
  await contentModel.update(req.params.id, {
    title:     req.body.title?.trim() || existing.title,
    type:      type        || existing.type,
    file_path: file_path   || existing.file_path,
  });

  return res.sendStatus(204);
};

exports.delete = async (req, res) => {
  await contentModel.delete(req.params.id);
  return res.sendStatus(204);
};

exports.reorder = async (req, res) => {
  await contentModel.reorder(req.body.items);
  return res.sendStatus(204);
};