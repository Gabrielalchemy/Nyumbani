import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Hammer, KeyRound } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { Button, Input } from "../../components/ui";
import { EASE } from "../../components/motion";

export default function Login() {
  const { requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await requestOtp(phone || undefined);
      setStage("code");
      if (res.simulated && res.devCode) {
        setHint(`Dev mode — your code is ${res.devCode}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(code, phone || undefined);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-sand-100 px-5">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-card"
      >
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-ink text-clay-300">
            <Hammer size={18} />
          </span>
          <div>
            <h1 className="font-display text-lg font-semibold">Nyumbani Dashboard</h1>
            <p className="text-xs text-muted">Owner access · secured by SMS code</p>
          </div>
        </div>

        {stage === "phone" ? (
          <div className="space-y-4">
            <Input
              placeholder="+2547XXXXXXXX (optional)"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button size="lg" className="w-full" onClick={sendCode} disabled={busy}>
              <KeyRound size={16} /> Send login code by SMS
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {hint && (
              <p className="rounded-xl bg-clay-100 px-3.5 py-2.5 text-xs font-medium text-clay-800">
                {hint}
              </p>
            )}
            <Input
              placeholder="6-digit code"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && confirm()}
            />
            <Button size="lg" className="w-full" onClick={confirm} disabled={busy || code.length !== 6}>
              Sign in
            </Button>
            <button
              onClick={() => setStage("phone")}
              className="w-full cursor-pointer text-center text-xs text-muted hover:text-ink"
            >
              ← Change number / resend
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </motion.div>
    </main>
  );
}
