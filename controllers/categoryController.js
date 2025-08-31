const Category = require('../models/Category');
const Product = require('../models/Product');

//getallcategories
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .populate('subcategories')
      .sort({ sortOrder: 1, name: 1 });

    // Build hierarchical structure
    const rootCategories = categories.filter(cat => !cat.parent);
    
    res.status(200).json({
      success: true,
      count: categories.length,
      data: rootCategories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get single category
// @route   GET /api/categories/:slug
// @access  Public
const getCategory = async (req, res) => {
  try {
    const category = await Category.findOne({ 
      slug: req.params.slug, 
      isActive: true 
    })
      .populate('subcategories')
      .populate('productsCount');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
//get category products
const getCategoryProducts = async (req, res) => {
  try {
    const category = await Category.findOne({ 
      slug: req.params.slug, 
      isActive: true 
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Get subcategories
    const subcategories = await Category.find({ parent: category._id });
    const categoryIds = [category._id, ...subcategories.map(sub => sub._id)];

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // Build query
    let query = { 
      category: { $in: categoryIds }, 
      status: 'active' 
    };

    // Apply filters
    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice) query.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) query.price.$lte = parseFloat(req.query.maxPrice);
    }

    if (req.query.minRating) {
      query.averageRating = { $gte: parseFloat(req.query.minRating) };
    }

    // Sorting
    let sort = { createdAt: -1 };
    if (req.query.sort) {
      const sortField = req.query.sort;
      if (sortField === 'price') sort = { price: 1 };
      else if (sortField === '-price') sort = { price: -1 };
      else if (sortField === 'rating') sort = { averageRating: -1 };
      else if (sortField === 'popular') sort = { purchases: -1 };
    }

    const products = await Product.find(query)
      .populate('vendor', 'businessName')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('name images price averageRating numReviews stock');

    const totalProducts = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      count: products.length,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalProducts / limit),
        totalProducts
      },
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};



// @desc    Create category
// @route   POST /api/categories
// @access  Private (Admin)
const createCategory = async (req, res) => {
  try {
    const category = await Category.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const updateCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private (Admin)
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has products
    const productCount = await Product.countDocuments({ category: req.params.id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with existing products'
      });
    }

    await Category.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

module.exports = {
  getCategories,
  getCategory,
  getCategoryProducts,
  createCategory,
  updateCategory,
  deleteCategory
};
