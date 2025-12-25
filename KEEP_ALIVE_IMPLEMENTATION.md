# Keep-Alive Ping Mechanism & Reconnection Logic Implementation

## Overview

This implementation adds a robust keep-alive ping mechanism and automatic reconnection logic to the Deepgram WebSocket service in Murmur. It ensures that long-running translation sessions don't lose their connection to the API and gracefully recover from unexpected disconnections.

## Features Implemented

### 1. Keep-Alive Ping Mechanism

**Location**: `/services/deepgram.ts`

The service now sends periodic keep-alive ping messages to prevent the WebSocket from timing out:

- **Ping Interval**: 20 seconds
- **Ping Message Format**: `{ "type": "KeepAlive" }`
- **Automatic Tracking**: Records timestamp of last successful ping
- **Graceful Failure**: Failed pings are logged but don't crash the connection

**Implementation Details**:

- `startKeepAlive()`: Initializes the interval when connection opens
- `stopKeepAlive()`: Clears the interval when connection closes
- Pings are only sent when the connection is confirmed alive (`isAlive()` check)
- Timestamps tracked in `lastPingTime` property

### 2. Automatic Reconnection with Exponential Backoff

**Location**: `/services/deepgram.ts`

When the WebSocket closes unexpectedly (with error codes other than 1000 or 1005), the service automatically attempts to reconnect:

- **Max Reconnection Attempts**: 3
- **Backoff Delays**: 1s, 2s, 4s
- **Total Wait Time**: ~7 seconds maximum before giving up
- **Asynchronous**: Reconnection happens in the background without blocking

**Implementation Details**:

- `attemptReconnect()`: Manages reconnection sequence with delays
- Increments `reconnectAttempts` counter after each failure
- Resets counter on successful connection
- Notifies UI via `onReconnecting` callback about each attempt
- Destroys connection properly if service is marked as destroyed

### 3. Connection State Tracking

New state properties added to `DeepgramService`:

```typescript
private keepAliveInterval: NodeJS.Timeout | null = null;  // Ping interval reference
private lastPingTime: number = 0;                         // Timestamp of last ping
private reconnectAttempts: number = 0;                    // Current attempt count
private reconnectTimeout: NodeJS.Timeout | null = null;   // Reconnect delay timer
private isReconnecting: boolean = false;                  // Current reconnection status
private callbacks: DeepgramCallbacks | null = null;       // Cached callbacks for reconnect
```

### 4. Enhanced Cleanup

**Location**: `/services/deepgram.ts` - `stop()` method

Improved cleanup to prevent memory leaks:

```typescript
stop(): void {
  this.destroyed = true;

  // Clear all timers and intervals
  this.stopKeepAlive();
  if (this.reconnectTimeout) {
    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
  }

  // Close WebSocket connection
  if (this.ws) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, "Client requested close");
    }
    this.ws = null;
  }

  this.resetState();
  this.callbacks = null;
  this.isReconnecting = false;
  this.reconnectAttempts = 0;
}
```

## API Changes

### New Callback: `onReconnecting`

Added to `DeepgramCallbacks` interface:

```typescript
readonly onReconnecting?: (
  isReconnecting: boolean,
  attemptNumber: number,
  maxAttempts: number,
) => void;
```

**Parameters**:

- `isReconnecting`: Whether currently attempting to reconnect
- `attemptNumber`: Current attempt number (1-3, or 0 if not reconnecting)
- `maxAttempts`: Maximum number of attempts (always 3)

**Usage**: Called when reconnection starts, during attempts, and when complete

## UI Integration

**Location**: `/app/translate.tsx`

### State Added

```typescript
const [isReconnecting, setIsReconnecting] = useState(false);
const [reconnectAttempt, setReconnectAttempt] = useState(0);
const [maxReconnectAttempts, setMaxReconnectAttempts] = useState(3);
```

### UI Changes

1. **Reconnection Status Badge** (Header):
   - Yellow warning badge with spinner icon
   - Shows attempt count: "Reconnecting (1/3)"
   - Replaces normal language indicator during reconnection
   - Yellow color (#EA9D47) for visual distinction

2. **Status Text Update**:
   - `getStatusText()` now checks reconnection state first
   - Shows "Reconnecting... (1/3)" when attempting to reconnect
   - Falls back to other status messages when not reconnecting

3. **Callback Handler**:
   - Implements `onReconnecting` callback in `startStreaming` options
   - Updates state when reconnection begins/ends
   - Logs reconnection progress to console with [UI] prefix
   - Safe mounting check to prevent state updates on unmounted components

## Connection Health Monitoring

The service provides a `getConnectionHealth()` method for checking connection status:

```typescript
getConnectionHealth(): {
  readonly status: "healthy" | "degraded" | "dead";
  readonly lastPingTime: number;
  readonly isConnected: boolean;
}
```

**Status Levels**:

- **Healthy**: Connected and ping sent within 30 seconds
- **Degraded**: Connected but no recent ping, or actively connecting
- **Dead**: Service destroyed or permanently disconnected

## Error Handling

### Unexpected Closure Flow

1. WebSocket `onclose` event triggered
2. `handleClose()` checks close code:
   - Codes 1000 (normal) and 1005 (no status) are treated as clean disconnects
   - Other codes trigger error callback and reconnection attempt
3. `attemptReconnect()` is called with exponential backoff
4. UI is notified via `onReconnecting` callback
5. If max attempts reached, service stops and reports error

### Failed Pings

- Logged but don't cause disconnection
- Service continues operating and will retry next interval
- Failed ping doesn't trigger reconnection (only unexpected closure does)

## Logging

Comprehensive logging added for debugging:

**Service Logs** (with `[Deepgram]` prefix):

```
[Deepgram] Starting keep-alive pings (20s interval)
[Deepgram] Keep-alive ping sent (2025-12-25T10:30:45.123Z)
[Deepgram] Connection closed: 1006 Abnormal closure
[Deepgram] Reconnecting (attempt 1/3) in 1000ms...
[Deepgram] Attempting reconnection...
[Deepgram] Reconnection successful
[Deepgram] Max reconnection attempts reached, giving up
```

**UI Logs** (with `[UI]` prefix):

```
[UI] Reconnecting to Deepgram (attempt 1/3)
[UI] Reconnection successful
```

## Testing the Implementation

### Test Scenario 1: Successful Long Session

1. Start recording
2. Let it run for several minutes
3. Pings sent every 20 seconds in background
4. Translation should continue normally

### Test Scenario 2: Network Interruption

1. Start recording
2. Block network or trigger disconnection
3. Service should:
   - Emit error callback
   - Show yellow reconnection badge in UI
   - Attempt reconnection with backoff
   - Resume connection within ~7 seconds
4. Should be able to continue translating

### Test Scenario 3: Multiple Interruptions

1. Trigger disconnection multiple times
2. After 3rd failure, should give up
3. Show error message to user
4. User can tap to try again

## Files Modified

1. **`services/deepgram.ts`** (main implementation)
   - Added `onReconnecting` callback to `DeepgramCallbacks` interface
   - Added state tracking properties
   - Implemented `startKeepAlive()` and `stopKeepAlive()` methods
   - Implemented `attemptReconnect()` method
   - Enhanced `handleClose()` to trigger reconnection
   - Improved `stop()` cleanup

2. **`app/translate.tsx`** (UI integration)
   - Added reconnection state management
   - Implemented `onReconnecting` callback handler
   - Added reconnection status badge in header
   - Updated status text to show reconnection progress

## Performance Considerations

- **Memory**: Properly cleaned up intervals and timeouts prevent memory leaks
- **Network**: Only 1 additional ping every 20 seconds (minimal overhead)
- **CPU**: Reconnection logic only runs when connection is lost
- **Battery**: Minimal impact as pings are lightweight JSON messages

## Backward Compatibility

- The `onReconnecting` callback is optional (marked with `?`)
- Existing consumers of `DeepgramService` continue to work without changes
- No changes to public method signatures (except internal state management)

## Future Enhancements

Potential improvements for future iterations:

1. **Configurable Ping Interval**: Allow customization of 20-second interval
2. **Connection Statistics**: Track reconnection success rates and timing
3. **Adaptive Backoff**: Adjust backoff based on previous attempts
4. **Network Detection**: Check network availability before attempting reconnect
5. **User Preferences**: Allow users to enable/disable auto-reconnection
6. **Audio Recovery**: Resume audio playback from last successful position
7. **Telemetry**: Send reconnection metrics to backend for monitoring

## References

- Deepgram Documentation: https://developers.deepgram.com/
- WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- Expo Audio: https://docs.expo.dev/versions/latest/sdk/audio/

## Summary

This implementation provides a production-ready keep-alive mechanism and reconnection system for the Deepgram WebSocket connection. It gracefully handles network interruptions, provides clear user feedback, and ensures that translation sessions can continue uninterrupted even when temporary network issues occur.
