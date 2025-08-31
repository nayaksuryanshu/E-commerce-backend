const mongoose = require('mongoose');

const orderItemSchema= new mongoose.Schema({
    product:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    name: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    variant:{
        name:String,
        value:String
    },
    vendor:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
});

const ShippingSchema= new mongoose.Schema({
    address:{
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zipCode: { type: String, required: true },
        country: { type: String, required: true, default: "India" },
    
    },
    method:{
        type:String ,
        enum:['standard','express','overnight'],
        default:'standard'
    },
    cost: { type: Number, default: 0 },
    estimatedDelivery:Date,
    trackingNumber: String,
    carrier: String
}); 

const paymentSchema= new mongoose.Schema({
   method: {
    type: String,
    enum: ['stripe', 'paypal', 'razorpay', 'cod'],
    required: true
  },
  transactionId: String,
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  paidAt: Date,
  refundId: String,
  refundAmount: Number,
  refundedAt: Date
});

const orderStatusSchema= new mongoose.Schema({
    type: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
        default: 'pending'
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      note:String,
      timestamp:{
        type: Date,
        default: Date.now
      }
});
      
const orderSchema=new mongoose.Schema({
    orderNumber:{
        type: String,
        required: true,
        unique: true
    },
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [orderItemSchema],

    //pricing
    subtotal: { type: Number ,required: true  },
    taxAmount: { type: Number, default: 0 },
    shippingAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalAmount: { type: Number,required: true  },


    //shipping
    shipping:ShippingSchema,
    payment:paymentSchema,
    status:{
        type:String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
        default: 'pending'
    },
    statusHistory:[orderStatusSchema],
   
    //coupons/discounts
    coupon:{
        code:String,
        discountType:{
            type: String,
            enum: ['fixed', 'percentage'],
            default: 'fixed'
        },
        discountValue: Number
    },
    // Additional info
  notes: String,
  cancellationReason: String,
  returnReason: String,

  //timestamps
  confirmedAt:Date,
  shippedAt:Date,
  deliveredAt:Date,
  cancelledAt:Date,
  returnedAt:Date

}
,{timestamps:true}
);


//indexes
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'items.vendor': 1 });
orderSchema.index({ createdAt: -1 });

//pre-save middleware to generate order number
orderSchema.pre('save', async function(next) {
    if(this.isNew){
        const count = await this.model('Order').countDocuments();   
        this.orderNumber = `ORD-${Date.now()}-${(count + 1).toString().padStart(6, '0')}`;

        this.statusHistory.push({
            status:this.status,
            timestamp : new Date()
        })
    }
    next();
    
})

//instance method to update status
orderSchema.methods.updateStatus = async function(newStatus, updatedBy, note) {
    this.status = newStatus;
    this.statusHistory.push({
        status: newStatus,
        note,
        timestamp: new Date()
    });

    //update specific timestamps
    switch (newStatus) {
        case 'confirmed':
            this.confirmedAt = new Date();
            break;
        case 'shipped':
            this.shippedAt = new Date();
            break;
        case 'delivered':
            this.deliveredAt = new Date();
            break;
        case 'cancelled':
            this.cancelledAt = new Date();
            break;
        case 'returned':
            this.returnedAt = new Date();
            break;
        default:
            break;
    }
    return this.save();
}

module.exports=mongoose.model('Order',orderSchema);
