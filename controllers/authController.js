const crypto = require('crypto');
const JWTUtils = require('../utils/JWTUtils');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const sendEmail = require('../utils/sendEmail');

// Register
const register = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const {
            firstName,
            lastName,
            email,
            password,
            phone,
            role,
            businessName,
            businessDescription,
            businessCategory,
            getNumber,
            bankDetails
        } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        // Construct user object
        const userObj = {
            firstName,
            lastName,
            email,
            password,
            phone,
            role: role || 'customer',
            avatar: {
                public_id: 'default_avatar',
                url: 'https://res.cloudinary.com/default/image/upload/v1234567890/default-avatar.png'
            }
        };

        // Add vendor-specific fields
        if (role === 'vendor') {
            userObj.businessName = businessName;
            userObj.businessDescription = businessDescription;
            userObj.businessCategory = businessCategory;
            userObj.getNumber = getNumber;
            userObj.bankDetails = bankDetails;
        }

        const user = await User.create(userObj);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    avatar: user.avatar,
                    isEmailVerified: user.isEmailVerified,
                    isAccountActive: user.isAccountActive,
                    ...(user.role === 'vendor' && {
                        businessName: user.businessName,
                        businessDescription: user.businessDescription,
                        businessCategory: user.businessCategory,
                        getNumber: user.getNumber,
                        bankDetails: user.bankDetails
                    })
                }
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

// Login
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    try {
      // Attempt login
      const user = await User.findByCredentials(email, password);

      // Generate tokens
      const { accessToken, refreshToken: refreshTokenValue } = JWTUtils.generateTokens({
        id: user._id,
        role: user.role,
        email: user.email,
      });

      // Set access token in cookies for frontend
      res.cookie('token', accessToken, {
        httpOnly: false, // Allow frontend to access this
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      // Set refresh token in cookies
      res.cookie('refreshToken', refreshTokenValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Return response with ALL required fields
      return res.status(200).json({
        success: true,
        message: 'User logged in successfully',
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            avatar: user.avatar,
            isEmailVerified: user.isEmailVerified,
            isAccountActive: user.isAccountActive, // CRITICAL: Include this field
            ...(user.role === 'vendor' && {
              businessName: user.businessName,
              businessDescription: user.businessDescription,
              businessCategory: user.businessCategory,
              getNumber: user.getNumber,
              bankDetails: user.bankDetails,
            }),
          },
          accessToken,
        },
      });
    } catch (err) {
      // Log the actual issue for development/debug
      console.error('[Login Error]', err.message);

      return res.status(401).json({
        success: false,
        message: err.message || 'Invalid email or password',
      });
    }
  } catch (error) {
    console.error('[Server Error]', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// Refresh Token
const refreshAccessToken = async (req, res) => {
    try {
        const { refreshToken: refreshTokenValue } = req.cookies;
        if (!refreshTokenValue) {
            return res.status(401).json({
                success: false,
                message: 'No refresh token provided, please login again'
            });
        }

        try {
            const decoded = JWTUtils.verifyRefreshToken(refreshTokenValue);
            const user = await User.findById(decoded.id).select('-password');
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found, please login again'
                });
            }

            if (!user.isAccountActive) {
                return res.status(403).json({
                    success: false,
                    message: 'User is not active'
                });
            }

            const { accessToken } = JWTUtils.generateTokens({
                id: user._id,
                role: user.role,
                email: user.email
            });

            res.status(200).json({
                success: true,
                message: 'Access token refreshed successfully',
                data: {
                    accessToken
                }
            });

        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token, please login again'
            });
        }

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Logout
const logout = async (req, res) => {
    res.cookie('token', '', {
        httpOnly: false,
        expires: new Date(0),
        secure: process.env.NODE_ENV === 'production'
    });

    res.cookie('refreshToken', '', {
        httpOnly: true,
        expires: new Date(0),
        secure: process.env.NODE_ENV === 'production'
    });

    res.status(200).json({
        success: true,
        message: 'User logged out successfully'
    });
};

// Verify Email
const verifyEmail = async (req, res) => {
    try {
        const hashedToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const user = await User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification token'
            });
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Email verified successfully',
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Forgot Password
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const resetToken = user.createPasswordResetToken();
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;
        const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl} \n\n If you did not request this, please ignore this email and your password will remain unchanged.
        
This link will expire in 10 minutes.`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Password Reset Request',
                text: message,
            });

            res.status(200).json({
                success: true,
                message: 'Password reset link sent to your email',
            });

        } catch (error) {
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save({ validateBeforeSave: false });

            return res.status(500).json({
                success: false,
                message: 'Error sending password reset email, please try again later',
                error: error.message
            });
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Reset Password
const resetPassword = async (req, res) => {
    try {
        const hashedToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired password reset token'
            });
        }

        user.password = req.body.password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        const { accessToken, refreshToken: refreshTokenValue } = JWTUtils.generateTokens({
            id: user._id,
            role: user.role,
            email: user.email
        });

        res.cookie('refreshToken', refreshTokenValue, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({
            success: true,
            message: 'Password reset successfully',
            data: { accessToken }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Get current user
const getMe = async (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            user: {
                id: req.user._id,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                email: req.user.email,
                phone: req.user.phone,
                role: req.user.role,
                avatar: req.user.avatar,
                isEmailVerified: req.user.isEmailVerified,
                isAccountActive: req.user.isAccountActive,
                ...(req.user.role === 'vendor' && {
                    businessName: req.user.businessName,
                    businessDescription: req.user.businessDescription,
                    businessCategory: req.user.businessCategory,
                    getNumber: req.user.getNumber,
                    bankDetails: req.user.bankDetails
                })
            }
        }
    });
};

module.exports = {
    register,
    login,
    refreshAccessToken,
    logout,
    verifyEmail,
    forgotPassword,
    resetPassword,
    getMe
};