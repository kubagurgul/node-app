const express = require('express');
const winston = require('winston');

const app = express();
const PORT = process.env.PORT || 3000; // Fixed: use || instead of |

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({timestamp, level, message}) =>
          `${timestamp} [${level.toUpperCase()}]: ${message}`
      )
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({filename: 'webhook-logs.log'})
  ],
});

// Constants
const EVENT_TYPES = {
  CLIENT_VISIT_STATUS: 'event.client_visit.status',
  PAYMENT_STATUS: 'event.shopping_cart.payment_status',
  CLIENT_CREATED: 'event.client.created'
};

const VISIT_STATUS = {
  0: '📅 BOOKED',
  1: '✅ CHECKED IN',
  2: '🎯 COMPLETED'
};

const PAYMENT_STATUS = {
  0: '💳 PAYMENT INITIATED',
  1: '✅ PAYMENT COMPLETED'
};

// Middleware
app.use(express.json({limit: '10mb'})); // Built-in body parser, no need for body-parser package
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Routes
app.post('/test/webhook', validateWebhook, (req, res) => {
  try {
    const webhookData = req.body;

    if (!Array.isArray(webhookData)) {
      return res.status(400).json({error: 'Invalid webhook data format'});
    }

    logger.info(`Processing ${webhookData.length} webhook event(s)`);

    webhookData.forEach(event => {
      if (event.event && event.data) {
        logEvent(event.event, event.data, event.firedAt);
      } else {
        logger.warn('Invalid event structure received:', JSON.stringify(event));
      }
    });

    res.status(200).json({
      status: 'success',
      processed: webhookData.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Webhook processing error:', error.message);
    res.status(500).json({error: 'Internal server error'});
  }
});

app.get('/test/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Middleware for webhook validation
function validateWebhook(req, res, next) {
  const contentType = req.get('Content-Type');

  if (!contentType || !contentType.includes('application/json')) {
    return res.status(400).json(
        {error: 'Content-Type must be application/json'});
  }

  if (!req.body) {
    return res.status(400).json({error: 'Request body is required'});
  }

  next();
}

// Event logging functions
function logEvent(event, data, firedAt) {
  if (firedAt) {
    const timestamp = new Date(firedAt).toLocaleString();
    logger.info(`⏰ Event fired at: ${timestamp}`);
  }

  switch (event) {
    case EVENT_TYPES.CLIENT_VISIT_STATUS:
      logClientVisitStatus(data);
      break;
    case EVENT_TYPES.PAYMENT_STATUS:
      logPaymentStatus(data);
      break;
    case EVENT_TYPES.CLIENT_CREATED:
      logClientCreated(data);
      break;
    default:
      logger.info(`🔍 Unknown event received: ${event}`);
  }

  logger.info('─'.repeat(50)); // Separator for readability
}

function logClientVisitStatus(data) {
  if (!Array.isArray(data) || data.length === 0) {
    logger.warn('Invalid client visit status data received');
    return;
  }

  const visitData = data[0];
  const client = visitData.client?.user;
  const clientName = `${client?.firstName || 'Unknown'} ${client?.lastName
  || 'User'}`;
  const serviceName = visitData.scheduleEvent?.scheduleMeta?.classService?.name
      || 'Unknown Service';

  let startTime = 'Unknown time';
  if (visitData.scheduleEvent?.startsAt) {
    try {
      startTime = new Date(visitData.scheduleEvent.startsAt).toLocaleString();
    } catch (error) {
      logger.warn('Invalid date format for startTime');
    }
  }

  const status = VISIT_STATUS[visitData.status]
      || `❓ Status ${visitData.status}`;
  const pricingOption = visitData.clientPricingOption?.qualifiedName
      || 'No pricing info';
  const remainingVisits = visitData.clientPricingOption?.remain;

  logger.info(`${status} - ${clientName} for "${serviceName}" at ${startTime}`);
  logger.info(`💳 Package: ${pricingOption}${remainingVisits !== undefined
      ? ` (${remainingVisits} remaining)` : ''}`);

  if (visitData.isOnWaitingList) {
    logger.info(`⏳ Position on waiting list: ${visitData.waitingListPosition
    || 'Unknown'}`);
  }
}

function logPaymentStatus(data) {
  if (!data || typeof data !== 'object') {
    logger.warn('Invalid payment status data received');
    return;
  }

  const user = data.user;
  const userName = `${user?.firstName || 'Unknown'} ${user?.lastName
  || 'User'}`;
  const email = user?.emailAddress || 'No email';
  const orderId = data.orderId || 'No order ID';
  const gateway = data.paymentGateway || 'Unknown gateway';

  const status = PAYMENT_STATUS[data.orderStatus]
      || `❓ Payment Status ${data.orderStatus}`;

  logger.info(`${status} - ${userName} (${email})`);
  logger.info(`🏦 Gateway: ${gateway} | Order ID: ${orderId}`);

  if (data.purchase && data.orderStatus === 1) {
    const totalPrice = formatPrice(data.purchase.totalPrice);
    const currency = data.purchase.currency || 'PLN';

    const items = data.purchase.items?.map(item =>
        `${item.name} (${formatPrice(item.price)} ${currency})`
    ).join(', ') || 'No items';

    logger.info(`💰 Total: ${totalPrice} ${currency} | Items: ${items}`);

    if (data.purchase.discountAmount > 0) {
      const discount = formatPrice(data.purchase.discountAmount);
      logger.info(`🎁 Discount applied: ${discount} ${currency}`);
    }
  }
}

function logClientCreated(data) {
  if (!data || typeof data !== 'object') {
    logger.warn('Invalid client created data received');
    return;
  }

  const clientName = `${data.firstName || 'Unknown'} ${data.lastName
  || 'User'}`;
  const email = data.emailAddress || 'No email';
  const phone = data.client?.phone?.primaryPhone || 'No phone';
  const clientUuid = data.client?.uuid || 'No UUID';

  logger.info(`👋 NEW CLIENT REGISTERED - ${clientName}`);
  logger.info(`📧 Email: ${email} | 📱 Phone: ${phone}`);
  logger.info(`🆔 Client ID: ${clientUuid}`);

  // Log agreements
  const agreements = data.client?.agreements;
  if (agreements) {
    const agreedTerms = [];
    if (agreements.termsOfUse) {
      agreedTerms.push('Terms of Use');
    }
    if (agreements.privacyPolicy) {
      agreedTerms.push('Privacy Policy');
    }
    if (agreements.newsletter) {
      agreedTerms.push('Newsletter');
    }

    logger.info(`📋 Agreements: ${agreedTerms.join(', ') || 'None'}`);
  }
}

// Utility functions
function formatPrice(priceInCents) {
  if (typeof priceInCents !== 'number') {
    return '0.00';
  }
  return (priceInCents / 100).toFixed(2);
}

// Error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Webhook server listening on port ${PORT}`);
  logger.info(`📍 Health check available at http://localhost:${PORT}/health`);
});
