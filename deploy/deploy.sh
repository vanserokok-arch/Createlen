#!/bin/bash
set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Createlen Webhook Deploy Script ===${NC}"

# Проверка запуска с правами root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Этот скрипт должен быть запущен с правами root (sudo)${NC}"
    exit 1
fi

# Получение домена из аргументов
DOMAIN=$1
if [ -z "$DOMAIN" ]; then
    echo -e "${YELLOW}Использование: $0 <domain>${NC}"
    echo -e "${YELLOW}Пример: $0 webhook.example.com${NC}"
    exit 1
fi

echo -e "${GREEN}Домен: $DOMAIN${NC}"

# Проверка существования .env файла
if [ ! -f /etc/createlen/.env ]; then
    echo -e "${RED}Ошибка: Файл /etc/createlen/.env не найден${NC}"
    echo -e "${YELLOW}Пожалуйста, создайте файл /etc/createlen/.env с необходимыми переменными:${NC}"
    echo "  WEBHOOK_SECRET=..."
    echo "  GITHUB_APP_ID=..."
    echo "  GITHUB_APP_INSTALLATION_ID=..."
    echo "  GITHUB_APP_PRIVATE_KEY_PATH=/etc/createlen/github-app-private-key.pem"
    echo "  PORT=3000"
    exit 1
fi

# Создание директории для приложения
APP_DIR="/opt/createlen"
echo -e "${GREEN}Создание директории приложения: $APP_DIR${NC}"
mkdir -p $APP_DIR

# Копирование файлов (предполагается что скрипт запускается из корня репозитория)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

echo -e "${GREEN}Копирование файлов приложения...${NC}"
cp -r $REPO_DIR/webhook $APP_DIR/
cp -r $REPO_DIR/node_modules $APP_DIR/ 2>/dev/null || echo -e "${YELLOW}node_modules не найден, будет установлен позже${NC}"
cp $REPO_DIR/package*.json $APP_DIR/

# Установка зависимостей если нужно
cd $APP_DIR
if [ ! -d "node_modules" ]; then
    echo -e "${GREEN}Установка npm зависимостей...${NC}"
    npm ci --production
fi

# Права доступа
echo -e "${GREEN}Настройка прав доступа...${NC}"
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR

# Установка systemd сервиса
echo -e "${GREEN}Установка systemd сервиса...${NC}"
cp $REPO_DIR/deploy/createlen-webhook.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable createlen-webhook

# Перезапуск сервиса
echo -e "${GREEN}Запуск/перезапуск сервиса...${NC}"
systemctl restart createlen-webhook
sleep 2

# Проверка статуса сервиса
if systemctl is-active --quiet createlen-webhook; then
    echo -e "${GREEN}✓ Сервис запущен успешно${NC}"
    systemctl status createlen-webhook --no-pager -l
else
    echo -e "${RED}✗ Ошибка запуска сервиса${NC}"
    journalctl -u createlen-webhook -n 20 --no-pager
    exit 1
fi

# Настройка Nginx
echo -e "${GREEN}Настройка Nginx...${NC}"

# Обновление конфигурации с доменом
NGINX_CONF="/etc/nginx/sites-available/createlen"
cp $REPO_DIR/deploy/nginx.createlen.conf $NGINX_CONF
sed -i "s/server_name _;/server_name $DOMAIN;/" $NGINX_CONF

# Создание симлинка
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/createlen

# Проверка конфигурации Nginx
echo -e "${GREEN}Проверка конфигурации Nginx...${NC}"
if nginx -t; then
    echo -e "${GREEN}✓ Конфигурация Nginx корректна${NC}"
    systemctl reload nginx
    echo -e "${GREEN}✓ Nginx перезагружен${NC}"
else
    echo -e "${RED}✗ Ошибка в конфигурации Nginx${NC}"
    exit 1
fi

# Проверка работы приложения
echo -e "${GREEN}Проверка health endpoint...${NC}"
sleep 2
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Health check успешен${NC}"
else
    echo -e "${YELLOW}⚠ Health check не прошёл, проверьте логи${NC}"
fi

# Настройка SSL с Certbot
echo -e "${YELLOW}=== Настройка SSL ===${NC}"
echo -e "${YELLOW}ВНИМАНИЕ: Перед запуском certbot убедитесь что:${NC}"
echo -e "${YELLOW}  1. DNS записи для $DOMAIN указывают на этот сервер${NC}"
echo -e "${YELLOW}  2. Порты 80 и 443 открыты в файерволле${NC}"
echo -e "${YELLOW}  3. Nginx работает и доступен по HTTP${NC}"
echo ""

read -p "Продолжить настройку SSL с certbot? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Проверка установки certbot
    if ! command -v certbot &> /dev/null; then
        echo -e "${GREEN}Установка certbot...${NC}"
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    fi

    # Получение сертификата
    echo -e "${GREEN}Получение SSL сертификата...${NC}"
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || {
        echo -e "${YELLOW}⚠ Не удалось получить сертификат автоматически${NC}"
        echo -e "${YELLOW}Попробуйте запустить вручную: sudo certbot --nginx -d $DOMAIN${NC}"
    }
else
    echo -e "${YELLOW}Пропуск настройки SSL. Запустите вручную:${NC}"
    echo -e "${YELLOW}  sudo certbot --nginx -d $DOMAIN${NC}"
fi

echo ""
echo -e "${GREEN}=== Развёртывание завершено ===${NC}"
echo ""
echo -e "${GREEN}Полезные команды:${NC}"
echo "  Статус сервиса:    systemctl status createlen-webhook"
echo "  Логи сервиса:      journalctl -u createlen-webhook -f"
echo "  Перезапуск:        systemctl restart createlen-webhook"
echo "  Проверка Nginx:    nginx -t"
echo "  Перезагрузка Nginx: systemctl reload nginx"
echo ""
echo -e "${GREEN}Endpoints:${NC}"
echo "  Health:   http://$DOMAIN/health"
echo "  Webhook:  http://$DOMAIN/webhook"
echo ""
echo -e "${YELLOW}Следующие шаги:${NC}"
echo "  1. Проверьте логи: journalctl -u createlen-webhook -f"
echo "  2. Настройте webhook URL в GitHub App: http://$DOMAIN/webhook (или https://)"
echo "  3. Отправьте тестовый webhook из GitHub"
echo ""
