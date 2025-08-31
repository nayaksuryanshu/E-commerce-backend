const express = require('express');
const {
  createOrder,
  getUserOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  getVendorOrders
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, createOrder);
router.get('/', protect, getUserOrders);
router.get('/vendor', protect, authorize('vendor', 'admin'), getVendorOrders);
router.get('/:id', protect, getOrder);
router.put('/:id/status', protect, authorize('vendor', 'admin'), updateOrderStatus);
router.put('/:id/cancel', protect, cancelOrder);

module.exports = router;