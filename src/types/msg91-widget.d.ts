// src/types/msg91-widget.d.ts

/**
 * Type declarations for the MSG91 OTP Widget SDK.
 *
 * The widget JS (loaded from https://verify.msg91.com/otp-provider.js) attaches
 * initSendOTP, sendOTP, verifyOTP, and retryOTP to the window object when loaded
 * with exposeMethods: true.
 *
 * These are used in VerifyForm.tsx, LoginForm.tsx, and staff-login/page.tsx to
 * trigger OTP send/verify without any backend call to MSG91 (no-DLT widget path).
 */

declare global {
  interface Window {
    /**
     * Initialise the MSG91 OTP widget. Must be called before sendOTP/verifyOTP.
     * With exposeMethods: true, no popup UI is rendered — only the window methods
     * are exposed.
     */
    initSendOTP: (config: Msg91WidgetConfig) => void;

    /**
     * Triggers MSG91 to send an OTP SMS to the identifier (mobile) that was
     * configured in initSendOTP. This sends the SMS directly from the browser
     * — no backend call required.
     */
    sendOTP: () => void;

    /**
     * Submits the OTP code for verification against MSG91's widget engine.
     * On success, the success() callback fires with a JWT access token.
     * On failure, the failure() callback fires with an error reason.
     */
    verifyOTP: (otp: string) => void;

    /**
     * Requests MSG91 to resend the OTP via the retry channel.
     * Not currently used — the app re-calls the backend send-otp route
     * (which re-initialises the widget with a fresh call to sendOTP).
     */
    retryOTP: () => void;
  }

  interface Msg91WidgetConfig {
    /** The Widget ID from MSG91 dashboard → OTP → Widgets */
    widgetId: string;
    /** Not used for server-side token verification, but required by MSG91's config shape */
    tokenAuth?: string;
    /** Mobile number in international format (e.g. "917016625488") */
    identifier?: string;
    /**
     * When true, no popup UI is rendered. Instead sendOTP, verifyOTP, retryOTP
     * are exposed on window for you to call programmatically.
     */
    exposeMethods?: boolean;
    /**
     * Called on successful OTP verification.
     * data.message is the JWT access token to send to your backend for validation.
     */
    success: (data: { message: string }) => void;
    /** Called on verification failure. */
    failure: (error: unknown) => void;
  }
}

export {};
