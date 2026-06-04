import { useSearchParams } from "react-router-dom";
export default function ActivateError() {
  const [params] = useSearchParams();
  const msg = params.get("msg") || "Something went wrong";
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-lg space-y-4">
        <div className="text-5xl">❌</div>
        <h1 className="text-2xl font-bold text-ink">Activation Failed</h1>
        <p className="text-gray-500">{msg}</p>
        <p className="text-sm text-gray-400">Please ask staff to resend your activation link.</p>
      </div>
    </div>
  );
}
