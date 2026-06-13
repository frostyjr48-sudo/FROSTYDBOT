---
name: Chart API connection fix
description: How to fix SmartChart loading issues (blank screen / "Retrieving Market Symbols" / "Retrieving Chart Data")
---

## Rules

### Never gate SmartChart's render on connection state or symbol
`if (!symbol || !is_connection_opened) return null` causes a completely blank Charts tab with no feedback. Don't do this.

### Make requestAPI / requestSubscribe wait internally
SmartChart calls `requestAPI({active_symbols:"brief"})` immediately on mount. If `chart_api.api` is null or not OPEN yet, the send fails silently and SmartChart stays stuck — its `_onConnectionReopened()` only refreshes existing streams, never retries the initial symbol fetch.

**Solution:** use a `waitForChartApi()` helper that polls until `chart_api.api.connection.readyState === WebSocket.OPEN`:

```js
const waitForChartApi = (timeout = 10000) => new Promise((resolve, reject) => {
    const start = Date.now();
    const check = async () => {
        if (!chart_api.api) await chart_api.init();
        if (chart_api.api?.connection?.readyState === WebSocket.OPEN) return resolve(chart_api.api);
        if (Date.now() - start > timeout) return chart_api.api ? resolve(chart_api.api) : reject();
        setTimeout(check, 100);
    };
    check();
});

const requestAPI = async (req) => { const api = await waitForChartApi(); return api.send(req); };
```

SmartChart renders immediately and shows its own loading spinner while `waitForChartApi` resolves.

### Always provide a fallback symbol
`chart_store.symbol` starts as `undefined` until Blockly workspace or `api_base.active_symbols` resolves. Use `const active_symbol = symbol || '1HZ10V'` (Volatility 10 1s) so SmartChart always has a valid symbol prop.

### Prevent AlreadySubscribed error on remount
`chart_api` is a singleton — stale tick subscriptions survive navigation. Send `{ forget_all: 'ticks' }` at the start of every `requestSubscribe` call.

### Pass the real requestForgetStream
The original code passed `requestForgetStream={() => {}}` (empty) to SmartChart. Pass the actual function that calls `chart_api.api?.forget(subscription_id)`.

**Why:** `chart_api.api` is a separate WebSocket from `api_base.api`, initialized without `await` in `api_base.init()`. It takes 100–500ms to reach OPEN state after the app loads, and `symbol` may also be delayed. Both must be handled without blocking the render.
