---
name: Bot Builder initialization order
description: Why is_loading=true is critical for correct Blockly workspace initialization timing
---

## The rule
`is_loading` in `app-content.jsx` MUST start as `true`. Do NOT change it to `false`.

**Why:**
The original design gates BotBuilder's first render behind the loading screen:
1. App starts → `is_loading = true` → ChunkLoader shown, BotBuilder NOT mounted
2. API connects → `init()` → `setDBotEngineStores()` sets `dbot_store`
3. Active symbols load → `setIsLoading(false)`
4. BotBuilder renders for the first time → `useEffect` → `onMount()` → `dbot_store` IS set → `#scratch_div` in DOM → Blockly initializes ✅

If `is_loading` starts `false`, BotBuilder mounts immediately before `dbot_store` is set. `onMount()` returns early (`if (!this.dbot_store) return`), and Blockly never initializes → blank Bot Builder.

**How to apply:**
- Never change `React.useState(true)` to `React.useState(false)` for `is_loading` in `app-content.jsx`
- Never add `app.onMount()` to `init()` — BotBuilder's own `useEffect` handles it at the right time
- The `if (!this.dbot_store) return` guard in `app-store.ts onMount` is intentional — it's the fail-safe, NOT the primary mechanism
- Do NOT add polling, `is_workspace_initialized` guards, or other timing hacks — they break the elegant original design
