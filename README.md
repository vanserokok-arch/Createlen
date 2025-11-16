# Createlen

Сервис для автоматической обработки webhook событий от GitHub и развёртывания приложений.

## Настройка Webhook

### 1. Генерация WEBHOOK_SECRET

Для безопасной проверки подписи webhook используйте следующую команду:

```bash
openssl rand -hex 32
```

Сохраните полученное значение — оно понадобится для настройки GitHub App и сервера.

### 2. Размещение приватного ключа GitHub App

1. Создайте директорию для конфигурации:
   ```bash
   sudo mkdir -p /etc/createlen
   sudo chmod 700 /etc/createlen
   ```

2. Скопируйте приватный ключ GitHub App:
   ```bash
   sudo cp your-app-private-key.pem /etc/createlen/github-app-private-key.pem
   sudo chmod 600 /etc/createlen/github-app-private-key.pem
   ```

3. Создайте файл с переменными окружения:
   ```bash
   sudo nano /etc/createlen/.env
   ```

   Добавьте следующие переменные:
   ```
   WEBHOOK_SECRET=ваш_сгенерированный_секрет
   GITHUB_APP_ID=ваш_app_id
   GITHUB_APP_INSTALLATION_ID=ваш_installation_id
   GITHUB_APP_PRIVATE_KEY_PATH=/etc/createlen/github-app-private-key.pem
   PORT=3000
   ```

### 3. Получение Installation ID

1. Перейдите на страницу установленных приложений в вашей организации/аккаунте
2. Откройте нужное приложение
3. Installation ID находится в URL: `https://github.com/settings/installations/{INSTALLATION_ID}`

### 4. Пошаговое тестирование webhook

#### Локальное тестирование

```bash
# Запуск сервиса локально
npm install
npm start

# В другом терминале отправьте тестовый запрос
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$(echo -n '{}' | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | cut -d' ' -f2)" \
  -d '{}'
```

#### Тестирование через GitHub (Send test webhook)

1. Откройте настройки вашего GitHub App
2. Перейдите в раздел "Advanced" → "Recent Deliveries"
3. Нажмите "Redeliver" на любом событии или используйте "Send test webhook"
4. Проверьте логи сервиса для подтверждения получения события

### 5. Systemd и Nginx команды

#### Установка и управление systemd сервисом

```bash
# Копирование unit файла
sudo cp deploy/createlen-webhook.service /etc/systemd/system/

# Перезагрузка systemd
sudo systemctl daemon-reload

# Включение автозапуска
sudo systemctl enable createlen-webhook

# Запуск сервиса
sudo systemctl start createlen-webhook

# Проверка статуса
sudo systemctl status createlen-webhook

# Просмотр логов
sudo journalctl -u createlen-webhook -f
```

#### Настройка Nginx

```bash
# Копирование конфигурации
sudo cp deploy/nginx.createlen.conf /etc/nginx/sites-available/createlen

# Создание симлинка
sudo ln -s /etc/nginx/sites-available/createlen /etc/nginx/sites-enabled/

# Проверка конфигурации
sudo nginx -t

# Перезагрузка Nginx
sudo systemctl reload nginx
```

#### Настройка SSL с Certbot

```bash
# Установка Certbot (если не установлен)
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com

# Автоматическое обновление (проверка)
sudo certbot renew --dry-run
```

## Развёртывание

Используйте скрипт автоматического развёртывания:

```bash
chmod +x deploy/deploy.sh
sudo ./deploy/deploy.sh your-domain.com
```

Скрипт выполнит:
- Копирование конфигураций systemd и nginx
- Настройку и запуск сервиса
- Настройку Nginx с проверкой конфигурации
- Получение SSL сертификата через Certbot (с подтверждением)

## Before Merging - Чек-лист

Перед мержем PR убедитесь что выполнены все пункты:

- [ ] **Generate WEBHOOK_SECRET**: Сгенерирован секрет командой `openssl rand -hex 32`
- [ ] **Place secrets in /etc/createlen/.env**: Созданы `/etc/createlen/.env` и `/etc/createlen/github-app-private-key.pem` с правильными правами доступа
- [ ] **Update GitHub App webhook**: В настройках GitHub App указан правильный Webhook URL и WEBHOOK_SECRET
- [ ] **Verify HTTPS**: Убедитесь что домен настроен, DNS записи корректны, Nginx работает
- [ ] **Send test webhook**: Отправлен тестовый webhook через GitHub UI ("Recent Deliveries" → "Redeliver")
- [ ] **Verify logs**: Проверены логи сервиса (`journalctl -u createlen-webhook`) на отсутствие ошибок
- [ ] **Health check**: Endpoint `/health` отвечает успешно

## Разработка

```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm start

# Проверка health endpoint
curl http://localhost:3000/health
```

## Структура проекта

```
.
├── webhook/                  # Webhook обработчики
│   └── webhook-handler.js    # Основной обработчик webhook событий
├── deploy/                   # Файлы для развёртывания
│   ├── createlen-webhook.service  # Systemd unit
│   ├── nginx.createlen.conf       # Nginx конфигурация
│   └── deploy.sh                  # Скрипт автоматического развёртывания
├── .github/
│   ├── workflows/            # GitHub Actions
│   └── CODEOWNERS            # Автоматическое назначение ревьюеров
└── server.js                 # Основной сервер (если используется)
```