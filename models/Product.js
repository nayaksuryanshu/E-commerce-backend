const mongoose = require('mongoose');
const { validate } = require('./User');

const variantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, 
    values: [
      {
        value: { type: String, required: true },
        price: { type: Number, default: 0 },
        stock: { type: Number, default: 0 },
        sku: { type: String, unique: true } 
        }
        ]
    });

    const reviewSchema = new mongoose.Schema(
      {
        user: { 
             type: mongoose.Schema.Types.ObjectId,
             ref: 'User', 
             required: true
             },
             rating: { type: Number, required: true, min: 1, max: 5 },
             comment: { type: String, required: true, maxlength: [1000,'Review cannot exceed 1000 characters'] },
                images: [
                    {
                        public_id: { type: String, required: true },
                        url: { type: String, required: true }
                    }
                ],
                helpful: [{
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                }],
                verified: { type: Boolean, default: false }
        },
                { timestamps: true }
            );

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: [200, 'Product name cannot exceed 200 characters'] },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true, maxlength: [2000, 'Description cannot exceed 2000 characters'] },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    stock: { type: Number, required: true, min: 0 ,default: 0},
    sku: { type: String, unique: true, sparse: true },
    trackQuantity: { type: Boolean, default: true },
    allowBackorder: { type: Boolean, default: false },

  images: [
    {
      public_id: { type: String, required: true },
        url: { type: String, required: true },
        alt: { type: String, default: '' },
        isMain: { type: Boolean, default: false }
    }],
   videos: [
    {
        public_id: { type: String, required: true },
        url: { type: String, required: true },
       title : { type: String, default: '' },
    }],
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    subCategories : [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    brand: { type: String, trim:true },
    tags:[String],

    //vendor/seller details
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    specifications: [{
    name: { type: String, required: true },
    value: { type: String, required: true }
  }],
  hasVariants: { type: Boolean, default: false },
  variants: [variantSchema],
  
  //seo
   seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String],
    canonicalUrl: String
  },

   status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'out_of_stock'],
    default: 'draft'
  },
  featured: {
    type: Boolean,
    default: false
  },
  // Shipping
  shipping: {
    weight: { type: Number, default: 0 },
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    freeShipping: { type: Boolean, default: false },
    shippingClass: String
  },
  
  // Reviews and ratings
  reviews: [reviewSchema],
  averageRating: {
    type: Number,
    default: 0,
    min: [0, 'Rating cannot be negative'],
    max: [5, 'Rating cannot exceed 5']
  },
  numReviews: {
    type: Number,
    default: 0
  },
  
  // Analytics
  views: {
    type: Number,
    default: 0
  },
  purchases: {
    type: Number,
    default: 0
  },
  
  // Timestamps for specific events
  publishedAt: Date,
  lastStockUpdate: Date,
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

productSchema.index({ slug: 1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ vendor: 1 });
productSchema.index({ status: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ price: 1 });
productSchema.index({ averageRating: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ views: -1 });
productSchema.index({ purchases: -1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' }); 

//virtual for discount price
productSchema.virtual('discountPrice').get(function() {
    if (this.discount > 0 ) {
        return this.price - (this.price * (this.discount / 100));
    }
    return this.price;
});

//virtual fro avalability
productSchema.virtual('availability').get(function() {
    if(!this.trackQuantity) return 'In Stock';
    if (this.stock <= 0) return this.allowBackorder ? 'backorder' : 'out_of_stock';
  if (this.stock <= 5) return 'low_stock';
    return 'In Stock';
});

productSchema.virtual('stockStatus').get(function() {
  if (!this.trackQuantity) return 'in_stock';
  if (this.stock <= 0) return this.allowBackorder ? 'backorder' : 'out_of_stock';
  if (this.stock <= 5) return 'low_stock';
  return 'in_stock';
});


//pre-save middleware to generate slug
productSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  if(this.reviews.length > 0) {
    const totalRating = this.reviews.reduce((acc, review) => acc + review.rating, 0);
    this.averageRating = totalRating / this.reviews.length;
    this.numReviews = this.reviews.length;
  }

  if (this.trackQuantity && this.stock <= 0 && !this.allowBackorder) {
    this.status = 'out_of_stock';
  }
  next();
});

//static methods to get featured products
productSchema.statics.getTrendingProducts = function(limit = 10) {
    return this.find({ status: 'active' })
    .populate('category', 'name slug')
    .populate('vendor', 'buisinessName')
    .sort({ views: -1 ,purchases: -1})
    .limit(limit)
}

//instance method to increment views
productSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save({validate});
}
  
//instance method to add a review
productSchema.methods.addReview = function(use) {
    const existingReview = this.reviews.find(review => review.user.toString() === use._id.toString());
    if (existingReview) {
        throw new Error('You have already reviewed this product');
    }
    this.reviews.push({
        user: userId,rating,
        comment,
        images
     });
     return this.save();
};

module.exports = mongoose.model('Product', productSchema);