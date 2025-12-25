/**
 * Error Handler Utilities
 * Provides centralized error logging, user-friendly message conversion, and graceful error handling
 */

export interface ErrorContext {
	context?: string;
	userId?: string;
	component?: string;
	action?: string;
	additionalData?: Record<string, unknown>;
}

/**
 * Logs an error with context information
 * Provides structured logging for debugging and monitoring
 */
export function logError(error: unknown, context: ErrorContext = {}): void {
	const timestamp = new Date().toISOString();
	const errorMessage = error instanceof Error ? error.message : String(error);
	const errorStack = error instanceof Error ? error.stack : undefined;

	console.error(
		`[${timestamp}] ERROR in ${context.component || "Unknown Component"}`,
		{
			message: errorMessage,
			context: context.context,
			action: context.action,
			userId: context.userId,
			additionalData: context.additionalData,
			stack: errorStack,
		},
	);
}

/**
 * Converts technical errors into user-friendly messages
 * Hides implementation details while providing helpful guidance
 */
export function getUserFriendlyMessage(error: unknown): string {
	if (error instanceof Error) {
		const message = error.message.toLowerCase();

		// Network-related errors
		if (
			message.includes("network") ||
			message.includes("fetch") ||
			message.includes("timeout")
		) {
			return "Network connection failed. Please check your internet connection and try again.";
		}

		// Permission errors
		if (message.includes("permission") || message.includes("denied")) {
			return "Permission denied. Please check app permissions in your settings.";
		}

		// API key errors
		if (
			message.includes("api") ||
			message.includes("unauthorized") ||
			message.includes("invalid key")
		) {
			return "Service authentication failed. Please contact support.";
		}

		// Microphone errors
		if (message.includes("microphone") || message.includes("audio")) {
			return "Microphone error. Please ensure the microphone is accessible and try again.";
		}

		// WebSocket errors
		if (message.includes("websocket") || message.includes("connection")) {
			return "Connection lost. Please try again.";
		}

		// Translation errors
		if (message.includes("translation")) {
			return "Translation service unavailable. Please try again.";
		}

		// Storage errors
		if (message.includes("storage") || message.includes("async storage")) {
			return "Unable to save data. Please try again.";
		}
	}

	// Fallback for unknown errors
	return "An unexpected error occurred. Please try again.";
}

/**
 * Handles errors gracefully with logging and user-friendly messaging
 * Standard error handling pattern across the app
 */
export function handleCrashGracefully(
	error: unknown,
	context: ErrorContext = {},
	onUserMessage?: (message: string) => void,
): string {
	logError(error, context);
	const userMessage = getUserFriendlyMessage(error);

	if (onUserMessage) {
		onUserMessage(userMessage);
	}

	return userMessage;
}

/**
 * Safe wrapper for async operations that might fail
 * Catches errors and converts them to user-friendly messages
 */
export async function safeAsync<T>(
	operation: () => Promise<T>,
	context: ErrorContext = {},
): Promise<{ success: boolean; data?: T; error?: string }> {
	try {
		const data = await operation();
		return { success: true, data };
	} catch (error) {
		const errorMessage = handleCrashGracefully(error, context);
		return { success: false, error: errorMessage };
	}
}

/**
 * Checks if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return (
			message.includes("network") ||
			message.includes("fetch") ||
			message.includes("timeout") ||
			message.includes("connection") ||
			message.includes("disconnected")
		);
	}
	return false;
}

/**
 * Checks if an error is a recoverable error (can retry)
 */
export function isRecoverableError(error: unknown): boolean {
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return (
			isNetworkError(error) ||
			message.includes("timeout") ||
			message.includes("retry") ||
			message.includes("unavailable")
		);
	}
	return false;
}

/**
 * Safely executes a function and catches any errors
 */
export function safeSync<T>(
	operation: () => T,
	context: ErrorContext = {},
	fallbackValue?: T,
): T | undefined {
	try {
		return operation();
	} catch (error) {
		logError(error, context);
		return fallbackValue;
	}
}
