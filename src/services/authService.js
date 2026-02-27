const { calculatePagination, generateCode } = require("../utils/helpers");
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const emailService = require('./emailService');
const { generateAccessToken, generateRefreshToken, hashToken } = require('../utils/tokenUtils');

const prisma = new PrismaClient();

class AuthService {
  static async register(email, password, name, deviceInfo, ipAddress) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new Error('User already exists');

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();
    const hashedRefreshToken = hashToken(refreshToken);

    await prisma.refreshToken.create({
      data: {
        token: hashedRefreshToken,
        userId: user.id,
        deviceInfo,
        ipAddress,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    return { user, accessToken, refreshToken };
  }

  static async login(email, password, deviceInfo, ipAddress) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('Invalid credentials');

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) throw new Error('Invalid credentials');

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();
    const hashedRefreshToken = hashToken(refreshToken);

    await prisma.refreshToken.create({
      data: {
        token: hashedRefreshToken,
        userId: user.id,
        deviceInfo,
        ipAddress,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    return {
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
      accessToken,
      refreshToken,
    };
  }

  static async refreshAccessToken(refreshToken) {
    const hashedToken = hashToken(refreshToken);
    
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      if (tokenRecord) await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
      throw new Error('Invalid or expired refresh token');
    }

    // Cleanup expired tokens for this user (passive cleanup)
    await prisma.refreshToken.deleteMany({
      where: {
        userId: tokenRecord.userId,
        expiresAt: { lt: new Date() },
      },
    });

    // Token rotation: Delete old token
    await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });

    // Generate new tokens
    const newAccessToken = generateAccessToken(tokenRecord.userId);
    const newRefreshToken = generateRefreshToken();
    const newHashedRefreshToken = hashToken(newRefreshToken);

    await prisma.refreshToken.create({
      data: {
        token: newHashedRefreshToken,
        userId: tokenRecord.userId,
        deviceInfo: tokenRecord.deviceInfo,
        ipAddress: tokenRecord.ipAddress,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken, user: tokenRecord.user };
  }

  static async logout(refreshToken) {
    const hashedToken = hashToken(refreshToken);
    await prisma.refreshToken.deleteMany({ where: { token: hashedToken } });
  }

  static async logoutAllDevices(userId) {
    await prisma.refreshToken.deleteMany({ where: { userId } });
  }

  static async verifyToken(accessToken) {
    const { verifyAccessToken } = require('../utils/tokenUtils');
    const decoded = verifyAccessToken(accessToken);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) throw new Error('User not found');
    return { valid: true, user };
  }

  static async updateProfile(userId, { name, email }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      throw new Error('User not found');
    }

    if (email && email !== user.email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new Error('Email already in use');
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    return updatedUser;
  }

  static async forgotPassword(email) {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      // Security: Don't reveal if email exists
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiry,
      },
    });

    try {
      await emailService.sendPasswordResetEmail(user.email, user.name, resetToken);
    } catch (error) {
      console.error('Email send failed:', error);
      // Rollback token if email fails
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: null, resetTokenExpiry: null },
      });
      throw new Error('Failed to send reset email');
    }

    return { message: 'If the email exists, a reset link has been sent' };
  }

  static async resetPassword(token, newPassword) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) throw new Error('Invalid or expired reset token');

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Logout from all devices on password reset
    await this.logoutAllDevices(user.id);

    return { message: 'Password reset successful' };
  }
}
module.exports = { AuthService };
