const express = require('express');
const {
  createPaymentIntent,
  confirmPayment,
  processRefund
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/create-intent', protect, createPaymentIntent);
router.post('/confirm', protect, confirmPayment);
router.post('/refund', protect, authorize('vendor', 'admin'), processRefund);

module.exports = router;