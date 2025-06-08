const courseModel = require('../models/courseModel');
const contentModel = require('../models/contentModel');
const progressModel = require('../models/progressModel');
const fs = require('fs');
const path = require('path');
const uploadDir = process.env.UPLOAD_DIR || '/var/data/uploads';

exports.listCourses = async (req, res, next) => {
  try {
    const raw = await courseModel.getAll();
    const courses = raw.map(c => {
      let thumbUrl = null;
      if (c.thumbnail) {
        // Make sure thumbnail_format (jpeg/png) is selected in getAll()
        const mime = c.thumbnail_format
          ? `image/${c.thumbnail_format}`
          : 'image/png';
        const b64 = c.thumbnail.toString('base64');
        thumbUrl = `data:${mime};base64,${b64}`;
      }

      return {
        id: c.id,
        title: c.title,
        tutorName: c.tutorName,
        thumbnail: thumbUrl
      };
    });
    res.json({ courses });
  } catch (err) {
    next(err);
  }
};

exports.listCourseContent = async (req, res, next) => {

  try {
    const courseId = req.params.courseId;
    const courseRow = await courseModel.getById(courseId);
    if (!courseRow) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const courseTitle = courseRow.title;

    const all = await contentModel.findByCourse(courseId);

    const videos = all
      .filter(row => row.type === 'video')
      .map(v => ({
        id: v.id,
        title: v.title,
        courseTitle
      }));

    const pdfs = all
      .filter(row => row.type === 'pdf')
      .map(p => ({
        id: p.id,
        title: p.title,
        courseTitle
      }));

    return res.json({ courseTitle, videos, pdfs });
  } catch (err) {
    next(err);
  }
};

exports.getCourseProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const courseId = req.params.courseId;
    const completed = await progressModel.getCompleted(userId, courseId);
    res.json({ completed: Array.from(completed) });
  } catch (err) {
    next(err);
  }
};

exports.markProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const courseId = req.params.courseId;
    const { itemType, itemId } = req.body;
    await progressModel.markDone(userId, courseId, itemType, itemId);
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
};


exports.serveRawContent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const contentId = req.params.contentId;
    const item = await contentModel.findById(contentId);
    if (!item) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // 1) Block if student has never clicked “Start Course”
    //    OR marked any real item done. Our dummy row counts as progress.
    const hasStartedOrProgress = await progressModel.hasAnyProgress(userId, item.course_id);
    if (!hasStartedOrProgress) {
      return res.status(403).json({
        error: 'You must click “Start Course” before accessing content.'
      });
    }

    // 2) PDFs are stored in the database while videos reside on disk.
    if (item.type === 'pdf') {
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `inline; filename="${item.title}"`);
      return res.send(item.data);
    }

    let mimeType = 'application/octet-stream';
    if (item.type === 'video') mimeType = 'video/mp4';
    const filePath = path.join(uploadDir, item.data.toString());
    res.set('Content-Type', mimeType);
    res.set('Content-Disposition', `inline; filename="${item.title}"`);
    return fs
      .createReadStream(filePath)
      .on('error', () => res.sendStatus(404))
      .pipe(res);
  } catch (err) {
    next(err);
  }
};

exports.startCourse = async (req, res, next) => {
  const userId = req.user.id;
  const courseId = req.params.courseId;

  try {
    await progressModel.deleteAllForUserCourse(userId, courseId);
    await progressModel.markDone(userId, courseId, '__started__', null);
    return res.sendStatus(204);
  } catch (err) {
    next(err);
  }
};

exports.hasStartedCourse = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const courseId = req.params.courseId;

    // hasAnyProgress returns true if there is *any* row in `progress` for this user+course,
    // including the dummy row inserted by startCourse (item_type='__started__', item_id=0).
    const started = await progressModel.hasAnyProgress(userId, courseId);
    return res.json({ hasStarted: started });
  } catch (err) {
    next(err);
  }
};