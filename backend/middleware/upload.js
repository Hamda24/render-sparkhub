const multer = require("multer");
const path  = require("path");
const { v4: uuid } = require("uuid");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // your `prestart` script mkdir -p uploads ensures this exists
    cb(null, path.join(__dirname, "../uploads"));
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
    // only accept the “file” field, and only PDF/video
    if (file.fieldname !== "file") {
      return cb(new Error("Invalid field"), false);
    }
    if (
      file.mimetype === "application/pdf" ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF or video allowed"), false);
    }
  },
});