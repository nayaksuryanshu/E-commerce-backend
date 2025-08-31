const mongoose = require('mongoose');

const cartItemSchema= new mongoose.Schema({
 product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
    default: 1
  },
  price: {
    type: Number,
    required: true
  },
  variant: {
    name: String,
    value: String
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const cartSchema= new mongoose.Schema({
   user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  subtotal: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  },
  coupon: {
    code: String,
    discountAmount: Number,
    discountType: {
      type: String,
      enum: ['percentage', 'fixed']
    }
  },
  expiresAt: {
    type: Date,
    default: Date.now,
    expires: 30 * 24 * 60 * 60 // 30 days
  }
}, {
  timestamps: true
});

//pre-save middleware to calculate subtotal and total
cartSchema.pre('save', function(next) {
  this.subtotal = this.items.reduce((total, item) => {return total + item.price * item.quantity}, 0);
 
  this.tax = this.subtotal * 0.18;
  let discount = 0;
  if (this.coupon) {
    if (this.coupon.discountType === 'percentage') {
      discount = this.subtotal * (this.coupon.discountAmount / 100);
    } else {
      discount = this.coupon.discountAmount;
    }
  }
  
  this.total = this.subtotal + this.tax - discount;
  
  // Reset expiry
  this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  next();
});

//instance method to add  item in an cart
cartSchema.methods.addItem =  function (productId, quantity=1, variant=null) {
    const Product = mongoose.model('Product');
    const product = Product.findById(productId);

    if (!product || product.status !== 'active') {
  throw new Error('Product not found or inactive');
}


    if(product.trackQuantity && product.stock < quantity) {
        throw new Error('Product is out of stock');
    }

     const existingItemIndex = this.items.findIndex(item => 
    item.product.toString() === productId.toString() &&
    JSON.stringify(item.variant) === JSON.stringify(variant)
  );
  
  const price = product.discountPrice || product.price;
  
  if (existingItemIndex > -1) {
    // Update existing item
    const newQuantity = this.items[existingItemIndex].quantity + quantity;
    
    if (product.trackQuantity && product.stock < newQuantity) {
      throw new Error('Insufficient stock');
    }
     this.items[existingItemIndex].quantity = newQuantity;
    this.items[existingItemIndex].price = price;
  } else {
    // Add new item
    this.items.push({
      product: productId,
      quantity,
      price,
      variant
    });
  }
  
  return this.save();

 
};


//instance method to remove item
cartSchema.methods.removeItem = function(productId, variant = null) {
  this.items = this.items.filter(item => 
    !(item.product.toString() === productId.toString() &&
      JSON.stringify(item.variant) === JSON.stringify(variant))
  );
  
  return this.save();
};

//instance method to update quantity
cartSchema.methods.updateQuantity = function(productId, quantity, variant = null) {
    const Product = mongoose.model('Product');
    const product = Product.findById(productId);

    if (!product || product.status !== 'active') {
  throw new Error('Product not found or inactive');
}

    if(product.trackQuantity && product.stock < quantity) {
        throw new Error('Product is out of stock');
    }
  
    const itemIndex = this.items.findIndex(item => 
    item.product.toString() === productId.toString() &&
    JSON.stringify(item.variant) === JSON.stringify(variant)
  );
  
  if (itemIndex > -1) {
    if(quantity<=0) {
        this.items.splice(itemIndex, 1);
    }
    this.items[itemIndex].quantity = quantity;
    this.items[itemIndex].price = product.discountPrice || product.price;
  }
  
  return this.save();
}

module.exports = mongoose.model('Cart', cartSchema);