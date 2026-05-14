/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
  readonly VITE_TWILIO_ACCOUNT_SID: string;
  readonly VITE_TWILIO_AUTH_TOKEN: string;
  readonly VITE_TWILIO_PHONE_NUMBER: string;
  readonly VITE_TWILIO_VERIFY_SERVICE_SID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
