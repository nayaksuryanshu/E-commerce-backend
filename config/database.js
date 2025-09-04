const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Check environment and set appropriate MongoDB URI
    let mongoURI = process.env.MONGO_URI;
    
    // For development, use local MongoDB if MONGO_URI is not set
    if (!mongoURI && process.env.NODE_ENV === 'development') {
      mongoURI = 'mongodb://localhost:27017/ecommerce_marketplace';
    }
    
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Port:', process.env.PORT);
    console.log('MongoDB URI exists:', !!mongoURI);
    console.log('MongoDB URI (masked):', mongoURI ? mongoURI.replace(/\/\/.*@/, '//***:***@') : 'Not provided');
    
    if (!mongoURI) {
      throw new Error('MONGO_URI environment variable is not defined');
    }

    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`MongoDB connected successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;