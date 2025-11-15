# Createlen — webhook listener & deploy helpers

This repo contains a minimal webhook listener for a GitHub App and deployment helpers.

Quick deployment summary:
1. DNS: create A record `createlen.kg-keis.ru` -> 94.241.141.3
2. On server:
   - Copy `webhook/webhook-handler.js` to `/opt/createlen/`
   - Copy `deploy/createlen-webhook.service` to `/etc/systemd/system/`
   - Copy `deploy/nginx.createlen.conf` to `/etc/nginx/sites-available/createlen` and symlink to sites-enabled
   - Create `/etc/createlen/.env` from `etc/createlen/.env.example` and set `WEBHOOK_SECRET` (generate below)
   - Run `deploy/deploy.sh` as root (or run steps manually)
   - Start service: `systemctl daemon-reload && systemctl enable --now createlen-webhook`
   - Check logs: `sudo journalctl -u createlen-webhook -f`
   - Health: `curl -I https://createlen.kg-keis.ru/health`

Generate webhook secret:
```bash
openssl rand -hex 32
```
Place the generated hex string as WEBHOOK_SECRET in `/etc/createlen/.env` and also set it in GitHub / repository secrets (WEBHOOK_SECRET) or GitHub App webhook Secret.

GitHub App configuration:
- Webhook URL: `https://createlen.kg-keis.ru/webhook`
- Enable SSL verification
- Permissions (recommended): metadata: read, contents: read/write, pull_requests: read/write, checks: read/write, statuses: read/write, actions: read/write (optional)
- Subscribe to events: push, pull_request, installation, check_run, check_suite, workflow_run, issue_comment

Security:
- DO NOT commit private keys or secrets to the repository.
- Store GH app private key and other secrets in a secure vault or on the server with strict perms (chmod 600).
- After automation completes, rotate PAT and other temporary tokens.

Next steps:
- Commit these files to branch `chore/add-webhook-deploy` and open a PR to `main`.
- After PR is merged or files deployed, update GitHub App webhook URL and secret, then click "Send test webhook" to verify.
