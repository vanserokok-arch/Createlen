import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Проверка наличия OPENAI_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY не найден в переменных окружения');
  process.exit(1);
}

// Функция для безопасного логирования (без секретов)
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Функция для записи в BUILD_LOG.md
function writeBuildLog(content) {
  const logPath = path.join(__dirname, '../../landing/BUILD_LOG.md');
  const timestamp = new Date().toISOString();
  const logEntry = `\n## ${timestamp}\n\n${content}\n`;
  
  if (fs.existsSync(logPath)) {
    fs.appendFileSync(logPath, logEntry, 'utf8');
  } else {
    fs.writeFileSync(logPath, `# Landing Build Log\n${logEntry}`, 'utf8');
  }
}

// Функция для вызова OpenAI API с повторными попытками
async function callOpenAI(messages, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      log(`Попытка ${attempt}/${retries}: Вызов OpenAI API...`);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: messages,
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      log('✅ Успешный ответ от OpenAI API');
      return data.choices[0].message.content;
      
    } catch (error) {
      log(`❌ Ошибка на попытке ${attempt}: ${error.message}`);
      
      if (attempt === retries) {
        throw new Error(`Не удалось получить ответ от OpenAI после ${retries} попыток: ${error.message}`);
      }
      
      // Экспоненциальная задержка перед повторной попыткой
      const delay = Math.pow(2, attempt) * 1000;
      log(`⏳ Ожидание ${delay}ms перед следующей попыткой...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Основная функция генерации лендинга
async function generateLanding() {
  try {
    log('🚀 Запуск генерации лендинга...');
    writeBuildLog('Начало генерации лендинга');

    // 1. Чтение спецификации
    const specPath = path.join(__dirname, '../../specs/landing-spec.json');
    if (!fs.existsSync(specPath)) {
      throw new Error('Файл specs/landing-spec.json не найден');
    }

    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    log('✅ Спецификация загружена');
    writeBuildLog(`Загружена спецификация: ${spec.title}`);

    // 2. Генерация HTML структуры
    log('📝 Генерация HTML...');
    const htmlPrompt = [
      {
        role: 'system',
        content: 'Ты эксперт по созданию современных landing pages. Создай чистый, семантичный HTML5 код.'
      },
      {
        role: 'user',
        content: `Создай HTML структуру для лендинга на основе спецификации:\n${JSON.stringify(spec, null, 2)}\n\nВерни только HTML код без markdown разметки.`
      }
    ];

    const htmlContent = await callOpenAI(htmlPrompt);
    const cleanHtml = htmlContent.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
    
    const htmlPath = path.join(__dirname, '../../landing/index.html');
    fs.writeFileSync(htmlPath, cleanHtml, 'utf8');
    log('✅ HTML создан');
    writeBuildLog('HTML файл создан: landing/index.html');

    // 3. Генерация CSS
    log('🎨 Генерация CSS...');
    const cssPrompt = [
      {
        role: 'system',
        content: 'Ты эксперт по CSS и современному веб-дизайну. Создай красивые стили с использованием современных CSS техник.'
      },
      {
        role: 'user',
        content: `Создай CSS стили для лендинга на основе спецификации:\n${JSON.stringify(spec, null, 2)}\n\nИспользуй flexbox/grid, сделай адаптивный дизайн. Верни только CSS код без markdown разметки.`
      }
    ];

    const cssContent = await callOpenAI(cssPrompt);
    const cleanCss = cssContent.replace(/```css\n?/g, '').replace(/```\n?/g, '').trim();
    
    const cssPath = path.join(__dirname, '../../landing/styles.css');
    fs.writeFileSync(cssPath, cleanCss, 'utf8');
    log('✅ CSS создан');
    writeBuildLog('CSS файл создан: landing/styles.css');

    // 4. Генерация JavaScript
    log('⚡ Генерация JavaScript...');
    const jsPrompt = [
      {
        role: 'system',
        content: 'Ты эксперт по JavaScript. Создай чистый, современный JS код для интерактивности.'
      },
      {
        role: 'user',
        content: `Создай JavaScript для базовой интерактивности лендинга: smooth scroll, обработка форм, анимации. Верни только JS код без markdown разметки.`
      }
    ];

    const jsContent = await callOpenAI(jsPrompt);
    const cleanJs = jsContent.replace(/```javascript\n?/g, '').replace(/```js\n?/g, '').replace(/```\n?/g, '').trim();
    
    const jsPath = path.join(__dirname, '../../landing/script.js');
    fs.writeFileSync(jsPath, cleanJs, 'utf8');
    log('✅ JavaScript создан');
    writeBuildLog('JavaScript файл создан: landing/script.js');

    // 5. Финальный отчёт
    log('✅ Генерация завершена успешно!');
    writeBuildLog(`
### Результат генерации

- ✅ HTML: landing/index.html
- ✅ CSS: landing/styles.css
- ✅ JavaScript: landing/script.js

**Статус:** Успешно завершено

**Спецификация:**
- Заголовок: ${spec.title}
- Описание: ${spec.description}
- Секций: ${spec.sections.length}
- Цветовая схема: ${spec.colors.primary} (primary)

**Следующие шаги:**
1. Проверить сгенерированные файлы
2. Открыть landing/index.html в браузере
3. При необходимости внести правки вручную
    `);

    console.log('\n📊 Статистика:');
    console.log(`   HTML: ${fs.statSync(htmlPath).size} байт`);
    console.log(`   CSS: ${fs.statSync(cssPath).size} байт`);
    console.log(`   JS: ${fs.statSync(jsPath).size} байт`);
    console.log('\n✅ Все файлы созданы в папке landing/');

  } catch (error) {
    log(`❌ Критическая ошибка: ${error.message}`);
    writeBuildLog(`### ❌ Ошибка\n\n${error.message}\n\nStack trace:\n\`\`\`\n${error.stack}\n\`\`\``);
    process.exit(1);
  }
}

// Запуск
generateLanding();
