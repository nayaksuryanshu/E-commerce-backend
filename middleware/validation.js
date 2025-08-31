const { body, param } = require("express-validator");
const multer = require("multer");

// 🟢 Add this to handle file uploads using memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

const validateRegister = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('phone')
    .optional()
    .matches(/^\d{10}$/)
    .withMessage('Phone number must be 10 digits'),
  body('role')
    .optional()
    .isIn(['customer', 'vendor'])
    .withMessage('Invalid role'),
    
  body('businessName')
    .if(body('role').equals('vendor'))
    .notEmpty()
    .withMessage('Business name is required for vendors')
    .if(body('role').equals('vendor'))
    .isLength({ min: 3, max: 100 })
    .withMessage('Business name must be between 3 and 100 characters'),
    
  body('businessDescription')
    .if(body('role').equals('vendor'))
    .notEmpty()
    .withMessage('Business description is required for vendors')
    .if(body('role').equals('vendor'))
    .isLength({ min: 10, max: 1000 })
    .withMessage('Business description must be between 10 and 1000 characters')
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const validateProduct = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Product name must be between 3 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Description must be between 10 and 5000 characters'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('stock')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  body('category')
    .isMongoId()
    .withMessage('Invalid category ID')
];

const validateProductId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid product ID')
];

const validateReview = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Comment must be between 10 and 1000 characters')
];

const validateCartItem = [
  body('productId')
    .isMongoId()
    .withMessage('Invalid product ID'),
  body('quantity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100')
];

module.exports = {
  validateRegister,
  validateLogin,
  validateProduct,
  validateProductId,
  validateReview,
  validateCartItem,
  upload // 🟢 Make sure this is exported
};
