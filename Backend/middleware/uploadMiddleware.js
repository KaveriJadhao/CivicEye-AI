const fs = require("fs");
const path = require("path");

const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

let multer = null;
try {
  multer = require("multer");
} catch (e) {
  // multer not installed, will use fallback
}

let uploadMiddleware = null;

if (multer) {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `civic-${uniqueSuffix}${ext}`);
    },
  });
  uploadMiddleware = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });
} else {
  // Pure Node.js fallback parser for zero-dependency operation
  uploadMiddleware = {
    single: (fieldName) => (req, res, next) => {
      const contentType = req.headers["content-type"] || "";
      if (contentType.includes("application/json") || !contentType.includes("multipart/form-data")) {
        return next();
      }

      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      if (!boundaryMatch) return next();
      const boundary = boundaryMatch[1] || boundaryMatch[2];

      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        try {
          const buffer = Buffer.concat(chunks);
          const parts = buffer.toString("binary").split("--" + boundary);
          req.body = req.body || {};

          for (const part of parts) {
            if (!part || part === "--\r\n" || part === "--") continue;
            const headerEnd = part.indexOf("\r\n\r\n");
            if (headerEnd === -1) continue;

            const rawHeaders = part.slice(0, headerEnd);
            const content = part.slice(headerEnd + 4, part.lastIndexOf("\r\n"));

            const nameMatch = rawHeaders.match(/name="([^"]+)"/);
            const filenameMatch = rawHeaders.match(/filename="([^"]+)"/);

            if (nameMatch) {
              const name = nameMatch[1];
              if (filenameMatch && filenameMatch[1]) {
                const originalname = filenameMatch[1];
                const ext = path.extname(originalname) || ".jpg";
                const filename = `civic-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
                const filePath = path.join(uploadsDir, filename);

                fs.writeFileSync(filePath, content, "binary");
                req.file = {
                  fieldname: name,
                  originalname,
                  filename,
                  path: filePath,
                  size: content.length,
                };
              } else {
                req.body[name] = Buffer.from(content, "binary").toString("utf-8");
              }
            }
          }
        } catch (err) {
          console.warn("Fallback multipart parse warning:", err.message);
        }
        next();
      });
    },
  };
}

module.exports = uploadMiddleware;
