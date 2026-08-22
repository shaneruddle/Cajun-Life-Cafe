/// <reference types="vite/client" />
interface ImportMetaEnv {
    // Google Maps embed key (client-side map display only — restrict by HTTP referrer in Google Cloud Console)
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
    // Firebase client-side config
  readonly VITE_FIREBASE_API_KEY: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN: string;
    readonly VITE_FIREBASE_PROJECT_ID: string;
    readonly VITE_FIREBASE_STORAGE_BUCKET: string;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
    readonly VITE_FIREBASE_APP_ID: string;
    readonly VITE_FIREBASE_DATABASE_ID: string;
    // LINE LIFF/MINI App ID for the in-chat ordering page (/order) — issued
    // when the app is registered in the LINE Developers Console, see
    // cajun-line-ordering-spec.md §9.
    readonly VITE_LIFF_ID: string;
}
interface ImportMeta {
    readonly env: ImportMetaEnv;
}
