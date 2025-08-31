// routes/cartRoutes.js
const express = require('express');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
} = require('../controllers/cartController');
const { protect } = require('../middleware/auth');
const { validateCartItem } = require('../middleware/validation');

const router = express.Router();

router.get('/', protect, getCart);
router.post('/add', protect, validateCartItem, addToCart);
router.put('/update', protect, validateCartItem, updateCartItem);
router.delete('/remove/:productId', protect, removeFromCart);
router.delete('/clear', protect, clearCart);

module.exports = router;