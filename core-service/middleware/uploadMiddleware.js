
const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 2,
    fields: 15,
    fieldSize: 64 * 1024
  },

  fileFilter: (req, file, cb) => {

    const extension = file.originalname
      .split('.')
      .pop()
      .toLowerCase();

    if (file.fieldname === 'image') {

      const allowedExtensions = [
        'jpg', 'jpeg', 'png', 'webp'
      ];

      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp'
      ];

      if (
        allowedExtensions.includes(extension) &&
        allowedTypes.includes(file.mimetype)
      ) {
        return cb(null, true);
      }

      return cb(new Error(
        'Only JPG, JPEG, PNG and WEBP images are allowed'
      ));
    }

    if (file.fieldname === 'model') {

      if (extension === 'glb') {
        return cb(null, true);
      }

      return cb(new Error(
        'Only GLB 3D models are allowed'
      ));
    }

    return cb(new Error('Invalid upload field'));
  }
});

module.exports = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'model', maxCount: 1 }
]);
