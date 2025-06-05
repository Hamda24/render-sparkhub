const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const upload     = require('../middleware/upload');
const courseModel = require('../models/courseModel');


exports.createCourse = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    const tutorId = req.user.id;

    // If Multer parsed a file, req.file.buffer is the raw bytes,
    // and req.file.mimetype might be "image/jpeg" or "image/png".
    let thumbnailBuffer = null;
    let thumbnailFormat = null;
    if (req.file && req.file.buffer) {
      thumbnailBuffer  = req.file.buffer;
      // Split off the subtype: e.g. "jpeg" from "image/jpeg"
      thumbnailFormat  = req.file.mimetype.split('/')[1];
    }

    // Pass the tutorId into the model as well
    const newId = await courseModel.createCourse({
      title,
      description,
      thumbnail: thumbnailBuffer,
      thumbnail_format: thumbnailFormat,
      tutor_id: tutorId
    });

    res.status(201).json({ message: 'Course created', id: newId });
  } catch (err) {
    next(err);
  }
};

exports.updateCourse = async (req, res, next) => {
  try {
    const courseId = req.params.id;
    const { title, description } = req.body;
    const tutorId = req.user.id;

    let thumbnailBuffer = null;
    let thumbnailFormat = null;
    if (req.file && req.file.buffer) {
      thumbnailBuffer = req.file.buffer;
      thumbnailFormat = req.file.mimetype.split('/')[1];
    }

    await courseModel.updateCourse(courseId, {
      title,
      description,
      tutor_id: tutorId,
      thumbnail: thumbnailBuffer,
      thumbnail_format: thumbnailFormat
    });

    res.json({ message: 'Course updated' });
  } catch (err) {
    next(err);
  }
};

exports.deleteCourse = async (req, res, next) => {
  try {
    const courseId = req.params.id;
    await courseModel.deleteCourse(courseId);
    res.json({ message: 'Course deleted' });
  } catch (err) {
    next(err);
  }
};

exports.getCourseById = async (req, res, next) => {
  try {
    const course = await require('../models/courseModel').getById(req.params.id);
    res.json({ course });
  } catch (err) {
    next(err);
  }
};

exports.listCourses = async (req, res, next) => {
  try {
    const courses = await courseModel.getAll();
    res.json({ courses });
  } catch (err) {
    next(err);
  }
};