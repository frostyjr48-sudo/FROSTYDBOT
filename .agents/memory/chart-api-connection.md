---
name: Chart API connection fix
description: Why SmartChart must use api_base.api instead of chart_api.api for all requests
---

## Rule
Use `api_base.api` (not `chart_api.api`) for ALL SmartChart callbacks: `requestAPI`, `requestSubscribe`, and `requestForgetStream`.

**Why:** `chart_api.api` creates a second, separate WebSocket inside `chart_api.init()`, which is called from `api_base.init()` WITHOUT `await`. By the time SmartChart calls `requestAPI` or `requestSubscribe`, `chart_api.api`'s WebSocket is still in CONNECTING state (readyState=0). `DerivAPIBasic.send()` queues the request and waits for the socket to open — if it takes too long or fails silently, the Promise never resolves and SmartChart shows "Retrieving Market Symbols…" or "Retrieving Chart Data…" indefinitely.

`api_base.api` is always connected by the time any tab renders (the dashboard and other tabs already work through it), so routing chart requests through it is reliable.

**How to apply:**
- `requestAPI` → `api_base.api.send(req)`
- `requestSubscribe` → `api_base.api.send(req)` + filter `onMessage()` by `data.subscription.id` to avoid passing unrelated messages to SmartChart's callback
- `requestForgetStream` → `api_base.api.forget(subscription_id)` after unsubscribing the RxJS subscription
- `is_connection_opened` → poll `!!api_base?.api` (starts `true` immediately if already set, otherwise polls every 200ms)
