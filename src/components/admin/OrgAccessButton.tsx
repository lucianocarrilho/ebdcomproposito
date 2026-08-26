"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function OrgAccessButton({ orgId, active }: { orgId: string, active: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { update } = useSession();

  const handleAccess = async () => {
    if (!active) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId })
      });
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Erro ao acessar congregação");
        setLoading(false);
        return;
      }

      await update({ activeOrganizationId: orgId });
      router.push("/dashboard");
    } catch (error) {
      alert("Erro de comunicação com o servidor.");
      setLoading(false);
    }
  };

  if (!active) return null;

  return (
    <button
      onClick={handleAccess}
      disabled={loading}
      className="ml-4 flex items-center space-x-1 text-sm font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          <span>Acessar congregação</span>
          <ArrowRight className="w-4 h-4" />
        </>
      )}
    </button>
  );
}
