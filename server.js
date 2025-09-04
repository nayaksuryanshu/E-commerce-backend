// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('./config/database');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const cartRoutes = require('./routes/cartRoutes');
// const reviewRoutes = require('./routes/reviewRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
// const uploadRoutes = require('./routes/uploadRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();
const server = createServer(app);

// Define allowed origins
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:3000",
  "https://your-app-name.vercel.app",
  "http://localhost:3001", // Admin panel
  "http://localhost:3002", // Vendor dashboard
];

// Socket.io setup with proper CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  }
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    console.log('CORS Origin:', origin); // Debug log
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin); // Debug log
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

// Connect to MongoDB
connectDB();

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      scriptSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable to prevent CORS issues
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    error: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// Apply rate limiting before CORS
app.use('/api/auth', authLimiter);
app.use('/api', limiter);

// CORS - Apply BEFORE other middleware
app.use(cors(corsOptions));

// Debug middleware to log request details
app.use((req, res, next) => {
  if (req.url.includes('/auth/register')) {
    console.log('\n=== REGISTER REQUEST DEBUG ===');
    console.log(`${req.method} ${req.url}`);
    console.log('Content-Type:', req.get('Content-Type'));
    console.log('Body received:', JSON.stringify(req.body, null, 2));
    console.log('Body keys:', Object.keys(req.body || {}));
    console.log('Body values:', Object.values(req.body || {}));
    console.log('===========================\n');
  }
  next();
});

// Temporary validation bypass for debugging
app.use('/api/auth/register', (req, res, next) => {
  console.log('🔍 Pre-validation check...');
  console.log('Request body:', req.body);
  
  // Check for validation errors from express-validator
  const { validationResult } = require('express-validator');
  
  // Create a temporary middleware to check validation after it runs
  const originalSend = res.send;
  res.send = function(data) {
    if (res.statusCode === 400) {
      console.log('❌ 400 Error response:', data);
    }
    originalSend.call(this, data);
  };
  
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp({
  whitelist: ['sort', 'fields', 'page', 'limit', 'category', 'brand', 'price']
}));

// Compression middleware
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root route - API welcome message
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Multi-Vendor E-commerce Marketplace API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      products: '/api/products',
      categories: '/api/categories',
      orders: '/api/orders',
      cart: '/api/cart',
      payments: '/api/payments',
      analytics: '/api/analytics'
    },
    docs: {
      swagger: '/api/docs',
      postman: '/api/postman'
    }
  });
});

// Handle favicon requests
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Handle Chrome DevTools well-known requests
app.get('/.well-known/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Well-known resource not found'
  });
});

// Health check endpoint with actual database status
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: Math.round(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    },
    database: dbStatus
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
// app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentRoutes);
// app.use('/api/upload', uploadRoutes);
app.use('/api/analytics', analyticsRoutes);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join user to their room for personal notifications
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });
  
  // Handle order updates
  socket.on('order-update', (data) => {
    io.to(data.userId).emit('order-status-changed', data);
  });
  
  // Handle new messages
  socket.on('new-message', (data) => {
    io.to(data.recipientId).emit('message-received', data);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io accessible to our router
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received');
  server.close(() => {
    console.log('Process terminated');
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

module.exports = { app, io };