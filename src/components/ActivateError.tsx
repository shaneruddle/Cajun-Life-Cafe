import { useSearchParams } from "react-router-dom";
import { useT } from "../i18n";

export default function ActivateError() {
  const [params] = useSearchParams();
  const t = useT();
  const msg = params.get("msg") || t("contact.errGeneric");
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-lg space-y-4">
        <div className="text-5xl">❌</div>
        <h1 className="text-2xl font-bold text-ink">{t("act.failTitle")}</h1>
        <p className="text-gray-500">{msg}</p>
        <p className="text-sm text-gray-400">{t("act.failNote")}</p>
      </div>
    </div>
  );
}
