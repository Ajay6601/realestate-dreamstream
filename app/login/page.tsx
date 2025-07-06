"use client";

import type React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { useLoginController } from "@/hooks/use-login-controller";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  const {
    formData,
    showPassword,
    isLoading,
    pageContent,
    updateFormField,
    togglePasswordVisibility,
    handleLogin,
  } = useLoginController();

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f4efe6]">
        <div className="flex flex-col items-center gap-5">
          <Logo size="lg" showText clickable={false} />
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#e4d3bc] border-t-[#1e4d42]" />
          <p className="text-sm font-medium text-[#5c5348]">Signing in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden bg-[#13241f] px-12 py-10 text-[#f6f1e8] lg:flex lg:flex-col">
        <Logo size="md" variant="light" showText clickable href="/" />
        <div className="mt-16 max-w-md animate-rise-in">
          <p className="text-xs uppercase tracking-[0.28em] text-[#d4a574]">
            The desk is open
          </p>
          <h1 className="mt-4 text-5xl leading-[1.05]">
            Pick up the list where you left it.
          </h1>
          <p className="mt-5 text-[#d7cfc2]">
            Templates, proposals, and reply logs stay with the campaign — so
            the next send starts from the last one.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-3 gap-3 text-sm">
          {[
            ["01", "Upload"],
            ["02", "Write"],
            ["03", "Track"],
          ].map(([step, label]) => (
            <div key={step} className="rounded-2xl bg-white/5 px-3 py-4 ring-1 ring-white/10">
              <p className="font-display text-xl text-[#d4a574]">{step}</p>
              <p className="mt-1 text-[#f6f1e8]">{label}</p>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md animate-rise-in">
          <div className="mb-8 lg:hidden">
            <Logo size="md" showText clickable href="/" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6a45]">
            Welcome back
          </p>
          <h1 className="mt-2 text-4xl text-[#1a1814]">{pageContent.title}</h1>
          <p className="mt-2 text-sm text-[#6b6156]">{pageContent.subtitle}</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-[#3d362e]">
                {pageContent.form.emailLabel}
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={(e) => updateFormField("email", e.target.value)}
                disabled={isLoading}
                placeholder="you@studio.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-[#3d362e]">
                {pageContent.form.passwordLabel}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={(e) => updateFormField("password", e.target.value)}
                  disabled={isLoading}
                  minLength={6}
                  placeholder="At least 6 characters"
                  className="pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-9 w-9 rounded-lg"
                  onClick={togglePasswordVisibility}
                  disabled={isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-[#6b6156]" />
                  ) : (
                    <Eye className="h-4 w-4 text-[#6b6156]" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="h-12 w-full rounded-full text-base" disabled={isLoading}>
              {pageContent.form.submitButton.idle}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
