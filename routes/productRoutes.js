const express = require("express");
const {
  getProduct,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  addReview,
  getTopRatedProducts,
  getFeaturedProducts, // Changed: uppercase F
  getTrendingProducts,
  getProductAnalytics,
  getVendorProducts, // Changed: uppercase V
  getProductSuggestions,
  uploadProductImages,
} = require("../controllers/productController");
// const { getFeaturedProduct } = require('../controllers/productController');

const { protect, authorize, optionalAuth } = require("../middleware/auth");
const {
  validateProduct,
  validateProductId,
  validateReview,
  upload,
} = require("../middleware/validation");
const { cacheMiddleware } = require("../middleware/cache");

// Your routes here...
const router = express.Router();

// Public
router.get("/", cacheMiddleware(300), optionalAuth, getProducts);
router.get("/suggestions", cacheMiddleware(600), getProductSuggestions);
// router.get("/featured", cacheMiddleware(900), getfeaturedProducts);
router.get("/trending", cacheMiddleware(600), getTrendingProducts);
router.get("/top-rated", cacheMiddleware(900), getTopRatedProducts);
router.get("/featured", cacheMiddleware(900), getFeaturedProducts); // uppercase F
router.get("/vendor/:vendorId", cacheMiddleware(300), getVendorProducts); // uppercase V
// router.get("/vendor/:vendorId", cacheMiddleware(300), getvendorProducts);
router.get("/:id", optionalAuth, getProduct);

// Protected
router.post(
  "/",
  protect,
  authorize("vendor", "admin"),
  validateProduct,
  createProduct
);
router.put("/:id", protect, validateProductId, updateProduct);
router.delete("/:id", protect, validateProductId, deleteProduct);
router.post(
  "/:id/reviews",
  protect,
  validateProductId,
  validateReview,
  addReview
);
router.get("/:id/analytics", protect, validateProductId, getProductAnalytics);
router.post(
  "/:id/images",
  protect,
  validateProductId,
  upload.array("images", 5),
  uploadProductImages
);

module.exports = router;
