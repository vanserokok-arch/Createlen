# OpenAI Landing Generator

Автоматическая генерация лендингов с помощью OpenAI API и GitHub Actions.

## Архитектура

```
scripts/openai/landing_agent.js  → Основной скрипт генерации
specs/landing-spec.json          → Спецификация лендинга
landing/                         → Выходная папка с результатами
  ├── index.html                 → Сгенерированный HTML
  ├── styles.css                 → Сгенерированные стили
  ├── script.js                  → Сгенерированный JavaScript
  └── BUILD_LOG.md               → Лог процесса генерации
```

## Использование

### 1. Через GitHub Actions (рекомендуется)

1. Перейти в **Actions** → **OpenAI Landing Generator**
2. Нажать **Run workflow**
3. Ввести описание лендинга в поле `spec`
4. Нажать **Run workflow**
5. Дождаться завершения (обычно 1-2 минуты)
6. Результаты будут в ветке `copilot/landing-autogen`

### 2. Локально

```bash
# Установить зависимости
npm ci

# Создать/обновить specs/landing-spec.json с вашей спецификацией

# Экспортировать OPENAI_API_KEY
export OPENAI_API_KEY="sk-..."

# Запустить генерацию
node scripts/openai/landing_agent.js

# Проверить результаты
ls -la landing/
```

## Спецификация лендинга

Файл `specs/landing-spec.json` определяет структуру лендинга:

```json
{
  "title": "Название проекта",
  "description": "Описание лендинга",
  "sections": [
    {
      "type": "hero",
      "heading": "Заголовок",
      "subheading": "Подзаголовок",
      "cta": "Текст кнопки"
    },
    {
      "type": "features",
      "heading": "Возможности",
      "items": [
        {
          "title": "Фича 1",
          "description": "Описание фичи"
        }
      ]
    }
  ],
  "colors": {
    "primary": "#4F46E5",
    "secondary": "#10B981",
    "background": "#FFFFFF",
    "text": "#1F2937"
  }
}
```

## Безопасность

- ✅ `OPENAI_API_KEY` передаётся только через GitHub Secrets
- ✅ Ключ никогда не логируется и не попадает в файлы
- ✅ Все коммиты атомарные и содержат понятные сообщения
- ✅ API ошибки обрабатываются с повторными попытками

## Обработка ошибок

Скрипт автоматически:
- Повторяет запросы к OpenAI до 3 раз при ошибках
- Использует экспоненциальную задержку между попытками
- Логирует все ошибки в `landing/BUILD_LOG.md`
- Завершается с кодом 1 при критических ошибках

## Workflow

Workflow `.github/workflows/openai-landing.yml` выполняет:

1. ✅ Checkout репозитория
2. ✅ Настройка Node.js 18
3. ✅ Установка зависимостей
4. ✅ Обновление `specs/landing-spec.json` на основе ввода
5. ✅ Генерация лендинга через OpenAI API
6. ✅ Коммит и push в ветку `copilot/landing-autogen`
7. ✅ Создание summary с результатами

## Требования

- Node.js >= 18
- GitHub Secret: `OPENAI_API_KEY`
- GitHub Secret: `REPO_PUSH_TOKEN` (для push)

## Примеры использования

### Простой лендинг

```bash
Spec: "Лендинг для SaaS продукта управления проектами"
```

### Детальная спецификация

Отредактировать `specs/landing-spec.json` вручную перед запуском для полного контроля.

## Отладка

Все логи доступны в:
- GitHub Actions → Job logs
- `landing/BUILD_LOG.md` (создаётся автоматически)

## Roadmap

- [ ] Поддержка разных LLM моделей (GPT-3.5, GPT-4, Claude)
- [ ] Генерация изображений через DALL-E
- [ ] A/B тестирование разных вариантов
- [ ] Автоматический деплой на GitHub Pages
