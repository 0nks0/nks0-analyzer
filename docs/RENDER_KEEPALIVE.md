# Render Keep-Alive

The analysis backend runs on Render's **free tier**, which spins the service
down after a period of inactivity — causing a ~30–50s cold start on the next
request. This is bad UX for a public tool (and unacceptable for a paid product).

## Fix it for free

Ping the health endpoint on a schedule so the service never sleeps.

### Option A — UptimeRobot (easiest, no code)
1. Sign up at https://uptimerobot.com (free)
2. Add a **Monitor** → type **HTTP(s)**
3. URL: `https://nks0-api.onrender.com/api/health`
4. Interval: **Every 5 minutes**
5. Save.

That's it — Render sees traffic every 5 min and stays warm.

### Option B — GitHub Actions cron (repo must be public or use a secret)
A workflow like `keepalive.yml` can curl the endpoint on a schedule:

```yaml
name: keepalive
on:
  schedule:
    - cron: '*/5 * * * *'   # every 5 minutes
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS https://nks0-api.onrender.com/api/health || true
```

> Note: GitHub Actions scheduled workflows can be throttled on free/public
> repos. UptimeRobot (Option A) is more reliable and costs nothing.

### Option C — this box (Hermes host)
A cron job here can curl the endpoint every 5 minutes. Already wired if the
`render-keepalive` job is enabled.
