const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

//create payment intent
const createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency = 'inr' } = req.body;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to smallest currency unit
      currency,
      metadata: {
        userId: req.user._id.toString()
      }
    });

    res.status(200).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Payment intent creation failed',
      error: error.message
    });
  }
};


//confirm payment
const confirmPayment = async (req, res) => {
    try {
        const { paymentIntentId ,orderId} = req.body;

        //retrieve payment intent from stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if(paymentIntent.status==='succeeded'){
            //update order status
            // await Order.findByIdAndUpdate(orderId,{status:"confirmed"});
            const order = await Order.findById(orderId);
            if (!order){
                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                  });
            }
            order.payment.status='completed';
            order.payment.transactionId=paymentIntentId;
            order.payment.paidAt=new Date();
           await order.updateStatus('confirmed', req.user._id, 'Payment completed');

      res.status(200).json({
        success: true,
        message: 'Payment confirmed successfully',
        data: order
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Payment confirmation failed",
            error: error.message,
          });
        
    }


}

//process refund
const processRefund = async (req, res) => {
  try {
    const { orderId, amount, reason } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization
    const isVendor = req.user.role === 'vendor' && 
      order.items.some(item => item.vendor.toString() === req.user._id.toString());
    const isAdmin = req.user.role === 'admin';

    if (!isVendor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to process refund'
      });
    }

    if (!order.paymentDetails.paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'No payment found for this order'
      });
    }

    // Create refund in Stripe
    const refund = await stripe.refunds.create({
      payment_intent: order.paymentDetails.paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined, // Full refund if no amount specified
      reason: 'requested_by_customer',
      metadata: {
        orderId: orderId,
        reason: reason
      }
    });

    // Update order status
    order.paymentStatus = 'refunded';
    order.status = 'refunded';
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Refund processing failed',
      error: error.message
    });
  }
};

module.exports = {
  createPaymentIntent,
  confirmPayment,
  processRefund
};