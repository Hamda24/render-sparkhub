require('dotenv').config();
const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');
const contentModel = require('../models/contentModel');
const pool = require('../db');

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
  const cleanTitle = (req.body.title || '').trim() || 'Untitled';

  if (!req.file) {
    return res.status(400).json({ error: 'File is required' });
  }

  // PDF branch stays the same, using the buffer in memory:
  if (req.file.mimetype === 'application/pdf') {
    const existing = await contentModel.findByCourse(courseId);
    const id = await contentModel.create({
      course_id:    courseId,
      title:        cleanTitle,
      type:         'pdf',
      data:         req.file.buffer,
      display_order: existing.length
    });
    return res.status(201).json({ createdId: id });
  }

  // 3) FFmpeg split
    const probeStream = new PassThrough();
  probeStream.end(req.file.buffer);
  let durationSec;
  try {
    const metadata = await new Promise((resolve, reject) => {
      ffmpeg(probeStream)
        .ffprobe((err, data) => err ? reject(err) : resolve(data));
    });
    durationSec = metadata.format.duration;
  } catch (err) {
    console.error('ffprobe failed:', err);
    return res.status(500).json({ error: 'Video metadata failed' });
  }

  const SEG = 1800; // 30m
  const segments = Math.ceil(durationSec / SEG);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const createdIds = [];

    for (let i = 0; i < segments; i++) {
      // create a fresh stream of the full buffer each time:
      const inStream = new PassThrough();
      inStream.end(req.file.buffer);

      // collect ffmpeg output into buffers
      const chunks = [];
      await new Promise((resolve, reject) => {
        ffmpeg(inStream)
          .inputOptions([ `-ss ${i * SEG}` ])     // start time
          .outputOptions([ `-t ${SEG}`, '-c', 'copy' ])
          .format('mp4')
          .on('error', reject)
          .on('end', resolve)
          .pipe()
          .on('data', d => chunks.push(d));
      });

      const buf = Buffer.concat(chunks);
      const existing = await contentModel.findByCourse(courseId, client);
      const id = await contentModel.create({
        course_id:    courseId,
        title:        `${cleanTitle} (Part ${i+1})`,
        type:         'video',
        data:         buf,
        display_order: existing.length
      }, client);

      createdIds.push(id);
    }

    await client.query('COMMIT');
    return res.status(201).json({ createdIds });

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('in-memory split failed:', err);
    return res.status(500).json({ error: 'Video processing failed' });
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
    type: data ? type : existing.type,
    data: data ? data : existing.data
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