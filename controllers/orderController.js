const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Cart = require("../models/Cart");
const { stripe } = require("stripe")(process.env.STRIPE_SECRET_KEY);

//create new order
const createOrder = async (req, res) => {
  try {
    const { shippingAddress, paymentMethod, paymentDetails, orderNotes } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Verify stock availability
    for (const item of cart.items) {
      const product = item.product;
      
      if (!product || product.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: `Product ${product?.name || 'Unknown'} is not available`
        });
      }

      if (product.trackQuantity && product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}`
        });
      }
    }

    // Prepare order items
    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      vendor: item.product.vendor,
      name: item.product.name,
      image: item.product.images[0]?.url || '',
      price: item.price,
      quantity: item.quantity,
      variant: item.variant
    }));

    // Calculate totals
    const subtotal = cart.subtotal;
    const tax = cart.tax;
    const shippingCost = subtotal > 500 ? 0 : 50; // Free shipping over ₹500
    const totalAmount = subtotal + tax + shippingCost;

    // Create order
    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      subtotal,
      tax,
      shippingCost,
      totalAmount,
      shippingAddress,
      billingAddress: req.body.billingAddress || shippingAddress,
      paymentMethod,
      paymentDetails,
      orderNotes
    });

    // Update product stock and purchase count
    for (const item of cart.items) {
      const product = item.product;
      
      if (product.trackQuantity) {
        product.stock -= item.quantity;
      }
      product.purchases += item.quantity;
      await product.save();
    }

    // Clear user's cart
    cart.items = [];
    await cart.save();

    // Populate order for response
    await order.populate([
      { path: 'user', select: 'firstName lastName email' },
      { path: 'items.product', select: 'name images' },
      { path: 'items.vendor', select: 'businessName' }
    ]);

    // Send notification to vendors
    const vendorIds = [...new Set(orderItems.map(item => item.vendor.toString()))];
    vendorIds.forEach(vendorId => {
      req.io?.to(vendorId).emit('new-order', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        message: 'You have received a new order!'
      });
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

//get user orders
const getUserOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ user: req.user._id })
      .populate("items.product", "name images")
      .populate("items.vendor", "businessName")
      .sort("-createdAt")
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments({ user: req.user._id });
    res.status(200).json({
      success: true,
      count: orders.length,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
      },
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

//get single order
const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.product", "name images")
      .populate("items.vendor", "businessName")
      .populate("items.vendor", "businessName")
      .populate("statusHistory.updatedBy", "firstName lastName");
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    //check if user owns the order or is admin/vendor
    const isOwner = order.user._id.toString() === req.user._id.toString();
    const isVendor = order.items.some(
      (item) => item.vendor._id.toString() === req.user._id.toString()
    );
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isVendor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this order",
      });
    }
    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

//update the statusof order

const updateOrderStatus = async (req, res) => {
  try {
    const { status, note, trackingNumber, carrier } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check authorization
    const isVendor = order.items.some(
      (item) => item.vendor.toString() === req.user._id.toString()
    );
    const isAdmin = req.user.role === "admin";

    if (!isVendor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this order",
      });
    }

    // Validate status transition
    const validTransitions = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["processing", "cancelled"],
      processing: ["shipped", "cancelled"],
      shipped: ["delivered"],
      delivered: ["returned"],
      cancelled: [],
      returned: [],
    };

    if (!validTransitions[order.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${order.status} to ${status}`,
      });
    }

    // Update order status
    await order.updateStatus(status, req.user._id, note);

    // Update tracking info if provided
    if (trackingNumber && carrier) {
      order.shipping.trackingNumber = trackingNumber;
      order.shipping.carrier = carrier;
      await order.save();
    }

    // Send real-time notification to customer
    req.io.to(order.user.toString()).emit("order-status-changed", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status,
      note,
    });

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

//cancel order
const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    //check if users owns the order
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this order",
      });
    }
    //check if order can be canceled or not
    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled at this stage",
      });
    }

    //update order status
    await order.updateStatus("cancelled", req.user._id, reason);
    order.cancellationReason = reason;
    await order.save();

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity, purchases: -1 },
      });
    }
    //process refund if payment completed
    if (order.paymentStatus === "completed") {
      await stripe.refunds.create({
        payment_intent: order.paymentIntentId,
        reason: "requested_by_customer",
      });
    }

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

//getvendor orders
const getVendorOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const orders = await Order.find({ vendor: req.user._id })
      .populate("user", "firstName lastName email")
      .populate("items.product", "name images")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const totalProducts = await Order.countDocuments({
      "items.vendor": req.user._id,
    });
    res.status(200).json({
      success: true,
      count: orders.length,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
      },
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  getVendorOrders
};