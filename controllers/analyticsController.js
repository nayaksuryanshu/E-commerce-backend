const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

//getdashboardstats
const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const lastMonth = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      today.getDate()
    );
    const lastYear = new Date(
      today.getFullYear() - 1,
      today.getMonth(),
      today.getDate()
    );

    //total counts
    const totalOrders = await Order.countDocuments();
    const totalUsers = await User.countDocuments({isActive:true});
    const totalProducts = await Product.countDocuments({status:'active'});

   // Revenue calculations
    const totalRevenue = await Order.aggregate([
      { $match: { status: { $in: ['delivered', 'shipped'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const monthlyRevenue = await Order.aggregate([
      { 
        $match: { 
          createdAt: { $gte: lastMonth },
          status: { $in: ['delivered', 'shipped'] }
        }
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    //recentorders
    const recentOrders = await Order.find()
    .sort('-createdAt')
    .limit(5)
    .select('orderNumber status totalAmount createdAt');

    //orderstatusdistribution
    const orderStatusStats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalProducts,
          totalOrders,
          totalRevenue: totalRevenue[0]?.total || 0,
          monthlyRevenue: monthlyRevenue[0]?.total || 0
        },
        recentOrders,
        topProducts,
        orderStatusStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }


};

//getsalesanalytics
const getSalesAnalytics = async (req, res) => {
   try {
    const {period='30d',vendorId} = req.query;  
    //calcdaterange
    const date = new Date();
    switch (period) {
        case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
    }
     // Build match criteria
    let matchCriteria = {
      createdAt: { $gte: startDate },
      status: { $in: ['delivered', 'shipped'] }
    };

    // If vendor is requesting, filter by their products
    if (req.user.role === 'vendor') {
      matchCriteria['items.vendor'] = req.user._id;
    } else if (vendorId) {
      matchCriteria['items.vendor'] = mongoose.Types.ObjectId(vendorId);
    }

    // Daily sales data
    const dailySales = await Order.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          sales: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Product performance
    const productPerformance = await Order.aggregate([
      { $match: matchCriteria },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          totalQuantity: { $sum: '$items.quantity' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          name: '$product.name',
          totalSales: 1,
          totalQuantity: 1,
          orderCount: 1
        }
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        period,
        dailySales,
        productPerformance
      }
    });
   } catch (error) {
    
   }
};

//update user profile
const updateProfile = async (req, res) => {
  try {
    const fieldsToUpdate = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      preferences: req.body.preferences
    };

    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(key => {
      if (fieldsToUpdate[key] === undefined) {
        delete fieldsToUpdate[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      fieldsToUpdate,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


//add address
const addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // If this is the first address or marked as default, make it default
    if (user.addresses.length === 0 || req.body.isDefault) {
      // Remove default from other addresses
      user.addresses.forEach(addr => addr.isDefault = false);
      req.body.isDefault = true;
    }

    user.addresses.push(req.body);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: user.addresses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


//addtowishllist
const addToWishlist = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const user = await User.findById(req.user._id);
    
    if (user.wishlist.includes(req.params.productId)) {
      return res.status(400).json({
        success: false,
        message: 'Product already in wishlist'
      });
    }

    user.wishlist.push(req.params.productId);
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Product added to wishlist'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
// Get dashboard stats
// const getDashboardStats = async (req, res) => {
//   try {
//     const today = new Date();
//     const lastMonth = new Date(
//       today.getFullYear(),
//       today.getMonth() - 1,
//       today.getDate()
//     );

//     // Total counts
//     const totalOrders = await Order.countDocuments();
//     const totalUsers = await User.countDocuments({isActive: true});
//     const totalProducts = await Product.countDocuments({status: 'active'});

//     // Revenue calculations
//     const totalRevenue = await Order.aggregate([
//       { $match: { status: { $in: ['delivered', 'shipped'] } } },
//       { $group: { _id: null, total: { $sum: '$totalAmount' } } }
//     ]);

//     const monthlyRevenue = await Order.aggregate([
//       { 
//         $match: { 
//           createdAt: { $gte: lastMonth },
//           status: { $in: ['delivered', 'shipped'] }
//         }
//       },
//       { $group: { _id: null, total: { $sum: '$totalAmount' } } }
//     ]);

//     // Recent orders
//     const recentOrders = await Order.find()
//       .sort('-createdAt')
//       .limit(5)
//       .select('orderNumber status totalAmount createdAt');

//     // Top products
//     const topProducts = await Order.aggregate([
//       { $match: { status: { $in: ['delivered', 'shipped'] } } },
//       { $unwind: '$items' },
//       {
//         $group: {
//           _id: '$items.product',
//           totalQuantity: { $sum: '$items.quantity' },
//           totalSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
//         }
//       },
//       {
//         $lookup: {
//           from: 'products',
//           localField: '_id',
//           foreignField: '_id',
//           as: 'product'
//         }
//       },
//       { $unwind: '$product' },
//       {
//         $project: {
//           name: '$product.name',
//           totalQuantity: 1,
//           totalSales: 1
//         }
//       },
//       { $sort: { totalQuantity: -1 } },
//       { $limit: 5 }
//     ]);

//     // Order status distribution
//     const orderStatusStats = await Order.aggregate([
//       {
//         $group: {
//           _id: '$status',
//           count: { $sum: 1 }
//         }
//       }
//     ]);

//     res.status(200).json({
//       success: true,
//       data: {
//         overview: {
//           totalUsers,
//           totalProducts,
//           totalOrders,
//           totalRevenue: totalRevenue[0]?.total || 0,
//           monthlyRevenue: monthlyRevenue[0]?.total || 0
//         },
//         recentOrders,
//         topProducts,
//         orderStatusStats
//       }
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Server error',
//       error: error.message
//     });
//   }
// };

// // // Get sales analytics
// // const getSalesAnalytics = async (req, res) => {
// //   try {
// //     const {period = '30d', vendorId} = req.query;  
    
// //     // Calculate date range
// //     const now = new Date();
// //     let startDate;
    
// //     switch (period) {
// //       case '7d':
// //         startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
// //         break;
// //       case '30d':
// //         startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
// //         break;
// //       case '90d':
// //         startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
// //         break;
// //       case '1y':
// //         startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
// //         break;
// //       default:
// //         startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
// //     }

// //     // Build match criteria
// //     let matchCriteria = {
// //       createdAt: { $gte: startDate },
// //       status: { $in: ['delivered', 'shipped'] }
// //     };

//     // If vendor is requesting, filter by their products
//     if (req.user.role === 'vendor') {
//       matchCriteria['items.vendor'] = req.user._id;
//     } else if (vendorId) {
//       matchCriteria['items.vendor'] = new mongoose.Types.ObjectId(vendorId);
//     }

//     // Daily sales data
//     const dailySales = await Order.aggregate([
//       { $match: matchCriteria },
//       {
//         $group: {
//           _id: {
//             year: { $year: '$createdAt' },
//             month: { $month: '$createdAt' },
//             day: { $dayOfMonth: '$createdAt' }
//           },
//           sales: { $sum: '$totalAmount' },
//           orders: { $sum: 1 }
//         }
//       },
//       { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
//     ]);

//     // Product performance
//     const productPerformance = await Order.aggregate([
//       { $match: matchCriteria },
//       { $unwind: '$items' },
//       {
//         $group: {
//           _id: '$items.product',
//           totalSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
//           totalQuantity: { $sum: '$items.quantity' },
//           orderCount: { $sum: 1 }
//         }
//       },
//       {
//         $lookup: {
//           from: 'products',
//           localField: '_id',
//           foreignField: '_id',
//           as: 'product'
//         }
//       },
//       { $unwind: '$product' },
//       {
//         $project: {
//           name: '$product.name',
//           totalSales: 1,
//           totalQuantity: 1,
//           orderCount: 1
//         }
//       },
//       { $sort: { totalSales: -1 } },
//       { $limit: 10 }
//     ]);

//     res.status(200).json({
//       success: true,
//       data: {
//         period,
//         dailySales,
//         productPerformance
//       }
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Server error',
//       error: error.message
//     });
//   }
// };

// Get top products
const getTopProducts = async (req, res) => {
  try {
    const { limit = 10, period = '30d' } = req.query;
    
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const topProducts = await Order.aggregate([
      { 
        $match: { 
          createdAt: { $gte: startDate },
          status: { $in: ['delivered', 'shipped'] } 
        } 
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' },
          totalSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          orderCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          name: '$product.name',
          image: '$product.images[0]',
          totalQuantity: 1,
          totalSales: 1,
          orderCount: 1
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.status(200).json({
      success: true,
      data: topProducts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get customer analytics
const getCustomerAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // New customers
    const newCustomers = await User.countDocuments({
      createdAt: { $gte: startDate },
      role: 'customer',
      isActive: true
    });

    // Top customers by orders
    const topCustomers = await Order.aggregate([
      { 
        $match: { 
          createdAt: { $gte: startDate },
          status: { $in: ['delivered', 'shipped'] }
        }
      },
      {
        $group: {
          _id: '$user',
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          name: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
          email: '$user.email',
          totalOrders: 1,
          totalSpent: 1
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        newCustomers,
        topCustomers
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get revenue analytics
const getRevenueAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Daily revenue
    const dailyRevenue = await Order.aggregate([
      { 
        $match: { 
          createdAt: { $gte: startDate },
          status: { $in: ['delivered', 'shipped'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Total revenue for the period
    const totalRevenue = await Order.aggregate([
      { 
        $match: { 
          createdAt: { $gte: startDate },
          status: { $in: ['delivered', 'shipped'] }
        }
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        period,
        totalRevenue: totalRevenue[0]?.total || 0,
        dailyRevenue
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


module.exports = {
  getDashboardStats,
  getSalesAnalytics,
  getTopProducts,
  getCustomerAnalytics,
  getRevenueAnalytics,
  // Keep your existing functions
  updateProfile,
  addAddress,
  addToWishlist
}

