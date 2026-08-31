import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const { signIn, resetPasswordForEmail } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await resetPasswordForEmail(email);
      if (error) setError(error.message);
      else setResetEmailSent(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Email not confirmed"))
            setError("Confirme seu email antes de entrar. Verifique sua caixa de entrada.");
          else if (error.message.includes("Invalid login credentials"))
            setError("Email ou senha incorretos.");
          else
            setError(error.message);
        } else {
          navigate("/");
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <span className="text-2xl font-bold text-foreground">MediaHub</span>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
          {resetEmailSent ? (
            <div className="text-center space-y-3 py-4">
              <div className="text-4xl">📧</div>
              <h2 className="text-lg font-semibold text-foreground">Verifique seu email</h2>
              <p className="text-sm text-muted-foreground">
                Se houver uma conta com o email <span className="text-foreground font-medium">{email}</span>,
                enviamos um link para redefinir sua senha.
              </p>
              <button
                onClick={() => { setResetEmailSent(false); setMode("login"); setError(""); }}
                className="text-sm text-primary hover:underline mt-2"
              >
                Voltar para o login
              </button>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {mode === "login" ? "Entrar na plataforma" : "Recuperar senha"}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {mode === "login"
                    ? "Acesso provisionado pela operação. Use o e-mail e a senha que você recebeu."
                    : "Informe seu email para receber o link de redefinição"}
                </p>
              </div>

              {mode === "forgot" ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Email</label>
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                      {error}
                    </p>
                  )}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Aguarde..." : "Enviar link de recuperação"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Email</label>
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Senha</label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                      {error}
                    </p>
                  )}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Aguarde..." : "Entrar"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setError(""); }}
                    className="block w-full text-center text-sm text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </form>
              )}

              {mode === "forgot" && (
                <div className="text-center text-sm text-muted-foreground">
                  <button
                    onClick={() => { setMode("login"); setError(""); }}
                    className="text-primary hover:underline font-medium"
                  >
                    Voltar para o login
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
