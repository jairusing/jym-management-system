// B5 (systems-integration review): central runtime error reporting.
//
// Always logs to the console. If VITE_ERROR_WEBHOOK_URL is configured, the
// error is also POSTed there as JSON so failures are visible even when nobody
// has devtools open (free-tier friendly: any webhook receiver works —
// Sentry-mini, Discord, a log drain, etc.).

type ErrorPayload = {
  message: string;
  stack?: string;
  source: string;
  url: string;
  timestamp: string;
};

const webhookUrl = import.meta.env.VITE_ERROR_WEBHOOK_URL ?? '';

function report(payload: ErrorPayload): void {
  console.error(`[${payload.source}] ${payload.message}`, payload.stack ?? '');
  if (!webhookUrl) {
    return;
  }
  try {
    void fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch {
    // Never let reporting itself break the app.
  }
}

export function reportError(source: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  report({
    message,
    stack: error instanceof Error ? error.stack : undefined,
    source,
    url: typeof window !== 'undefined' ? window.location.href : '',
    timestamp: new Date().toISOString()
  });
}

/** Installs global handlers for uncaught errors and unhandled rejections. Call once at startup. */
export function installGlobalErrorReporting(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.addEventListener('error', (event) => reportError('window.error', event.error ?? event.message));
  window.addEventListener('unhandledrejection', (event) => reportError('unhandledrejection', event.reason));
}
