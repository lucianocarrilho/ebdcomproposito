"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Edit,
  Trash2,
  Mail,
  Key,
  Loader2,
  UserPlus,
  Fingerprint,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { resolveSessionActiveRole } from "@/lib/user-access-validation";

interface User {
  id: string;
  userId?: string;
  membershipId?: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  image?: string | null;
  birthDate?: string | null;
  isSharedUser?: boolean;
  isGlobalAdmin?: boolean;
}

export default function UsuariosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const activeOrgId = (session?.user as { activeOrganizationId?: string | null } | undefined)
    ?.activeOrganizationId;
  const activeRole = resolveSessionActiveRole(session?.user as any);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("APOIO");
  const [image, setImage] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erro ao carregar lista de acessos");
        setUsers([]);
        return;
      }
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      toast.error("Erro ao carregar lista de acessos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (status === "authenticated") {
      if (activeRole !== "ADMIN") {
        toast.error("Área restrita a administradores");
        router.push("/dashboard");
        return;
      }
      fetchUsers();
    }
  }, [status, activeRole, activeOrgId, router, fetchUsers]);

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setImage(user.image || "");
      setBirthDate(
        user.birthDate
          ? new Date(user.birthDate).toISOString().split("T")[0]
          : ""
      );
    } else {
      setEditingUser(null);
      setName("");
      setEmail("");
      setRole("APOIO");
      setImage("");
      setBirthDate("");
    }
    setPassword("");
    setIsDialogOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await fetch(
        `/api/upload?filename=${encodeURIComponent(file.name)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        }
      );

      if (!res.ok) throw new Error("Erro ao subir imagem");
      const data = await res.json();
      setImage(data.url);
      toast.success("Foto enviada!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Falha ao subir foto");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = editingUser?.isSharedUser
      ? { role }
      : editingUser
        ? {
            name,
            email,
            role,
            image: image || null,
            birthDate: birthDate
              ? new Date(birthDate + "T12:00:00").toISOString()
              : null,
            ...(password ? { password } : {}),
          }
        : {
            ...(name.trim() ? { name: name.trim() } : {}),
            email,
            role,
            ...(image ? { image } : {}),
            ...(birthDate
              ? { birthDate: new Date(birthDate + "T12:00:00").toISOString() }
              : {}),
            ...(password ? { password } : {}),
          };

    try {
      const targetId = editingUser
        ? editingUser.membershipId || editingUser.id
        : null;
      const url = targetId ? `/api/users/${targetId}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        if (editingUser) {
          toast.success("Acesso atualizado!");
        } else if (data.linkedExistingUser) {
          toast.success("Usuário existente vinculado à congregação!");
        } else {
          toast.success("Acesso criado!");
        }
        fetchUsers();
        setIsDialogOpen(false);
      } else {
        toast.error(data.error || "Erro ao salvar acesso");
      }
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro de conexão");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const targetId = deleteConfirm.membershipId || deleteConfirm.id;
    try {
      const res = await fetch(`/api/users/${targetId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Acesso removido desta congregação");
        fetchUsers();
        setDeleteConfirm(null);
      } else {
        toast.error(data.error || "Erro ao remover acesso");
      }
    } catch (error) {
      console.error("Erro ao deletar:", error);
      toast.error("Erro de conexão");
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-gray-500">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p>Carregando gestores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Fingerprint className="h-6 w-6 text-primary" />
            Gestão de Acessos
          </h1>
          <p className="page-subtitle">
            Gerencie os vínculos e perfis de acesso desta congregação
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <UserPlus className="h-4 w-4" /> Novo Acesso
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Acessos da Congregação</CardTitle>
            <CardDescription>
              Usuários com vínculo ativo autorizado nesta congregação
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead>Nome & Email</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead className="hidden md:table-cell text-center">
                    Data Vínculo
                  </TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.membershipId || user.id}
                    className="hover:bg-gray-50/30 transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold overflow-hidden border-2 border-white shadow-sm">
                          {user.image ? (
                            <img
                              src={user.image}
                              alt={user.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            user.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-gray-900">
                              {user.name}
                            </p>
                            {user.isSharedUser && (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                              >
                                Compartilhado
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          user.role === "ADMIN"
                            ? "bg-red-50 text-red-700 border-red-100"
                            : "bg-blue-50 text-blue-700 border-blue-100"
                        }
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-center text-xs text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => setDeleteConfirm(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {users.length === 0 && (
              <div className="text-center py-12 text-gray-400 italic">
                Nenhum vínculo ativo cadastrado nesta congregação.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog Criar/Editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Editar Acesso" : "Criar ou Vincular Acesso"}
            </DialogTitle>
            <DialogDescription>
              {editingUser?.isSharedUser
                ? "Este usuário possui acesso em outras congregações ou é Admin Global. Apenas o perfil nesta congregação pode ser alterado."
                : "Defina as credenciais para o acesso na congregação atual."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {/* Foto Upload */}
            <div className="flex flex-col items-center gap-2 pb-2">
              <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative group">
                {image ? (
                  <img
                    src={image}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Users className="h-8 w-8 text-gray-300" />
                )}
                {!editingUser?.isSharedUser && (
                  <label className="absolute inset-0 bg-black/40 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    Alterar
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileUpload}
                    />
                  </label>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}
              </div>
              {!editingUser?.isSharedUser && (
                <p className="text-[10px] text-gray-400">
                  Clique para subir a foto do usuário
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="userName">Nome do Gestor</Label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="userName"
                  className="pl-9"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={Boolean(editingUser?.isSharedUser)}
                  placeholder="Ex: João da Silva"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="userEmail">Email de Acesso</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="userEmail"
                  type="email"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={Boolean(editingUser?.isSharedUser)}
                  required
                  placeholder="joao@igreja.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="userRole">Perfil de Permissão</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrador (Total)</SelectItem>
                  <SelectItem value="DIRIGENTE">Dirigente (Relatórios)</SelectItem>
                  <SelectItem value="VICE_DIRIGENTE">Vice-Dirigente</SelectItem>
                  <SelectItem value="PROFESSOR">Professor (Sua Classe)</SelectItem>
                  <SelectItem value="APOIO">Apoio (Secretaria)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!editingUser?.isSharedUser && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Data de Aniversário</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    className="w-full"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userPassword">
                    {editingUser
                      ? "Nova Senha (deixe vazio para não alterar)"
                      : "Senha de Acesso"}
                  </Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="userPassword"
                      type="password"
                      className="pl-9"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  {!editingUser && (
                    <p className="text-[11px] text-gray-500">
                      Se o e-mail já estiver cadastrado em outra congregação, deixe a senha em branco para vincular mantendo a senha atual.
                    </p>
                  )}
                </div>
              </>
            )}

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={saving || uploading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || uploading}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingUser ? "Salvar Alterações" : "Criar / Vincular Acesso"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Remoção de Vínculo */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-center text-red-600">
              Remover Acesso da Congregação?
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              Isso removerá o acesso de <strong>{deleteConfirm?.name}</strong>{" "}
              apenas nesta congregação. Vínculos em outras congregações e acesso
              de Admin Global serão preservados.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="flex-1"
            >
              Remover Acesso
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
