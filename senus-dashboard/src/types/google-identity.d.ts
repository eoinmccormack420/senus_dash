// src/types/google-identity.d.ts
//
// Shared ambient type for the Google Identity Services script tag
// loaded in index.html (https://accounts.google.com/gsi/client) — not
// an npm package. Two independent namespaces are used across the app:
// `accounts.id` (the "Sign In With Google" ID-token flow, LoginScreen.tsx)
// and `accounts.oauth2` (the "Code Client" authorization-code flow,
// used by NotificationsSection.tsx's "Connect Gmail" button to request
// the gmail.send scope). Declared once here so both call sites augment
// the same global `Window.google` type instead of redeclaring it.

export {};

interface GoogleIdCredentialResponse {
  credential: string;
}

interface GoogleCodeResponse {
  code: string;
  scope: string;
  error?: string;
  error_description?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleIdCredentialResponse) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
        oauth2: {
          initCodeClient: (config: {
            client_id: string;
            scope: string;
            ux_mode?: "popup" | "redirect";
            callback: (response: GoogleCodeResponse) => void;
          }) => { requestCode: () => void };
        };
      };
    };
  }
}
