import { theme } from "@/lib/theme";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { type ReactElement, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactElement;
  onError?: (error: Error, errorInfo: { componentStack?: string }) => void;
  allowNavigateHome?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * ErrorBoundary Component
 * Catches rendering errors and displays a user-friendly fallback UI with recovery options.
 * Logs errors with structured context for debugging.
 * Supports retry logic with max retry limit and optional navigation to home.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  private retryCount: number = 0;
  private readonly maxRetries: number = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Update state with error details
    this.setState({
      errorInfo,
    });

    // Log error with structured context for debugging
    const timestamp = new Date().toISOString();
    const errorContext = {
      timestamp,
      errorName: error.name,
      errorMessage: error.message,
      componentStack: errorInfo.componentStack,
      retryCount: this.retryCount,
    };

    console.error("[ErrorBoundary] Caught error:", errorContext);

    // Call parent's onError handler if provided
    if (this.props.onError) {
      try {
        this.props.onError(error, {
          componentStack: errorInfo.componentStack ?? undefined,
        });
      } catch (callbackError) {
        console.error(
          "[ErrorBoundary] Error in onError callback:",
          callbackError,
        );
      }
    }
  }

  handleRetry = (): void => {
    this.retryCount++;

    if (this.retryCount <= this.maxRetries) {
      // Reset error state to attempt re-render
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
    } else {
      console.error("[ErrorBoundary] Max retries reached");
    }
  };

  render(): ReactElement {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        try {
          return this.props.fallback(this.state.error, this.handleRetry);
        } catch (fallbackError) {
          console.error(
            "[ErrorBoundary] Error in fallback component:",
            fallbackError,
          );
        }
      }

      // Default error UI with theme integration
      return (
        <LinearGradient
          colors={theme.gradients.background.colors as [string, string, string]}
          locations={theme.gradients.background.locations}
          start={theme.gradients.background.start}
          end={theme.gradients.background.end}
          style={{ flex: 1 }}
        >
          <Animated.View
            entering={FadeIn.duration(400)}
            style={{ flex: 1 }}
            className="flex-1 items-center justify-center px-6"
          >
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: "center",
                paddingVertical: 24,
              }}
              showsVerticalScrollIndicator={false}
            >
              {/* Error Icon */}
              <Animated.View
                entering={FadeInDown.delay(100).duration(400)}
                className="items-center mb-6"
              >
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: theme.colors.errorBorder,
                    opacity: 0.15,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <Feather
                    name="alert-circle"
                    size={32}
                    color={theme.colors.error}
                  />
                </View>
              </Animated.View>

              {/* Error Title */}
              <Animated.Text
                entering={FadeInDown.delay(200).duration(400)}
                className="text-2xl font-bold text-center mb-2"
                style={{ color: theme.colors.text.primary }}
              >
                Oops! Something went wrong
              </Animated.Text>

              {/* Error Message */}
              <Animated.Text
                entering={FadeInDown.delay(300).duration(400)}
                className="text-base text-center mb-6"
                style={{
                  color: theme.colors.text.secondary,
                  lineHeight: theme.typography.lineHeight.relaxed * 16,
                }}
              >
                We encountered an unexpected error. Try again or navigate back
                to the start if the problem persists.
              </Animated.Text>

              {/* Error Details (dev mode) */}
              {process.env.NODE_ENV === "development" && this.state.error && (
                <Animated.View
                  entering={FadeInDown.delay(400).duration(400)}
                  style={{
                    backgroundColor: "rgba(255, 83, 51, 0.05)",
                    borderColor: theme.colors.error,
                    borderWidth: 1,
                    borderRadius: theme.borderRadius["2xl"],
                    padding: theme.spacing.md,
                    marginBottom: theme.spacing.lg,
                    maxWidth: "100%",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.colors.error,
                      marginBottom: 8,
                      fontWeight: "600",
                    }}
                  >
                    {this.state.error.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.colors.error,
                      opacity: 0.8,
                      marginBottom: this.state.errorInfo?.componentStack
                        ? 8
                        : 0,
                    }}
                  >
                    {this.state.error.message}
                  </Text>
                  {this.state.errorInfo?.componentStack && (
                    <Text
                      style={{
                        fontSize: 12,
                        color: theme.colors.error,
                        opacity: 0.6,
                      }}
                    >
                      {this.state.errorInfo.componentStack.slice(0, 200)}...
                    </Text>
                  )}
                </Animated.View>
              )}

              {/* Retry Counter */}
              {this.retryCount < this.maxRetries && (
                <Animated.Text
                  entering={FadeInDown.delay(500).duration(400)}
                  className="text-xs text-center mb-6"
                  style={{ color: theme.colors.text.muted }}
                >
                  Attempt {this.retryCount} of {this.maxRetries}
                </Animated.Text>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <Animated.View
              entering={FadeInDown.delay(600).duration(400)}
              className="w-full gap-3"
              style={{ paddingBottom: theme.spacing.lg }}
            >
              {this.retryCount < this.maxRetries ? (
                <>
                  <Pressable
                    onPress={this.handleRetry}
                    style={{
                      backgroundColor: theme.colors.coral,
                      borderRadius: theme.borderRadius["2xl"],
                      paddingVertical: theme.spacing.md,
                      paddingHorizontal: theme.spacing.lg,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: theme.colors.text.light,
                      }}
                    >
                      Try Again
                    </Text>
                  </Pressable>

                  {this.props.allowNavigateHome && <HomeNavigationButton />}
                  <ResetAppButton />
                </>
              ) : (
                <>
                  <View
                    style={{
                      backgroundColor: "rgba(255, 83, 51, 0.1)",
                      borderColor: theme.colors.error,
                      borderWidth: 1,
                      borderRadius: theme.borderRadius["2xl"],
                      paddingVertical: theme.spacing.md,
                      paddingHorizontal: theme.spacing.lg,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: theme.colors.error,
                        textAlign: "center",
                      }}
                    >
                      Max retries reached. Please restart the app or reset all
                      data.
                    </Text>
                  </View>

                  {this.props.allowNavigateHome && <HomeNavigationButton />}
                  <ResetAppButton />
                </>
              )}
            </Animated.View>
          </Animated.View>
        </LinearGradient>
      );
    }

    return <>{this.props.children}</>;
  }
}

// Helper component for navigation button
function HomeNavigationButton(): ReactElement {
  const router = useRouter();

  const handleNavigateHome = (): void => {
    try {
      router.replace("/");
    } catch (error) {
      console.error("[ErrorBoundary] Navigation error:", error);
    }
  };

  return (
    <Pressable
      onPress={handleNavigateHome}
      style={{
        borderColor: theme.colors.text.primary,
        borderWidth: 1.5,
        borderRadius: theme.borderRadius["2xl"],
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255, 255, 255, 0.3)",
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: "600",
          color: theme.colors.text.primary,
        }}
      >
        Go to Home
      </Text>
    </Pressable>
  );
}

// Helper component for resetting app data
function ResetAppButton(): ReactElement {
  const router = useRouter();

  const handleReset = async (): Promise<void> => {
    try {
      const { onboardingStorage } = await import("@/lib/onboarding");
      await onboardingStorage.reset();
      router.replace("/onboarding");
    } catch (error) {
      console.error("[ErrorBoundary] Reset error:", error);
    }
  };

  return (
    <Pressable
      onPress={handleReset}
      style={{
        marginTop: 8,
        paddingVertical: theme.spacing.sm,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: "500",
          color: theme.colors.text.secondary,
          textDecorationLine: "underline",
        }}
      >
        Reset App & Clear Data
      </Text>
    </Pressable>
  );
}
