// server.js
import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

// === базовые middlewares ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === СТАРЫЕ ЭНДПОИНТЫ (оставляем, чтобы ничего не сломать) ===
app.get("/", (req, res) => {
  res.json({
    service: "Createlen Webhook Handler",
    version: "1.1.0",
    endpoints: {
      webhook: "POST /webhook",
      health: "GET /health",
      panel: "GET /panel"
    }
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// тут оставь свою текущую логику вебхука, если она есть
app.post("/webhook", (req, res) => {
  // если у тебя уже есть продвинутый обработчик — подставь его
  console.log("Webhook received:", req.body);
  res.json({ ok: true });
});

// === НОВОЕ: HTML-панель ===
app.get("/panel", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>Createlen — панель генерации лендингов</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #050816;
      color: #e5e7eb;
      display: flex;
      min-height: 100vh;
      justify-content: center;
      align-items: flex-start;
    }
    .container {
      max-width: 960px;
      width: 100%;
      padding: 32px 16px 48px;
    }
    h1 {
      font-size: 28px;
      margin-bottom: 8px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.4);
      margin-bottom: 16px;
    }
    label {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 4px;
      display: block;
    }
    select, textarea, input[type="text"] {
      width: 100%;
      box-sizing: border-box;
      border-radius: 8px;
      border: 1px solid #374151;
      background: #020617;
      color: #e5e7eb;
      padding: 8px 10px;
      font-size: 14px;
      outline: none;
    }
    select:focus, textarea:focus, input[type="text"]:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.6);
    }
    textarea {
      min-height: 320px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 13px;
      line-height: 1.4;
      white-space: pre;
    }
    .field {
      margin-bottom: 16px;
    }
    .row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .row > .field {
      flex: 1 1 200px;
    }
    button {
      border-radius: 999px;
      border: none;
      padding: 10px 18px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #2563eb, #0ea5e9);
      color: white;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .secondary-btn {
      background: transparent;
      border: 1px solid #4b5563;
      color: #e5e7eb;
    }
    .hint {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 4px;
    }
    .status {
      margin-top: 12px;
      font-size: 13px;
    }
    .status.ok {
      color: #4ade80;
    }
    .status.err {
      color: #f97373;
    }
    .card {
      border-radius: 16px;
      padding: 16px 16px 20px;
      background: radial-gradient(circle at top left, rgba(59, 130, 246, 0.25), transparent 45%), #020617;
      border: 1px solid rgba(55, 65, 81, 0.9);
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.9);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">Createlen • internal tool</div>
    <h1>Панель генерации лендингов</h1>
    <p style="font-size:14px; color:#9ca3af; margin-bottom:20px;">
      Выберите тип страницы, при необходимости поправьте промт и запустите генерацию.
      В фоне будет вызван GitHub Actions <code>openai-landing.yml</code>, а затем Render поднимет обновлённый сайт.
    </p>

    <form id="prompt-form" class="card">
      <div class="row">
        <div class="field">
          <label for="pageType">Тип страницы</label>
          <select id="pageType" name="pageType">
            <option value="main">Главная</option>
            <option value="investment">Инвестиционное мошенничество</option>
            <option value="gosuslugi">Взлом Госуслуг / банка</option>
            <option value="influence">Перевод под влиянием</option>
            <option value="custom">Свой промт</option>
          </select>
          <div class="hint">При смене типа страницы — в поле ниже подставится рекомендованный промт.</div>
        </div>
        <div class="field">
          <label for="branch">Ветка</label>
          <input id="branch" name="branch" type="text" value="main" />
          <div class="hint">Обычно <code>main</code>, если не хочешь отдельную тестовую ветку.</div>
        </div>
      </div>

      <div class="field">
        <label for="prompt">Промт / spec для генерации</label>
        <textarea id="prompt" name="prompt"></textarea>
        <div class="hint">Сюда подставляется JSON-спека/промт. Можно редактировать перед запуском.</div>
      </div>

      <div class="row" style="align-items:center; justify-content:space-between; margin-top:8px;">
        <div>
          <button type="submit" id="submit-btn">
            <span>🚀 Запустить генерацию</span>
          </button>
          <button type="button" class="secondary-btn" id="reset-btn">Сбросить к шаблону</button>
        </div>
        <div id="status" class="status"></div>
      </div>
    </form>
  </div>

  <script>
    // сюда можно вставить твои JSON-спеки как текст (для удобства редактирования)
    const templates = {
      main: ${JSON.stringify(/* сюда можно вставить объект главной страницы */ {}, null, 2)},
      investment: ${JSON.stringify(/* сюда JSON 1-го направления */ {}, null, 2)},
      gosuslugi: ${JSON.stringify(/* сюда JSON 2-го направления */ {}, null, 2)},
      influence: ${JSON.stringify(/* сюда JSON 3-го направления */ {}, null, 2)}
    };

    const pageTypeEl = document.getElementById("pageType");
    const promptEl = document.getElementById("prompt");
    const formEl = document.getElementById("prompt-form");
    const statusEl = document.getElementById("status");
    const submitBtn = document.getElementById("submit-btn");
    const resetBtn = document.getElementById("reset-btn");
    const branchEl = document.getElementById("branch");

    function applyTemplate() {
      const type = pageTypeEl.value;
      if (type === "custom") return;
      const tpl = templates[type];
      if (tpl && Object.keys(tpl).length > 0) {
        promptEl.value = JSON.stringify(tpl, null, 2);
      } else {
        promptEl.value = "";
      }
    }

    pageTypeEl.addEventListener("change", () => {
      applyTemplate();
      statusEl.textContent = "";
    });

    resetBtn.addEventListener("click", () => {
      applyTemplate();
      statusEl.textContent = "";
    });

    // инициализация
    applyTemplate();

    formEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      statusEl.textContent = "";
      submitBtn.disabled = true;

      const data = {
        pageType: pageTypeEl.value,
        branch: branchEl.value || "main",
        prompt: promptEl.value
      };

      try {
        const res = await fetch("/panel/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });

        const text = await res.text();
        if (res.ok) {
          statusEl.textContent = "✔ Запуск GitHub Actions успешно отправлен";
          statusEl.className = "status ok";
        } else {
          statusEl.textContent = "✖ Ошибка: " + text;
          statusEl.className = "status err";
        }
      } catch (err) {
        console.error(err);
        statusEl.textContent = "✖ Сетевая ошибка при обращении к /panel/generate";
        statusEl.className = "status err";
      } finally {
        submitBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`);
});

// === НОВОЕ: backend для запуска GitHub Actions ===
app.post("/panel/generate", async (req, res) => {
  try {
    const { prompt, pageType, branch } = req.body || {};

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).send("Пустой промт. Заполни поле перед отправкой.");
    }

    const githubToken = process.env.GITHUB_WORKFLOW_TOKEN;
    const repoOwner = process.env.GITHUB_REPO_OWNER || "vanserokok-arch";
    const repoName = process.env.GITHUB_REPO_NAME || "Createlen";
    const workflowId = process.env.LANDING_WORKFLOW_ID || "openai-landing.yml";
    const ref = branch && branch.trim() ? branch.trim() : "main";

    if (!githubToken) {
      return res.status(500).send("GITHUB_WORKFLOW_TOKEN не настроен в env.");
    }

    const payload = {
      ref,
      inputs: {
        spec: prompt,
        page_type: pageType || "custom"
      }
    };

    const ghRes = await fetch(
      \`https://api.github.com/repos/\${repoOwner}/\${repoName}/actions/workflows/\${workflowId}/dispatches\`,
      {
        method: "POST",
        headers: {
          "Authorization": \`Bearer \${githubToken}\`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        },
        body: JSON.stringify(payload)
      }
    );

    if (!ghRes.ok) {
      const body = await ghRes.text();
      return res
        .status(ghRes.status)
        .send(\`GitHub API error (\${ghRes.status}): \${body}\`);
    }

    res.send("Workflow dispatch отправлен. Проверь вкладку Actions в GitHub.");
  } catch (err) {
    console.error("Error in /panel/generate:", err);
    res.status(500).send("Внутренняя ошибка сервера при запуске генерации.");
  }
});

app.listen(PORT, () => {
  console.log("Createlen server listening on port", PORT);
});
