const express = require('express');
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryProducts
} = require('../controllers/categoryController');
const { protect, authorize } = require('../middleware/auth');
const { cacheMiddleware } = require('../middleware/cache');

const router = express.Router();

// Public routes
router.get('/', cacheMiddleware(1800), getCategories); // 30 minutes cache
router.get('/:slug', cacheMiddleware(900), getCategory);
router.get('/:slug/products', cacheMiddleware(300), getCategoryProducts);

// Protected routes
router.post('/', protect, authorize('admin'), createCategory);
router.put('/:id', protect, authorize('admin'), updateCategory);
router.delete('/:id', protect, authorize('admin'), deleteCategory);

module.exports = router;