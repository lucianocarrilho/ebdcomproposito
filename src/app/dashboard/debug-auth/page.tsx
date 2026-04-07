import { auth } from "@/lib/auth";

export default async function DebugAuthPage() {
  const session = await auth();

  return (
    <div className="p-10 space-y-4">
      <h1 className="text-2xl font-bold">Diagnóstico de Sessão</h1>
      <pre className="bg-gray-100 p-4 rounded overflow-auto">
        {JSON.stringify(session, null, 2)}
      </pre>
      <div className="text-sm text-gray-500">
        Copie as informações acima e me envie para eu cruzar com o banco de dados.
      </div>
    </div>
  );
}
