# E-commerce Marketplace - Backend API

A robust and scalable backend API for an e-commerce marketplace built with Node.js and Express.js.

## 🚀 Features

- **User Authentication & Authorization**: JWT-based authentication with role-based access control
- **Product Management**: CRUD operations for products with categories and inventory tracking
- **Order Processing**: Complete order lifecycle management
- **Payment Integration**: Secure payment processing
- **Admin Dashboard**: Administrative controls for managing users, products, and orders
- **RESTful API**: Clean and well-documented API endpoints
- **Database Integration**: MongoDB for data persistence
- **Security**: Input validation, rate limiting, and security headers

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Express Validator
- **Security**: Helmet, CORS, bcryptjs
- **Environment Management**: dotenv
- **API Documentation**: Swagger/OpenAPI (optional)

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v14.0.0 or higher)
- npm or yarn
- MongoDB (local or MongoDB Atlas)

## ⚡ Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/nayaksuryanshu/E-commerce-backend.git
cd E-commerce-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/ecommerce
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ecommerce

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d

# Payment Configuration (if using Stripe)
STRIPE_SECRET_KEY=your-stripe-secret-key

# Email Configuration (if using email services)
EMAIL_SERVICE=gmail
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 4. Run the application

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server will start running on `http://localhost:5000`

## 📚 API Endpoints

### Authentication
```
POST /api/auth/register     - Register a new user
POST /api/auth/login        - Login user
POST /api/auth/logout       - Logout user
GET  /api/auth/profile      - Get user profile
PUT  /api/auth/profile      - Update user profile
```

### Products
```
GET    /api/products        - Get all products
GET    /api/products/:id    - Get single product
POST   /api/products        - Create product (Admin)
PUT    /api/products/:id    - Update product (Admin)
DELETE /api/products/:id    - Delete product (Admin)
```

### Orders
```
GET    /api/orders          - Get user orders
GET    /api/orders/:id      - Get single order
POST   /api/orders          - Create new order
PUT    /api/orders/:id      - Update order status (Admin)
```

### Users (Admin only)
```
GET    /api/users           - Get all users
GET    /api/users/:id       - Get single user
PUT    /api/users/:id       - Update user
DELETE /api/users/:id       - Delete user
```

## 📁 Project Structure

```
E-commerce-backend/
├── controllers/           # Route controllers
│   ├── authController.js
│   ├── productController.js
│   ├── orderController.js
│   └── userController.js
├── middleware/            # Custom middleware
│   ├── auth.js
│   ├── errorHandler.js
│   └── validation.js
├── models/               # Database models
│   ├── User.js
│   ├── Product.js
│   └── Order.js
├── routes/               # API routes
│   ├── auth.js
│   ├── products.js
│   ├── orders.js
│   └── users.js
├── utils/                # Utility functions
│   ├── database.js
│   ├── jwt.js
│   └── helpers.js
├── config/               # Configuration files
│   └── database.js
├── .env                  # Environment variables
├── .gitignore
├── package.json
└── server.js             # Application entry point
```

## 🔒 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 🛡️ Security Features

- Password hashing with bcryptjs
- JWT token authentication
- Request rate limiting
- Input validation and sanitization
- CORS configuration
- Helmet for security headers
- MongoDB injection prevention

## 🚀 Deployment

### Heroku Deployment

1. Install Heroku CLI
2. Create a Heroku app:
   ```bash
   heroku create your-app-name
   ```
3. Set environment variables:
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set MONGODB_URI=your-mongodb-atlas-uri
   heroku config:set JWT_SECRET=your-jwt-secret
   ```
4. Deploy:
   ```bash
   git push heroku main
   ```

### Railway/Render Deployment

1. Connect your GitHub repository
2. Set environment variables in the dashboard
3. Deploy automatically on git push

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Suryanshu Nayak**
- GitHub: [@nayaksuryanshu](https://github.com/nayaksuryanshu)
- LinkedIn: [Connect with me](https://linkedin.com/in/yourprofile)

## 🤝 Support

Give a ⭐️ if this project helped you!

For support, email your-email@example.com or create an issue in this repository.