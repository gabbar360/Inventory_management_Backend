const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { PrismaClient } = require('@prisma/client');

const { app, loadRoutes } = require('./app');
const { errorHandler, notFound } = require('./middleware/error');

const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();

// Trust proxy for deployment
app.set('trust proxy', 1);

// Parse allowed origins from environment variables
const getAllowedOrigins = () => {
  const origins = [];

  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }

  if (process.env.ALLOWED_ORIGINS) {
    const envOrigins = process.env.ALLOWED_ORIGINS.split(',').map((origin) =>
      origin.trim()
    );
    origins.push(...envOrigins);
  }

  origins.push(
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5000'
  );

  return [...new Set(origins)];
};

const allowedOrigins = getAllowedOrigins();

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Cache-Control',
      'X-File-Name',
    ],
    exposedHeaders: ['Authorization', 'Content-Disposition'],
    preflightContinue: false,
    optionsSuccessStatus: 200,
    maxAge: 86400,
  })
);

app.use(compression());
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use('/uploads', cors(), express.static('uploads'));
app.use('/public', express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Start server
const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Add auth routes first (public)
    const authRoute = require('./routes/authRoutes');
    app.use('/api/v1/auth', authRoute);

    // Load all other routes
    await loadRoutes();

    app.use(notFound);
    app.use(errorHandler);

    // Create HTTP server
    const server = createServer(app);
    httpServer = server;

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api/v1`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.log('💡 Try: pkill -f "node.*index.js" or use different port');
        process.exit(1);
      } else {
        console.error('❌ Server error:', err);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Store server reference for graceful shutdown
let httpServer = null;

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received, shutting down gracefully`);

  if (httpServer) {
    httpServer.close(() => {
      console.log('HTTP server closed');
    });
  }

  await prisma.$disconnect();
  console.log('Database disconnected');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

startServer();