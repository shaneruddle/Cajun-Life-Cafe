export default function ActivateSuccess() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-lg space-y-4">
        <div className="text-5xl">✅</div>
        <h1 className="text-2xl font-bold text-ink">You're all linked!</h1>
        <p className="text-gray-500">Your LINE account is now connected to your Cajun Life Cafe wallet. You'll receive notifications when your balance changes.</p>
        <img src="https://firebasestorage.googleapis.com/v0/b/cajun-life-cafe.firebasestorage.app/o/logos%2Fsquare_logo.png?alt=media" alt="Cajun Life Cafe" className="w-16 h-16 mx-auto rounded-xl" />
      </div>
    </div>
  );
}
