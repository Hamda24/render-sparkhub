const contentModel = require("../models/contentModel");

exports.list = async (req, res) => {
  const { courseId } = req.params;
  const items = await contentModel.findByCourse(courseId);
  res.json({ items });
};

exports.create = async (req, res) => {
  const { courseId } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: "File is required" });
  }

  const cleanTitle = (req.body.title || "Untitled").trim();
  const storedPath = `/uploads/${req.file.filename}`;

  try {
    const existing = await contentModel.findByCourse(courseId);
    const id = await contentModel.create({
      course_id: courseId,
      title: cleanTitle,
      type: req.file.mimetype === "application/pdf" ? "pdf" : "video",
      file_path: storedPath,
      display_order: existing.length,
    });
    res.status(201).json({ createdId: id });
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ error: "Upload failed" });
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
    type:      type              || existing.type,
    file_path: file_path         || existing.file_path,
  });

  res.sendStatus(204);
};

exports.delete = async (req, res) => {
  await contentModel.delete(req.params.id);
  res.sendStatus(204);
};

exports.reorder = async (req, res) => {
  await contentModel.reorder(req.body.items);
  res.sendStatus(204);
};