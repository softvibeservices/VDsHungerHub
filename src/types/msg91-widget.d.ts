// src/types/msg91-widget.d.ts

/**
 * Type declarations for the MSG91 OTP Widget SDK.
 *
 * The widget JS (loaded from https://verify.msg91.com/otp-provider.js) attaches
 * initSendOTP, sendOTP/sendOtp, verifyOTP/verifyOtp to the window object when loaded
 * with exposeMethods: true.
 */

declare global {
  interface Window {
    initSendOTP: (config: Msg91WidgetConfig) => void;
    sendOTP?: (identifier?: string) => void;
    sendOtp?: (identifier?: string) => void;
    verifyOTP?: (otp: string) => void;
    verifyOtp?: (otp: string) => void;
    retryOTP?: (type?: string) => void;
    retryOtp?: (type?: string) => void;
  }

  interface Msg91WidgetConfig {
    widgetId: string;
    tokenAuth?: string;
    identifier?: string;
    exposeMethods?: boolean;
    success: (data: { message: string }) => void;
    failure: (error: unknown) => void;
  }
}

export {};
