
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDirectory = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const MAX_FILE_SIZE = 2 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const uniqueName =
      `signature-${req.user.userId}-${Date.now()}${extension}`;

    callback(null, uniqueName);
  }
});

// Check the declared MIME type and file extension first.
const fileFilter = (req, file, callback) => {
  const allowedTypes = {
    "image/png": ".png",
    "image/jpeg": ".jpg"
  };

  const expectedExtension = allowedTypes[file.mimetype];
  const actualExtension = path.extname(file.originalname).toLowerCase();

  if (
    !expectedExtension ||
    (file.mimetype === "image/jpeg" &&
      ![".jpg", ".jpeg"].includes(actualExtension)) ||
    (file.mimetype === "image/png" &&
      actualExtension !== ".png")
  ) {
    return callback(
      new Error("Only PNG and JPEG signature images are allowed.")
    );
  }

  callback(null, true);
};

const uploadSignature = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  }
});

// Validate the actual file signature (magic bytes).
// PNG files begin with a specific 8-byte signature.
// JPEG files begin with FF D8 FF.
uploadSignature.validateImageContents = (filePath) => {
  const fileBuffer = Buffer.alloc(8);

  const fileDescriptor = fs.openSync(filePath, "r");

  try {
    const bytesRead = fs.readSync(
      fileDescriptor,
      fileBuffer,
      0,
      fileBuffer.length,
      0
    );

    const isPng =
      bytesRead >= 8 &&
      fileBuffer.equals(
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
      );

    const isJpeg =
      bytesRead >= 3 &&
      fileBuffer[0] === 0xFF &&
      fileBuffer[1] === 0xD8 &&
      fileBuffer[2] === 0xFF;

    return isPng || isJpeg;
  } finally {
    fs.closeSync(fileDescriptor);
  }
};

module.exports = uploadSignature;
