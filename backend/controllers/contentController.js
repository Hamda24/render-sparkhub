require('dotenv').config();
const path         = require('path');
const os           = require('os');
const fs           = require('fs/promises');
const ffmpeg       = require('fluent-ffmpeg');
const contentModel = require('../models/contentModel');
const pool         = require('../db');

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
  // 1) pull courseId out exactly once
  const { courseId } = req.params;
  const cleanTitle   = (req.body.title || '').trim() || 'Untitled';

  if (!req.file) {
    return res.status(400).json({ error: 'File is required' });
  }

  // 2) write upload to disk
  const tempFilePath = path.join(
    os.tmpdir(),
    `${Date.now()}_${req.file.originalname}`
  );
  await fs.writeFile(tempFilePath, req.file.buffer);

  // 3) PDF shortcut
  if (req.file.mimetype === 'application/pdf') {
    const existing = await contentModel.findByCourse(courseId);
    const id = await contentModel.create({
      course_id:     courseId,
      title:          cleanTitle,
      type:           'pdf',
      data:           req.file.buffer,
      display_order:  existing.length
    });
    await fs.unlink(tempFilePath).catch(() => {});
    return res.status(201).json({ createdId: id });
  }

  // 4) ffmpeg split (no DB connection held open here)
  const pattern = path.join(os.tmpdir(), 'chunk_%d.mp4');
  await new Promise((resolve, reject) => {
    ffmpeg(tempFilePath)
      .outputOptions([
        '-f','segment',
        '-segment_time','1800',
        '-reset_timestamps','1',
        '-c','copy'
      ])
      .output(pattern)
      .on('end',   resolve)
      .on('error', reject)
      .run();
  });

  // 5) now open your client, start transaction, insert chunks
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const createdIds = [];
    for (let idx = 0; ; idx++) {
      const chunkPath = path.join(os.tmpdir(), `chunk_${idx}.mp4`);
      try {
        await fs.access(chunkPath);
      } catch {
        break;
      }

      const buf      = await fs.readFile(chunkPath);
      const existing = await contentModel.findByCourse(courseId, client);
      const id       = await contentModel.create({
        course_id:     courseId,
        title:          `${cleanTitle} (Part ${idx+1})`,
        type:           'video',
        data:           buf,
        display_order:  existing.length
      }, client);

      createdIds.push(id);
    }

    await client.query('COMMIT');
    await fs.unlink(tempFilePath).catch(() => {});
    return res.status(201).json({ createdIds });

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('DB insert failed:', err);
    return res.status(500).json({ error: 'Upload failed' });
  } finally {
    client.release();
  }
};

/**
 * PUT /api/content/:id
 * Update an existing content item (title and/or file).
 */
exports.update = async (req, res) => {
  let data, type;
  if (req.file) {
    data = req.file.buffer;
    type = req.file.mimetype === 'application/pdf' ? 'pdf' : 'video';
  }

  const existing = await contentModel.findById(req.params.id);
  await contentModel.update(req.params.id, {
    title: req.body.title?.trim() || existing.title,
    type:  data ? type : existing.type,
    data:  data ? data : existing.data
  });

  return res.sendStatus(204);
};

/**
 * DELETE /api/content/:id
 * Delete a content item.
 */
exports.delete = async (req, res) => {
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