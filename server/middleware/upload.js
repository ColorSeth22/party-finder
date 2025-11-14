import multer from 'multer';

// Use memory storage to handle files in-memory for database storage
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const allowed = ['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'];
  if (!allowed.includes(file.mimetype)) return cb(new Error('Unsupported file type'), false);
  cb(null, true);
}

export const uploadSingle = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }).single('media');
export const uploadMulti = multer({ storage, fileFilter, limits: { fileSize: 20 * 1024 * 1024 } }).array('media', 5);
