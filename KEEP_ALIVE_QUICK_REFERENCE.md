# Keep-Alive & Reconnection - Quick Reference

## What Was Implemented

Automatic WebSocket keep-alive pings and reconnection logic for Deepgram streaming.

## Key Features

| Feature            | Details                   |
| ------------------ | ------------------------- |
| **Ping Interval**  | 20 seconds                |
| **Ping Message**   | `{ "type": "KeepAlive" }` |
| **Max Retries**    | 3 attempts                |
| **Backoff Delays** | 1s, 2s, 4s                |
| **Total Wait**     | ~7 seconds max            |

## How It Works

```
User Recording
    ↓
WebSocket Open → Start Keep-Alive Pings (every 20s)
    ↓
Connection Active → Pings sent continuously
    ↓
Unexpected Close (error code ≠ 1000, 1005)
    ↓
Attempt Reconnect:
  - Attempt 1: Wait 1s, reconnect
  - Attempt 2: Wait 2s, reconnect
  - Attempt 3: Wait 4s, reconnect
  - Failed: Stop and report error
    ↓
Connection Restored → Reset and continue
```

## For Developers

### Using the New Callback

```typescript
await deepgramRef.current.startStreaming({
  // ... other callbacks ...
  onReconnecting: (isReconnecting, attempt, maxAttempts) => {
    console.log(`Reconnecting: ${isReconnecting} (${attempt}/${maxAttempts})`);
    // Update UI accordingly
  },
});
```

### Checking Connection Health

```typescript
const health = deepgramService.getConnectionHealth();
console.log(health.status); // "healthy" | "degraded" | "dead"
console.log(health.lastPingTime); // Timestamp of last ping
console.log(health.isConnected); // Boolean
```

### Proper Cleanup

```typescript
deepgramRef.current?.stop(); // Clears all intervals and timeouts
```

## UI Changes

### New Status Indicator

- **Yellow badge** shows during reconnection
- Format: "Reconnecting (1/3)"
- Replaces language indicator temporarily

### Status Text Updates

- "Reconnecting... (1/3)" during attempts
- Falls back to normal status after reconnection

## Files Changed

```
services/deepgram.ts       - Core implementation
app/translate.tsx          - UI integration
KEEP_ALIVE_IMPLEMENTATION.md - Full documentation
```

## Error Messages

**Service Errors**:

- "Deepgram connection closed unexpectedly: [code] [reason]"

**UI Status During Reconnect**:

- Header shows: "Reconnecting (1/3)"
- Bottom shows: "Reconnecting... (1/3)"

## Testing

Quick ways to test:

1. **Long Session Test**: Record for 5+ minutes - pings every 20s in background
2. **Network Interrupt**: Toggle airplane mode - service should reconnect
3. **Rapid Failures**: Interrupt 3+ times - service should give up and show error

## Performance Impact

- **Network**: 1 ping every 20 seconds (negligible)
- **CPU**: Minimal (only runs on close)
- **Memory**: Properly cleaned up, no leaks
- **Battery**: Minimal impact from lightweight pings

## Logging

Check console for:

- `[Deepgram]` logs: Service-side activity
- `[UI]` logs: User-facing status updates

Example:

```
[Deepgram] Starting keep-alive pings (20s interval)
[Deepgram] Keep-alive ping sent (2025-12-25T10:30:45.123Z)
[Deepgram] Connection closed: 1006 Abnormal closure
[Deepgram] Reconnecting (attempt 1/3) in 1000ms...
[UI] Reconnecting to Deepgram (attempt 1/3)
[Deepgram] Reconnection successful
[UI] Reconnection successful
```

## Troubleshooting

| Issue                      | Solution                               |
| -------------------------- | -------------------------------------- |
| Pings not sending          | Check console for `startKeepAlive` log |
| Reconnection not triggered | Verify close code is 1000/1005         |
| State not updating in UI   | Check `isMountedRef.current`           |
| Memory leak warnings       | Ensure `stop()` is called on unmount   |

## Known Limitations

- Reconnection only works for unexpected closures (codes other than 1000, 1005)
- Normal disconnections (user stops recording) don't trigger reconnect
- Audio state is not automatically resumed - user must re-record

## Future Enhancements

See `KEEP_ALIVE_IMPLEMENTATION.md` for detailed future improvements including:

- Configurable ping intervals
- Connection statistics
- Adaptive backoff strategies
- Network availability checking
- Audio recovery after reconnection
