require('dotenv').config();
const path = require('path');
const fs = require('fs/promises');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');
const contentModel = require('../models/contentModel');
const pool = require('../db');
const uploadDir = process.env.UPLOAD_DIR || '/var/data/uploads';

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

  try {
    const existing = await contentModel.findByCourse(courseId);

    // PDFs continue to be stored directly in the database. Videos are saved to
    // disk and only their filename is persisted.
    if (req.file.mimetype === "application/pdf") {
      const filePath = path.join(uploadDir, req.file.filename);
      const buffer = await fs.readFile(filePath);
      await fs.unlink(filePath).catch(() => {});

      const id = await contentModel.create({
        course_id: courseId,
        title: cleanTitle,
        type: "pdf",
        data: buffer,
        display_order: existing.length,
      });
      return res.status(201).json({ createdId: id });
    }

    const id = await contentModel.create({
      course_id: courseId,
      title: cleanTitle,
      type: "video",
      data: req.file.filename, // store relative path/filename in the DB
      display_order: existing.length,
    });
    return res.status(201).json({ createdId: id });

  } catch (err) {
    console.error("Upload failed:", err);
    // if it's a Postgres disconnection error, it'll get caught here
    return res.status(500).json({ error: "Upload failed" });
  }
};

/**
 * PUT /api/content/:id
 * Update an existing content item (title and/or file).
 */
exports.update = async (req, res) => {
  let data, type;
  const existing = await contentModel.findById(req.params.id);

  if (req.file) {
    type = req.file.mimetype === 'application/pdf' ? 'pdf' : 'video';

    if (type === 'pdf') {
      const filePath = path.join(uploadDir, req.file.filename);
      data = await fs.readFile(filePath);
      await fs.unlink(filePath).catch(() => {});

      // remove old video file if replacing one
      if (existing?.type === 'video' && existing.data) {
        try {
          await fs.unlink(path.join(uploadDir, existing.data.toString()));
        } catch {}
      }
    } else {
      data = req.file.filename;
      if (existing?.type === 'video' && existing.data.toString() !== data) {
        try {
          await fs.unlink(path.join(uploadDir, existing.data.toString()));
        } catch {}
      }
    }
  }
  await contentModel.update(req.params.id, {
    title: req.body.title?.trim() || existing.title,
    type: data ? type : existing.type,
    data: data ? data : existing.data,
  });

  return res.sendStatus(204);
};

/**
 * DELETE /api/content/:id
 * Delete a content item.
 */
exports.delete = async (req, res) => {
  const existing = await contentModel.findById(req.params.id);
  if (existing?.type === 'video' && existing.data) {
    try {
      await fs.unlink(path.join(uploadDir, existing.data.toString()));
    } catch {}
  }
  await contentModel.delete(req.params.id);
  return res.sendStatus(204);
};

/**
 * PUT /api/content/reorder
 * Reorder a batch of content items.
 * Body: { items: [ { id, display_order }, … ] }
 */
exports.reorder = async (req, res) => {
  await contentModel.reorder(req.body.items);
  return res.sendStatus(204);
};