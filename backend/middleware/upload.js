const multer = require("multer");
const storage = multer.memoryStorage();

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