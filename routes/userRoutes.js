const express = require('express');
const {
  updateProfile,
  updatePassword,
  addAddress,
  updateAddress,
  deleteAddress,
  getProfile,
  uploadAvatar,
  addToWishlist,
  removeFromWishlist,
  getWishlist
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/validation');
const multer = require('multer');

const storage = multer.memoryStorage(); // or multer.diskStorage({ ... })
// const upload = multer({ storage });


const router = express.Router();

router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, updatePassword);
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar);

// Address management
router.post('/addresses', protect, addAddress);
router.put('/addresses/:addressId', protect, updateAddress);
router.delete('/addresses/:addressId', protect, deleteAddress);

// Wishlist
router.get('/wishlist', protect, getWishlist);
router.post('/wishlist/:productId', protect, addToWishlist);
router.delete('/wishlist/:productId', protect, removeFromWishlist);

module.exports = router;