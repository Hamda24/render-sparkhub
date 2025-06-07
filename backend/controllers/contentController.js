require('dotenv').config();
const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const ffmpeg = require('fluent-ffmpeg');
const contentModel = require('../models/contentModel');

/**
 * List all content items for a given course (unchanged).
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
  const cleanTitle = req.body.title?.toString().trim() || 'Untitled';
  if (!req.file) {
    return res.status(400).json({ error: "File is required" });
  }

  // Let the client/front-end know “this can take a few seconds”
  console.log("📦 Received upload; this may take a moment to process.");

  // 1) Write the incoming buffer to a temp file
  const originalName = Date.now() + "_" + req.file.originalname;
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, originalName);

  try {
    await fs.writeFile(tempFilePath, req.file.buffer);
  } catch (err) {
    console.error("💥 Failed to write upload to disk:", err);
    return res.status(500).json({ error: "Server error saving upload" });
  }

  // 2) If it’s a PDF, just do a single insert and return
  if (req.file.mimetype === "application/pdf") {
    const existingItems = await contentModel.findByCourse(courseId);
    const display_order = existingItems.length;

    let insertedId;
    try {
      insertedId = await contentModel.create({
        course_id: courseId,
        title: cleanTitle,
        type: "pdf",
        data: req.file.buffer,
        display_order
      });
    } catch (dbErr) {
      console.error("💥 DB insert failed for PDF:", dbErr);
      await fs.unlink(tempFilePath).catch(() => { });
      return res.status(500).json({ error: "Failed to store PDF in DB" });
    }

    // Cleanup temp and return
    await fs.unlink(tempFilePath).catch(() => { });
    return res.status(201).json({ createdId: insertedId });
  }

  // 3) Assume it’s a video: run a *fast copy-split* into 30-minute segments
  const segmentPattern = path.join(tempDir, `chunk_%d.mp4`);
  try {
    await new Promise((resolve, reject) => {
      ffmpeg(tempFilePath)
        .outputOptions([
          "-f", "segment",
          "-segment_time", "1800",   // 1800 seconds = 30 minutes
          "-reset_timestamps", "1",
          "-c", "copy"
        ])
        .output(segmentPattern)
        .on("start", cmd => console.log("FFmpeg (copy-segment) command:", cmd))
        .on("stderr", line => console.log("FFmpeg stderr:", line))
        .on("end", () => {
          console.log("🎬 Fast splitting (copy) complete:", segmentPattern);
          resolve();
        })
        .on("error", err => {
          console.error("💥 FFmpeg segmentation error:", err);
          reject(err);
        })
        .run();
    });
  } catch (segErr) {
    console.error("💥 Error splitting video:", segErr);
    await fs.unlink(tempFilePath).catch(() => { });
    return res.status(500).json({ error: "Video splitting failed" });
  }

  // 4) Now read each chunk_N.mp4 from disk and insert it into MySQL
  const createdIds = [];
  let partIndex = 0;

  // Keep looping until there’s no file chunk_{partIndex}.mp4
  while (true) {
    const thisChunkPath = path.join(tempDir, `chunk_${partIndex}.mp4`);
    try {
      // See if it exists
      await fs.access(thisChunkPath);
    } catch {
      // no more chunks on disk → break
      break;
    }

    let chunkBuffer;
    try {
      chunkBuffer = await fs.readFile(thisChunkPath);
    } catch (readErr) {
      console.error("💥 Failed to read chunk file:", thisChunkPath, readErr);
      // cleanup what we have so far
      for (let { tempPath } of createdIds) {
        await fs.unlink(tempPath).catch(() => { });
      }
      await fs.unlink(tempFilePath).catch(() => { });
      return res.status(500).json({ error: "Failed to load chunk file" });
    }

    // Determine display_order by counting how many items exist right now
    const existingAfterPrevious = await contentModel.findByCourse(courseId);
    const display_order = existingAfterPrevious.length;

    let insertedId;
    try {
      insertedId = await contentModel.create({
        course_id: courseId,
        title: `${cleanTitle} (Part ${partIndex + 1})`,
        type: "video",
        data: chunkBuffer,
        display_order
      });
      console.log(` → Inserted chunk ${partIndex + 1} as ID ${insertedId}`);
    } catch (dbErr) {
      console.error("💥 DB insert failed for chunk:", dbErr);
      await fs.unlink(thisChunkPath).catch(() => { });
      await fs.unlink(tempFilePath).catch(() => { });
      return res.status(500).json({ error: "Failed to store video chunk in DB" });
    }

    createdIds.push({ id: insertedId, tempPath: thisChunkPath });
    partIndex++;
  }

  // 5) Clean up the original upload and all chunk files
  await fs.unlink(tempFilePath).catch(() => { });
  for (let { tempPath } of createdIds) {
    await fs.unlink(tempPath).catch(() => { });
  }

  // 6) Return the list of IDs
  return res.status(201).json({
    createdIds: createdIds.map(x => x.id)
  });
};

/**
 * Update an existing content item (unchanged).
 */
exports.update = async (req, res) => {
  const { id } = req.params;
  let data, type;

  if (req.file) {
    data = req.file.buffer;
    type = req.file.mimetype === 'application/pdf' ? 'pdf' : 'video';
  }

  const existing = await contentModel.findById(id);
  await contentModel.update(id, {
    title: req.body.title,
    type: data ? type : existing.type,
    data: data ? data : existing.data
  });
  return res.sendStatus(204);
};

/**
 * Delete a content item (unchanged).
 */
exports.delete = async (req, res) => {
  const { id } = req.params;
  await contentModel.delete(id);
  return res.sendStatus(204);
};

/**
 * Reorder content items (unchanged).
 */
exports.reorder = async (req, res) => {
  const { items } = req.body; // [{id, display_order}, ...]
  await contentModel.reorder(items);
  return res.sendStatus(204);
};