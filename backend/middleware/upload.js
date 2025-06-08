const multer = require("multer");
const path  = require("path");
const { v4: uuid } = require("uuid");

// __dirname here === /opt/render/project/src/backend/middleware
const UPLOADS_DIR = path.join(__dirname, "../uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uuid()}${ext}`);
  },
});

module.exports = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB
  fileFilter: (req, file, cb) => {
    const { fieldname, mimetype } = file;
    if (fieldname === "thumbnail") {
      return mimetype.startsWith("image/")
        ? cb(null, true)
        : cb(new Error("Only images allowed for thumbnails"), false);
    }
    if (fieldname === "file") {
      return mimetype === "application/pdf" || mimetype.startsWith("video/")
        ? cb(null, true)
        : cb(new Error("Only PDF or video allowed"), false);
    }
    cb(new Error("Invalid upload field"), false);
  },
});