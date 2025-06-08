const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Directory where uploaded files will be stored. On Render this should
// be a persistent disk mount (e.g. `/var/data`).
const uploadDir = process.env.UPLOAD_DIR || "/var/data/uploads";
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.random().toString(36).slice(2);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    // 2 GB max per file
    fileSize: 2 * 1024 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const mimetype = file.mimetype;
    const field = file.fieldname; // either "thumbnail" or "file"

    // If this is the "thumbnail" field, accept only images:
    if (field === "thumbnail") {
      if (mimetype.startsWith("image/")) {
        return cb(null, true);
      } else {
        return cb(new Error("Only image files are allowed for thumbnails"), false);
      }
    }

    // If this is the "file" field (i.e. course content), accept PDF or video:
    if (field === "file") {
      if (mimetype === "application/pdf" || mimetype.startsWith("video/")) {
        return cb(null, true);
      } else {
        return cb(new Error("Only PDF or video files are allowed for content"), false);
      }
    }

    // Reject any other field names:
    return cb(new Error("Invalid upload field"), false);
  },
});

module.exports = upload;