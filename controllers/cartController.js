const { notFound } = require("../middleware/errorMiddleware");
const Cart = require("../models/Cart");
const Product = require("../models/Product");

//get user cart
const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate({
      path: "items.product",
      select: "name images price stock status trackQuantity",
    });

    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    //filter out inactive product and update prices
    const activeItems = [];
    let cartUpdated = false;
    for (const item of cart.items) {
      if (item.product && item.product.status === "active") {
        const currentPrice = item.product.discountPrice || item.product.price;

        if (item.price !== currentPrice) {
          item.price = currentPrice;
          cartUpdated = true;
        }

        //stock availability
        if (item.product.trackQuantity && item.product.stock < item.quantity) {
          item.quantity = Math.max(item.product.stock, 0);
          cartUpdated = true;
        }
        if (item.quantity > 0) {
          activeItems.push(item);
        } else {
          cartUpdated = true;
        }
      }
    }
    if (cartUpdated) {
      cart.items = activeItems;
      await cart.save();
    }

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

//add item to cart

const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, variant } = req.body;
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }
    await cart.addItem(productId, quantity, variant);
    // Populate cart for response
    await cart.populate({
      path: "items.product",
      select: "name images price stock status",
    });

    res.status(200).json({
      success: true,
      message: "Item added to cart",
      data: cart,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

//update cart ite mquantity
const updateCartItem = async (req, res) => {
  try {
    const { productId, quantity, variant } = req.body;
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    await cart.updateQuantity(productId, quantity, variant);
    await cart.populate({
      path: "items.product",
      select: "name images price stock status",
    });
    res.status(200).json({
      success: true,
      message: "Cart updated",
      data: cart,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

//remove item from cart
const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const { variant } = req.body;
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    await cart.removeItem(productId, variant);
    await cart.populate({
      path: "items.product",
      select: "name images price stock status",
    });
    res
      .status(200)
      .json({ success: true, message: "Item removed from cart", data: cart });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

//clear cart
const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOneAndDelete({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    cart.items = [];
    cart.coupon = undefined;
    await cart.save();
    res
      .status(200)
      .json({
        success: true,
        message: "Cart cleared successfully",
        data: cart,
      });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};
module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  updateCartItem,
  clearCart,
  notFound
};
