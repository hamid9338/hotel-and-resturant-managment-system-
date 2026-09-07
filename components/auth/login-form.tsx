"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Input, Label, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/api/auth/login", { username: username.trim(), pin });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in w-full max-w-sm rounded-2xl border border-border-default bg-surface-1 p-8 shadow-xl">
      <div className="mb-7 text-center">
        <div className="font-display text-2xl font-semibold text-accent">Kashmir View Lodges</div>
        <div className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">Hotel & Management System</div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Username</Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            placeholder="e.g. kamran"
          />
        </div>
        <div>
          <Label>PIN</Label>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoComplete="current-password"
            placeholder="••••"
          />
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" variant="primary" className="w-full" loading={loading} disabled={!username || !pin}>
          <LogIn size={15} /> Sign in
        </Button>
      </form>
    </div>
  );
}
