import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Middleware для raw body (нужно для проверки подписи)
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

/**
 * Проверка подписи GitHub webhook
 * @param {string} signature - Подпись из заголовка X-Hub-Signature-256
 * @param {Buffer} body - Тело запроса
 * @returns {boolean}
 */
function verifySignature(signature, body) {
  if (!WEBHOOK_SECRET) {
    console.error('WEBHOOK_SECRET не настроен');
    return false;
  }

  if (!signature) {
    console.error('Подпись отсутствует');
    return false;
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(body).digest('hex');
  
  // Используем crypto.timingSafeEqual для защиты от timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  } catch (error) {
    return false;
  }
}

/**
 * Обработчик webhook событий
 */
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  const deliveryId = req.headers['x-github-delivery'];

  console.log(`[${new Date().toISOString()}] Получен webhook: event=${event}, delivery=${deliveryId}`);

  // Проверка подписи
  if (!verifySignature(signature, req.body)) {
    console.error('Неверная подпись webhook');
    return res.status(401).json({ error: 'Неверная подпись' });
  }

  // Парсинг тела запроса
  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch (error) {
    console.error('Ошибка парсинга JSON:', error);
    return res.status(400).json({ error: 'Неверный JSON' });
  }

  // Обработка различных типов событий
  switch (event) {
    case 'ping':
      console.log('Получено ping событие от GitHub');
      return res.status(200).json({ message: 'pong' });

    case 'push':
      console.log(`Push в ${payload.repository?.full_name}, ref: ${payload.ref}`);
      console.log(`Автор: ${payload.pusher?.name}, коммитов: ${payload.commits?.length || 0}`);
      break;

    case 'pull_request':
      console.log(
        `Pull Request ${payload.action}: #${payload.number} в ${payload.repository?.full_name}`
      );
      console.log(`Заголовок: ${payload.pull_request?.title}`);
      break;

    case 'issues':
      console.log(
        `Issue ${payload.action}: #${payload.issue?.number} в ${payload.repository?.full_name}`
      );
      break;

    case 'installation':
    case 'installation_repositories':
      console.log(`GitHub App installation событие: ${payload.action}`);
      break;

    default:
      console.log(`Необработанное событие: ${event}`);
  }

  // Здесь можно добавить дополнительную логику обработки
  // Например, запуск CI/CD, отправка уведомлений и т.д.

  res.status(200).json({ 
    message: 'Webhook получен и обработан',
    event,
    deliveryId 
  });
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    webhookSecretConfigured: !!WEBHOOK_SECRET
  });
});

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'Createlen Webhook Handler',
    version: '1.0.0',
    endpoints: {
      webhook: 'POST /webhook',
      health: 'GET /health'
    }
  });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Createlen Webhook Handler запущен на порту ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
  
  if (!WEBHOOK_SECRET) {
    console.warn('⚠️  ПРЕДУПРЕЖДЕНИЕ: WEBHOOK_SECRET не настроен!');
  } else {
    console.log('✓ WEBHOOK_SECRET настроен');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Получен SIGTERM, завершение работы...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Получен SIGINT, завершение работы...');
  process.exit(0);
});
