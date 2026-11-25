const Product = require('../models/Product');
const cloudinary = require('../config/cloudinary');
const mongoose = require('mongoose');
const crypto = require('crypto');

// ================= SUPPORTED CATEGORIES =================

const PRODUCT_CATEGORIES = [
  'Electronics',
  'Fashion',
  'Accessories'
];

// ================= NORMALIZE CATEGORY =================

function normalizeCategory(value) {
  const category = String(value || '')
    .trim()
    .toLowerCase();

  const aliases = {
    electronics: 'Electronics',
    tech: 'Electronics',
    technology: 'Electronics',

    fashion: 'Fashion',
    footwear: 'Fashion',
    clothing: 'Fashion',

    accessories: 'Accessories',
    accessory: 'Accessories'
  };

  return Object.prototype.hasOwnProperty.call(
    aliases,
    category
  ) ? aliases[category] : '';
}

// ================= VALIDATE UPLOADED FILES =================

function validateFile(file, type) {
  if (!file) return;

  const b = file.buffer;

  if (type === 'model') {
    if (
      b.length < 20 ||
      b.toString('ascii', 0, 4) !== 'glTF' ||
      b.readUInt32LE(4) !== 2 ||
      b.readUInt32LE(8) !== b.length
    ) {
      throw new Error('Invalid GLB model');
    }
  } else {
    const jpeg =
      b.length >= 3 &&
      b[0] === 0xff &&
      b[1] === 0xd8 &&
      b[2] === 0xff;

    const png =
      b.length >= 8 &&
      b.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      );

    const webp =
      b.length >= 12 &&
      b.toString('ascii', 0, 4) === 'RIFF' &&
      b.toString('ascii', 8, 12) === 'WEBP';

    if (!jpeg && !png && !webp) {
      throw new Error('Invalid image file');
    }
  }
}

// ================= UPLOAD FILE TO CLOUDINARY =================

function uploadFile(file, type) {
  return new Promise((resolve, reject) => {
    const isModel = type === 'model';

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: isModel
          ? 'shopeasy/models'
          : 'shopeasy/products',

        resource_type: isModel ? 'raw' : 'image',

        public_id: crypto.randomUUID() +
          (isModel ? '.glb' : ''),

        overwrite: false
      },

      (error, result) => {
        if (error) return reject(error);

        resolve(result);
      }
    );

    stream.on('error', reject);
    stream.end(file.buffer);
  });
}

// ================= REMOVE CLOUDINARY FILE =================

async function removeFile(publicId, type) {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: type,
      invalidate: true
    });

  } catch (error) {
    console.error('Cloudinary cleanup failed');
  }
}

// ================= VALIDATE PRODUCT DETAILS =================

function productDetails(body) {

  const name = String(body.name || '').trim();

  const price = Number(body.price);

  const stock = Number(body.stock ?? 0);

  const category = normalizeCategory(body.category);

  // Validate product name
  if (!name) {
    throw new Error('Product name is required');
  }

  // Validate price
  if (
    body.price === undefined ||
    body.price === null ||
    String(body.price).trim() === '' ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    throw new Error(
      'Product price must be greater than zero'
    );
  }

  // Validate stock
  if (
    !Number.isSafeInteger(stock) ||
    stock < 0
  ) {
    throw new Error(
      'Stock must be a non-negative whole number'
    );
  }

  // Validate category
  if (!PRODUCT_CATEGORIES.includes(category)) {
    throw new Error(
      'Please select Electronics, Fashion or Accessories'
    );
  }

  return {
    name,

    description: String(
      body.description || ''
    ).trim(),

    price,

    stock,

    category,

    brand: String(
      body.brand || ''
    ).trim(),

    isActive:
      body.isActive !== false &&
      body.isActive !== 'false'
  };
}

// ================= CREATE PRODUCT =================

exports.createProduct = async (req, res) => {

  let imageResult;
  let modelResult;
  let details;

  const imageFile = req.files?.image?.[0];
  const modelFile = req.files?.model?.[0];

  try {

    details = productDetails(req.body);

    if (!imageFile) {
      throw new Error('Product image is required');
    }

    validateFile(imageFile, 'image');
    validateFile(modelFile, 'model');

  } catch (error) {

    return res.status(400).json({
      message: error.message
    });

  }

  try {

    if (imageFile) {
      imageResult = await uploadFile(
        imageFile,
        'image'
      );
    }

    if (modelFile) {
      modelResult = await uploadFile(
        modelFile,
        'model'
      );
    }

    const product = await Product.create({

      ...details,

      image: imageResult?.secure_url || '',

      imagePublicId:
        imageResult?.public_id || '',

      modelUrl:
        modelResult?.secure_url || '',

      modelPublicId:
        modelResult?.public_id || ''

    });

    return res.status(201).json(product);

  } catch (error) {

    await removeFile(
      imageResult?.public_id,
      'image'
    );

    await removeFile(
      modelResult?.public_id,
      'raw'
    );

    console.error('Product creation failed');

    return res.status(500).json({
      message: 'Failed to create product'
    });

  }
};

// ================= GET PUBLIC PRODUCTS =================

exports.getProducts = async (req, res) => {

  try {

    const products = await Product.find({

      isActive: { $ne: false }

    }).sort({

      createdAt: -1

    });

    return res.status(200).json(products);

  } catch (error) {

    return res.status(500).json({
      message: 'Failed to fetch products'
    });

  }
};

// ================= GET SINGLE PRODUCT =================

exports.getProductById = async (req, res) => {

  try {

    if (!mongoose.isValidObjectId(req.params.id)) {

      return res.status(400).json({
        message: 'Invalid product ID'
      });

    }

    const product = await Product.findOne({

      _id: req.params.id,

      isActive: { $ne: false }

    });

    if (!product) {

      return res.status(404).json({
        message: 'Product not found'
      });

    }

    return res.status(200).json(product);

  } catch (error) {

    return res.status(500).json({
      message: 'Failed to fetch product'
    });

  }
};

// ================= GET ALL PRODUCTS FOR ADMIN =================

exports.getAdminProducts = async (req, res) => {

  try {

    const products = await Product.find()
      .sort({ createdAt: -1 });

    return res.status(200).json(products);

  } catch (error) {

    return res.status(500).json({
      message: 'Failed to fetch products'
    });

  }
};

// ================= UPDATE PRODUCT =================

exports.updateProduct = async (req, res) => {

  let imageResult;
  let modelResult;

  const imageFile = req.files?.image?.[0];
  const modelFile = req.files?.model?.[0];

  try {

    if (!mongoose.isValidObjectId(req.params.id)) {

      return res.status(400).json({
        message: 'Invalid product ID'
      });

    }

    const product = await Product.findById(
      req.params.id
    );

    if (!product) {

      return res.status(404).json({
        message: 'Product not found'
      });

    }

    let details;

    try {

      details = productDetails({

        ...product.toObject(),

        ...req.body

      });

      validateFile(imageFile, 'image');
      validateFile(modelFile, 'model');

    } catch (error) {

      return res.status(400).json({
        message: error.message
      });

    }

    const oldImageId = product.imagePublicId;

    const oldModelId = product.modelPublicId;

    // Update product image if a new image is uploaded

    if (imageFile) {

      imageResult = await uploadFile(
        imageFile,
        'image'
      );

      product.image = imageResult.secure_url;

      product.imagePublicId =
        imageResult.public_id;

    }

    // Update 3D model if a new model is uploaded

    if (modelFile) {

      modelResult = await uploadFile(
        modelFile,
        'model'
      );

      product.modelUrl =
        modelResult.secure_url;

      product.modelPublicId =
        modelResult.public_id;

    }

    // Update product details including category

    Object.assign(product, details);

    await product.save();

    // Remove previous Cloudinary files

    if (imageResult) {

      await removeFile(
        oldImageId,
        'image'
      );

    }

    if (modelResult) {

      await removeFile(
        oldModelId,
        'raw'
      );

    }

    return res.status(200).json(product);

  } catch (error) {

    await removeFile(
      imageResult?.public_id,
      'image'
    );

    await removeFile(
      modelResult?.public_id,
      'raw'
    );

    console.error('Product update failed');

    return res.status(500).json({
      message: 'Failed to update product'
    });

  }
};

// ================= DELETE PRODUCT (SOFT DELETE) =================

exports.deleteProduct = async (req, res) => {

  try {

    if (!mongoose.isValidObjectId(req.params.id)) {

      return res.status(400).json({
        message: 'Invalid product ID'
      });

    }

    const product = await Product.findByIdAndUpdate(

      req.params.id,

      {
        isActive: false
      },

      {
        new: true
      }

    );

    if (!product) {

      return res.status(404).json({
        message: 'Product not found'
      });

    }

    return res.status(200).json({
      message: 'Product removed from storefront'
    });

  } catch (error) {

    return res.status(500).json({
      message: 'Failed to remove product'
    });

  }
};