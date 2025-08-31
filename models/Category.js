const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { 
        type: String,
        required: [true, "Category name is required"],
        trim: true,
        maxlength: [100, "Category name cannot exceed 100 characters"]      
    },
    slug: {
        type: String,
        unique: true,
        // required: [true, "Category slug is required"],
        lowercase: true
    },
    description: {
        type: String,
        maxlength: [500, "Description cannot exceed 500 characters"],
        default: ""
    },
    image: {
        public_id: { type: String, required: true },
        url: { type: String, required: true }
    },
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',        
        default: null
    },
    level: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    featured: {
        type: Boolean,
        default: false
    },
    sortOrder: {
        type: Number,
        default: 0
    },
    seo: {
        metaTitle: { type: String},
          
            metaDecription: { type : String},
            keywords: { type: String }
        }
    },{
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);
    

// categorySchema.index({ name: 1 });
categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ featured: 1 });
// categorySchema.index({ sortOrder: 1 });

categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'category',
  count: true
});

categorySchema.pre('save', function(next) {
  if (!this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-')
  }
    next();
});

module.exports = mongoose.model('Category', categorySchema);