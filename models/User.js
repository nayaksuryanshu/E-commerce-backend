const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { type } = require("os");
const { log } = require("console");


const addressSchema = new mongoose.Schema(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true, default: "India" },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },

    password: {
      type: String,
      required: function () {
        return !this.googleId && !this.facebookID; // Password is required unless using Google authentication
      },
      minlength: [6, "Password must be at least 6 characters long"],
      select: false, // Exclude password from query results by default
    },
    phone: {
      type: String,
      validate: {
        validator: function (v) {
          return /\d{10}/.test(v); // Validate phone number format (10 digits)
        },
        message: "Phone number must be 10 digits long",
      },
    },
    avatar: {
      public_id: { type: String, required: true },
      url: {
        type: String,
        default:
          "https://res.cloudinary.com/dz1qj3x8h/image/upload/v1698851234/avatar.png",
      },
    },
    role: {
      type: String,
      enum: ["customer", "vendor", "admin"],
      default: "customer",
    },
    addresses: [addressSchema],

    //vendor details

    businessName: {
      type: String,
      required: function () {
        return this.role === "vendor"; // Required only if the user is a vendor
      },
    },
    businessDescription: { type: String },
    businessCategory: { type: String },
    getNumber: { type: String },
    bankDetails: {
      accountNumber: { type: String },
      ifscCode: { type: String },
      accountHolderName: { type: String },
      bankName: { type: String },
    },

    //accountstatus
    isEmailVerified: { type: Boolean, default: false },
    //  isPhoneVerified: { type: Boolean, default: false },
   

    
    isAccountActive: { type: Boolean, default: true },

    //oauth details
    googleId: { type: String },
    facebookID: { type: String },

    //security
    passwordChangedAt: { type: Date },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },

    //activity tracking
    lastLogin: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },

    //preferences
    preferences: {
      currency: {
        type: String,
        default: "INR",
      },
      language: {
        type: String,
        default: "en",
      },
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
      },
    },

    // Wishlist
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    // Recently viewed products
    recentlyViewed: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.index({ email: 1,});
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ "addresses.isDefault": 1 });
 

userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual("isLocked").get(function () {
  return this.lockUntil && this.lockUntil > Date.now();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();  
    this.password = await bcrypt.hash(this.password, 12);
    if (!this.isNew) {
        this.passwordChangedAt = Date.now()-1000;
    }
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
}

userSchema.methods.createPasswordResetToken = function (JWTTimestamp) {
    if(this.passwordChangedAt) {
        const changedTimestamp = parseInt(
            this.passwordChangedAt.getTime() / 1000, 10)
            return JWTTimestamp < changedTimestamp;
    }
    return false;
}

//password reset token generation
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
    this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    return resetToken;
};

//email verification token generation
userSchema.methods.createEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString("hex");
  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return verificationToken;
};


//instacemethod to hanle failed login attempts
userSchema.methods.incrementLoginAttempts = function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
        $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1,},
    });
  }
    const updates = { $inc: { loginAttempts: 1 } };
    const maxAttempts = 5; 
    if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked ) {
        updates.$set = { lockUntil: Date.now() + 2 * 60 * 1000 }; 
    }
    return this.updateOne(updates);
}

//instance method to reset login attempts
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $unset: { lockUntil: 1,loginAttempts: 1 }
    });
};

userSchema.statics.findByCredentials = async function (email, password) {
  const user = await this.findOne({ email, isAccountActive: true }).select("+password");

  
  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (user.isLocked) {
    throw new Error("Account is locked. Please try again later.");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    await user.incrementLoginAttempts();
    throw new Error("Invalid email or password");
  }

  if (user.loginAttempts > 0) {
    await user.resetLoginAttempts();
  }

  user.lastLogin = new Date();
  await user.save();

  return user;
};

module.exports = mongoose.model("User", userSchema);