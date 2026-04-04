"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("E-mail ou senha inválidos");
        setLoading(false);
      } else {
        window.location.href = "/dashboard";
      }
    } catch {
      setError("Erro ao fazer login. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-dark via-primary to-primary-light relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 border border-white/5 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 border border-white/5 rounded-full" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-center">
          <div className="w-64 h-36 bg-white rounded-2xl flex items-center justify-center mb-10 shadow-2xl animate-fade-in p-1 overflow-hidden border-4 border-white/20">
            <Image 
              src="/logo.png" 
              alt="Logo EBD com Propósito" 
              width={240} 
              height={140} 
              className="object-contain"
            />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 animate-slide-up">
            EBD com Propósito
          </h1>
          <p className="text-accent-light text-lg font-medium mb-6 animate-slide-up">
            &ldquo;Organização a serviço do Reino&rdquo;
          </p>
          <p className="text-white/60 max-w-md text-sm leading-relaxed animate-slide-up">
            Sistema completo para gestão da Escola Bíblica Dominical.
            Controle presença, alunos, classes, lições e acompanhe
            o crescimento da sua EBD.
          </p>

          {/* Feature highlights */}
          <div className="mt-12 grid grid-cols-2 gap-4 max-w-sm animate-fade-in">
            {[
              "Controle de Presença",
              "Gestão de Alunos",
              "Relatórios Detalhados",
              "Dashboards Visuais",
            ].map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-2 text-white/70 text-xs"
              >
                <div className="w-1.5 h-1.5 bg-accent rounded-full" />
                {feature}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md animate-slide-up">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-40 h-24 bg-white rounded-xl flex items-center justify-center mb-4 shadow-lg p-0.5 overflow-hidden border border-gray-100">
              <Image 
                src="/logo.png" 
                alt="Logo EBD" 
                width={150} 
                height={90} 
                className="object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-primary">EBD com Propósito</h1>
            <p className="text-accent text-sm">&ldquo;Organização a serviço do Reino&rdquo;</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Bem-vindo!</h2>
              <p className="text-gray-500 mt-1 text-sm">
                Faça login para acessar o sistema
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  required
                  defaultValue="admin@ebdcomproposito.com"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password">Senha</Label>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline cursor-pointer"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    defaultValue="admin123"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </div>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-gray-400">
                v1.0.0 • EBD com Propósito © 2026
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
