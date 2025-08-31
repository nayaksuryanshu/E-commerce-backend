const express = require('express');
const {
  getDashboardStats,
  getSalesAnalytics,
  getTopProducts,
  getCustomerAnalytics,
  getRevenueAnalytics
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All analytics routes require authentication
router.use(protect);

// Admin analytics
router.get('/dashboard', authorize('admin'), getDashboardStats);
router.get('/sales', authorize('admin', 'vendor'), getSalesAnalytics);
router.get('/revenue', authorize('admin', 'vendor'), getRevenueAnalytics);
router.get('/customers', authorize('admin'), getCustomerAnalytics);
router.get('/products/top', authorize('admin', 'vendor'), getTopProducts);

module.exports = router;