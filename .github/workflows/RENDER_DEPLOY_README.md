# Render Deploy Workflow

Автоматический деплой сгенерированных лендингов на Render.

## Описание

Workflow `.github/workflows/render-deploy.yml` автоматически деплоит лендинги на Render после их генерации.

## Триггеры

1. **workflow_dispatch** - Ручной запуск из вкладки Actions
   - Опциональный параметр `service_id` (если нужно переопределить)

2. **push на ветку copilot/landing-autogen** - Автоматический запуск после генерации лендинга

## Требуемые секреты

В Settings → Secrets → Actions нужно добавить:

1. **RENDER_API_KEY** (обязательно)
   - API ключ от Render
   - Получить: https://dashboard.render.com/u/settings → API Keys

2. **RENDER_SERVICE_ID** (обязательно)
   - ID сервиса на Render для деплоя
   - Формат: `srv-xxxxxxxxxxxxxxxxxxxxx`
   - Найти: https://dashboard.render.com → выбрать сервис → Settings → Service ID

3. **REPO_PUSH_TOKEN** (уже настроен)
   - Используется для коммита DEPLOY_LOG.md

## Как работает

### Шаг 1: Проверка файлов
Проверяет наличие `landing/index.html` - если файла нет, деплой пропускается.

### Шаг 2: Вызов Render API
```bash
curl -X POST "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": false}'
```

### Шаг 3: Создание лога
Создаёт файл `landing/DEPLOY_LOG.md` с информацией о деплое:
- Timestamp
- Deploy ID
- Статус (success/failed/skipped)
- Конфигурация

### Шаг 4: Коммит лога
Автоматически коммитит `DEPLOY_LOG.md` в ветку.

## Использование

### Автоматический деплой
После того как workflow `openai-landing.yml` создаст лендинг и запушит в `copilot/landing-autogen`, этот workflow запустится автоматически.

### Ручной запуск
1. Перейти в Actions → Render Deploy
2. Нажать "Run workflow"
3. Выбрать ветку `copilot/landing-autogen`
4. (Опционально) Указать service_id
5. Нажать "Run workflow"

## Проверка статуса

После запуска:
1. Смотреть логи workflow в GitHub Actions
2. Проверить `landing/DEPLOY_LOG.md` в ветке
3. Зайти на https://dashboard.render.com для подробного статуса

## Безопасность

- ✅ `RENDER_API_KEY` никогда не логируется (маскируется как `******`)
- ✅ Все секреты передаются через GitHub Secrets
- ✅ Workflow не падает при отсутствии секретов (пропускается с предупреждением)

## Отладка

### Deploy пропускается
**Причина:** Нет `landing/index.html`  
**Решение:** Сначала запустить `openai-landing.yml` workflow

### Deploy failed
**Причина:** Неверный `RENDER_API_KEY` или `RENDER_SERVICE_ID`  
**Решение:** Проверить секреты в Settings → Secrets

### 401 Unauthorized
**Причина:** Неверный или истёкший API ключ  
**Решение:** Сгенерировать новый ключ на https://dashboard.render.com/u/settings

### 404 Not Found
**Причина:** Неверный `RENDER_SERVICE_ID`  
**Решение:** Проверить ID в настройках сервиса на Render

## Пример лога

```markdown
# Render Deploy Log

**Timestamp:** 2025-11-15 23:45:00 UTC
**Branch:** copilot/landing-autogen
**Commit:** abc123...
**Triggered by:** push

## Deploy Status

- **Status:** success
- **Message:** Deploy triggered successfully (ID: dep-xyz789)
- **Deploy ID:** dep-xyz789

## Configuration

- **Service ID:** srv-abc123
- **API Key:** ✅ Configured
```

## Интеграция с OpenAI Landing Generator

Полный цикл генерации и деплоя:

1. **Запуск генерации:** Actions → OpenAI Landing Generator
2. **Генерация лендинга:** OpenAI создаёт HTML/CSS/JS
3. **Коммит:** Результаты пушатся в `copilot/landing-autogen`
4. **Автоматический деплой:** Этот workflow запускается автоматически
5. **Лог деплоя:** `DEPLOY_LOG.md` коммитится обратно
6. **Результат:** Лендинг доступен на Render

## Roadmap

- [ ] Добавить проверку статуса деплоя (polling)
- [ ] Интеграция с GitHub Deployments API
- [ ] Поддержка preview deploys
- [ ] Автоматический откат при ошибках
- [ ] Slack/Discord уведомления
