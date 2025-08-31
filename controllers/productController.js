const Product = require("../models/Product");
const Category = require("../models/Category");
const User = require("../models/User");
const cloudinary = require("../utils/cloudinary");
const { validationResult } = require("express-validator");

//advanced query builder class
class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }
  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ["page", "sort", "limit", "fields"];
    excludedFields.forEach((el) => delete queryObj[el]);
    //advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );
    this.query.find(JSON.parse(queryStr));
    return this;
  }
  search() {
    if (this.queryString.search) {
      const searchQuery = {
        $or: [
          { name: { $regex: this.queryString.search, $options: "i" } },
          { description: { $regex: this.queryString.search, $options: "i" } },
          { tags: { $regex: this.queryString.search, $options: "i" } },
          { brand: { $regex: this.queryString.search, $options: "i" } },
        ],
      };
      this.query = this.query.find(searchQuery);
    }
    return this;
  }
  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort("-createdAt");
    }
    return this;
  }
  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select("-__v");
    }
    return this;
  }
  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 10;
    const skip = (page - 1) * limit;
    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}

//get all products with advance filtering
const getProducts = async (req, res) => {
  try {
    let baseQuery = Product.find({ status: "active" });

    //category filtering
    if (req.query.category) {
      const category = await Category.findOne({ slug: req.query.category });
      if (category) {
        baseQuery.category = category._id;
      }
    }

    //price range filtering
    if (req.query.minprice && req.query.maxprice) {
      baseQuery.price = {};
      if (req.query.minprice)
        baseQuery.price.$gte = parseFloat(req.query.minprice);
      if (req.query.maxprice)
        baseQuery.price.$lte = parseFloat(req.query.maxprice);
    }
    //min rating filtering
    if (req.query.minRating) {
      baseQuery.averageRating = { $gte: parseFloat(req.query.minrating) };
    }
    //in stock filtering
    if (req.query.inStock === "true") {
      baseQuery.$or = [
        { trackQuantity: false },
        { stock: { $gt: 0 } },
        { allowBackorder: true },
      ];
    }

    //get total count for pagination
    const totalCount = await Product.countDocuments(baseQuery);

    //apply api features
    const features = new APIFeatures(
      Product.find(baseQuery)
        .populate("category", "name slug")
        .populate("vendor", "businessName firstName lastName")
        .populate("reviews.user", "firstName lastName avatar"),
      req.query
    )
      .filter()
      .search()
      .sort()
      .limitFields()
      .paginate();

    const products = await features.query;

    //calculate pagination details
    const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 10;
    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      count: products.length,
      pagination: {
        page,
        limit,
        totalPages,
        totalCount, // Fixed: was totalProducts
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      data: products,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

//get single product
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category", "name slug")
      .populate("vendor", "businessName firstName lastName")
      .populate("reviews.user", "firstName lastName avatar");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    //increment views if not the owner
    if (!req.user || req.user._id.toString() !== product.vendor.toString()) {
      await product.incrementViews();
    }
    //get related products
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      status: "active",
    })
      .populate("category", "name slug")
      .populate("vendor", "businessName firstName lastName")
      .limit(4)
      .select("name slug price images averageRating numReviews");

    res.status(200).json({
      data: {
        product,
        relatedProducts,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//create new product
const createProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    //check if category exists
    const category = await Category.findById(req.body.category);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    //set vendor to current user
    req.body.vendor = req.user._id;
    //generate sku if not provided
    if (!req.body.sku) {
      req.body.sku = `PRD-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;
    }
    const product = await Product.create(req.body);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//update product
const updateProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    //check ownership
    if (product.vendor.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "You are not authorized to update this product" });
    }

    //update stock timestamp if stock is being updated
    if (req.body.stock !== undefined) {
      req.body.lastStockUpdate = new Date();
    }

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

//delete product
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    //check ownership
    if (product.vendor.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ 
          success: false,
          message: "You are not authorized to delete this product" });
    }

    //delete images from cloudinary
    if(product.images && product.images.length > 0) {
      for (const images of product.images) {
        await cloudinary.uploader.destroy(images.public_id);
      }
    }
    
    await Product.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

//add product review
const addReview = async (req, res) => {
  try {
    const {rating, comment} = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    //check if user already reviewed
    const existingReview = product.reviews.find(
      review => review.user.toString() === req.user._id.toString());
    if (existingReview) {
      return res.status(400).json({ message: "You have already reviewed this product" });
    }

    const review = {
      user: req.user._id,
      name: req.user.name,
      rating,
      comment,
    }
    product.reviews.push(review);

    //recalculate avg rating
    const totalRating = product.reviews.reduce((sum, item) => sum + item.rating, 0);
    product.averageRating = totalRating / product.reviews.length;
    product.numReviews = product.reviews.length;
    await product.save();

    res.status(200).json({
      success: true,
      message: "Review added successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

//get top rated products
const getTopRatedProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: 'active' })
    .populate('category', 'name slug')
    .sort({ averageRating: -1, numReviews: -1 })
    .limit(10)
    .select('name price images averageRating numReviews');

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

//get featured products - FIXED VERSION
const getFeaturedProducts = async (req, res) => {
  try {
    // Option 1: If you have an isFeatured field in your Product model
    const products = await Product.find({ 
      status: 'active',
      isFeatured: true
    })
    .populate('category', 'name slug')
    .populate('vendor', 'businessName firstName lastName')
    .sort({ createdAt: -1 })
    .limit(12)
    .select('name slug price images averageRating numReviews');

    // Option 2: If you don't have isFeatured field, use high-rated products with good reviews
    // const products = await Product.find({ 
    //   status: 'active',
    //   numReviews: { $gte: 3 },
    //   averageRating: { $gte: 4.0 }
    // })
    // .populate('category', 'name slug')
    // .populate('vendor', 'businessName firstName lastName')
    // .sort({ averageRating: -1, numReviews: -1 })
    // .limit(12)
    // .select('name slug price images averageRating numReviews');

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

//trending products - FIXED VERSION
const getTrendingProducts = async (req, res) => {
  try {
    // Since Product.getTrendingProducts() doesn't exist, implement the logic here
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const products = await Product.find({ 
      status: 'active',
      createdAt: { $gte: thirtyDaysAgo }
    })
    .populate('category', 'name slug')
    .populate('vendor', 'businessName firstName lastName')
    .sort({ views: -1, purchases: -1, createdAt: -1 })
    .limit(12)
    .select('name slug price images averageRating numReviews views purchases');

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

//get product analytics
const getProductAnalytics = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({message: "Product not found"});
    }
    
    //check ownership
    if (product.vendor.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "You are not authorized to view this product analytics" });
    }
   
    //get view analytics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
   
    const ratingDistribution = {
      5: product.reviews.filter(review => review.rating === 5).length,
      4: product.reviews.filter(review => review.rating === 4).length,
      3: product.reviews.filter(review => review.rating === 3).length,
      2: product.reviews.filter(review => review.rating === 2).length,
      1: product.reviews.filter(review => review.rating === 1).length,
    }

    const analytics = {
      totalViews: product.views,
      totalPurchases: product.purchases,
      conversionRate: product.views > 0 ? product.purchases / product.views : 0,
      averageRating: product.averageRating,
      totalReviews: product.numReviews,
      ratingDistribution,
      currentStock: product.stock,
      stockStatus: product.stockStatus
    }

    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

//get vendor products
const getVendorProducts = async (req, res) => {
  try {
    const vendor = await User.findById(req.params.vendorId);
    if (!vendor || vendor.role !== "vendor") {
      return res.status(404).json({message: "Vendor not found"});
    }
    
    const features = new APIFeatures(
      Product.find({vendor: req.params.vendorId, status: "active"})
      .populate("category", "name slug"), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

    const products = await features.query;
    const totalProducts = await Product.countDocuments({
      vendor: req.params.vendorId,
      status: "active"
    });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

//get product suggestion based on search
const getProductSuggestions = async (req, res) => {
  try {
    const {q} = req.query;

    if (!q || q.length < 2) {
      return res.status(200).json({
        success: false,
        message: "Please enter at least 2 characters to search",
      });
    }

    const suggestions = await Product.aggregate([
      {
        $match: {
          status: 'active',
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { tags: { $in: [new RegExp(q, 'i')] } },
            { brand: { $regex: q, $options: 'i' } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          names: { $addToSet: '$name' },
          brands: { $addToSet: '$brand' },
          tags: { $addToSet: '$tags' }
        }
      },
      {
        $project: {
          suggestions: {
            $slice: [
              {
                $setUnion: [
                  '$names',
                  '$brands',
                  { $reduce: { input: '$tags', initialValue: [], in: { $setUnion: ['$$value', '$$this'] } } }
                ]
              },
              10
            ]
          }
        }
      }
    ]);

    const result = suggestions.length > 0 ? suggestions[0].suggestions : [];

    res.status(200).json({
      success: true,
      data: result.filter(item => item && item.toLowerCase().includes(q.toLowerCase()))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

//upload product images
const uploadProductImages = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    //check ownership
    if (product.vendor.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "You are not authorized to upload images for this product" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const uploadPromises = req.files.map(async (file) => {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'marketplace/products',
        width: 800,
        height: 800,
        crop: 'limit',
        quality: 'auto'
      });

      return {
        public_id: result.public_id,
        url: result.secure_url
      };
    });

    const uploadedImages = await Promise.all(uploadPromises);

    product.images.push(...uploadedImages);
    if (!product.images.some(img => img.isMain) && product.images.length > 0) {
      product.images[0].isMain = true;
    }
    await product.save();

    res.status(200).json({
      success: true,
      message: "Images uploaded successfully",
      data: uploadedImages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

module.exports = {
  getProduct,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  addReview,
  getTopRatedProducts,
  getFeaturedProducts, // Match your route file naming
  getTrendingProducts,
  getProductAnalytics,
  getVendorProducts, // Match your route file naming
  getProductSuggestions,
  uploadProductImages
}