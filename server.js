// server.js
import express from "express";
import fetch from "node-fetch";
import path from "path";

const app = express();
const PORT = process.env.PORT || 10000;

// __dirname для ESM
const __dirname = new URL(".", import.meta.url).pathname;

// === базовые middlewares ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(express.static(path.join(__dirname, "public")));

// === СТАРЫЕ ЭНДПОИНТЫ (оставляем, чтобы ничего не сломать) ===
app.get("/", (req, res) => {
  res.json({
    service: "Createlen Webhook Handler",
    version: "1.2.0",
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

// Основной вебхук: сохраняем старое поведение, добавляем поддержку запросов с панели
app.post("/webhook", async (req, res) => {
  try {

    if (req.body && req.body.source === "dashboard") {
      const page = req.body.page;
      const spec = req.body.spec;

      // Валидация
      if (!spec || typeof spec !== "string" || !spec.trim()) {
        return res.status(400).json({ ok: false, message: "Empty spec in dashboard request" });
      }


      // Конфигурация из окружения
      const githubToken = process.env.GITHUB_WORKFLOW_TOKEN;
      const repoOwner = process.env.GITHUB_REPO_OWNER || "vanserokok-arch";
      const repoName = process.env.GITHUB_REPO_NAME || "Createlen";
      const workflowId = process.env.LANDING_WORKFLOW_ID || "openai-landing.yml";
      const ref = "main";



      // Конфигурация из окружения
      const githubToken = process.env.GITHUB_WORKFLOW_TOKEN;
      const repoOwner = process.env.GITHUB_REPO_OWNER || "vanserokok-arch";
      const repoName = process.env.GITHUB_REPO_NAME || "Createlen";
      const workflowId = process.env.LANDING_WORKFLOW_ID || "openai-landing.yml";
      const ref = "main";


      if (!githubToken) {
        console.error("GITHUB_WORKFLOW_TOKEN не настроен в окружении");
        return res.status(500).json({ ok: false, message: "GITHUB_WORKFLOW_TOKEN not configured" });
      }

      // Формируем тело dispatch — inputs: spec и page (требование workflow)
      const payload = {
        ref,
        inputs: {
          spec: spec,
          page: page || "main"
        }
      };

      const dispatchUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/${workflowId}/dispatches`;
      console.log(`[dashboard] Dispatching workflow ${workflowId} for ${repoOwner}/${repoName} (page=${payload.inputs.page})`);

      const ghRes = await fetch(dispatchUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${githubToken}`,
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "createlen-webhook"
        },
        body: JSON.stringify(payload)
      });

      // GitHub возвращает 204 при успешном dispatch
      if (ghRes.status === 204) {
        console.log("[dashboard] Workflow dispatched (204).");
        return res.status(200).json({ ok: true, message: "Workflow dispatched", page: payload.inputs.page });
      } else {
        const respText = await ghRes.text();
        console.error(`[dashboard] GitHub API returned ${ghRes.status}: ${respText}`);
        return res.status(500).json({
          ok: false,
          message: "GitHub API returned non-204 status",
          status: ghRes.status,
          body: respText ? respText.substring(0, 400) : ""
        });
      }
    }

    // Если запрос НЕ от дашборда — оставляем прежнее поведение (для других интеграций)
    console.log("Webhook received (non-dashboard):", req.body);
    res.json({ ok: true });

  } catch (err) {
    console.error("Error in /webhook:", err);
    res.status(500).json({ ok: false, message: "Internal server error in /webhook" });
  }
});

// Маршрут отдачи панели (статический файл public/panel.html)
app.get("/panel", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "panel.html"));
});

// Для совместимости оставляем /panel/generate (старый маршрут), проксируем в /webhook
app.post("/panel/generate", async (req, res) => {
  const body = Object.assign({}, req.body);
  if (!body.source) body.source = "dashboard";
  try {
    const localRes = await fetch(`http://127.0.0.1:${PORT}/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const text = await localRes.text();
    res.status(localRes.status).send(text);
  } catch (err) {

  } catch (err) {
    console.error("Error in /webhook:", err);
    res.status(500).json({ ok: false, message: "Internal server error in /webhook" });
  }
});

// Маршрут отдачи панели (статический файл public/panel.html)
app.get("/panel", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "panel.html"));
});

// Для совместимости оставляем /panel/generate (старый маршрут), проксируем в /webhook
app.post("/panel/generate", async (req, res) => {
  const body = Object.assign({}, req.body);
  if (!body.source) body.source = "dashboard";
  try {
    const localRes = await fetch(`http://127.0.0.1:${PORT}/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const text = await localRes.text();
    res.status(localRes.status).send(text);
  } catch (err) {

    console.error("Error proxying /panel/generate -> /webhook:", err);
    res.status(500).send("Ошибка сервера при проксировании запроса.");
  }
});

app.listen(PORT, () => {
  console.log("Createlen server listening on port", PORT);
});