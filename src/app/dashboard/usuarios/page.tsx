"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, Plus, Edit, Trash2, Shield, Mail, Key, 
  Check, X, Loader2, AlertCircle, UserPlus, Fingerprint
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  image?: string;
}

export default function UsuariosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.role !== "ADMIN") {
      toast.error("Área restrita a administradores");
      router.push("/dashboard");
    }
  }, [status, session, router]);

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

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      toast.error("Erro ao carregar lista de usuários");
    } finally {
      setLoading(false);
    }
  }

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
    } else {
      setEditingUser(null);
      setName("");
      setEmail("");
      setRole("APOIO");
    }
    setPassword("");
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      name,
      email,
      role,
      password: password || undefined,
    };

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(editingUser ? "Usuário atualizado!" : "Usuário criado!");
        fetchUsers();
        setIsDialogOpen(false);
      } else {
        toast.error(data.error || "Erro ao salvar usuário");
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
    try {
      const res = await fetch(`/api/users/${deleteConfirm.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Usuário desativado com sucesso");
        fetchUsers();
        setDeleteConfirm(null);
      } else {
        toast.error("Erro ao desativar usuário");
      }
    } catch (error) {
      console.error("Erro ao deletar:", error);
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
          <p className="page-subtitle">Configure quem pode entrar e gerenciar o sistema</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <UserPlus className="h-4 w-4" /> Novo Acesso
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Usuários Cadastrados</CardTitle>
            <CardDescription>Pessoas com permissão de login no EBD com Propósito</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead>Nome & Email</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead className="hidden md:table-cell text-center">Data Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-gray-50/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-900">{user.name}</p>
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
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(user)}>
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
                Nenhum usuário cadastrado além de você.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog Criar/Editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar Acesso" : "Criar Novo Acesso"}</DialogTitle>
            <DialogDescription>
              Defina as credenciais para o novo gestor do sistema.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="userName">Nome do Gestor</Label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  id="userName" 
                  className="pl-9" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
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
                  onChange={e => setEmail(e.target.value)} 
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
                  <SelectItem value="APOIO">Apoio (Secretaria)</SelectItem>
                  <SelectItem value="DIRIGENTE">Dirigente (Relatórios)</SelectItem>
                  <SelectItem value="PROFESSOR">Professor (Sua Classe)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="userPassword">
                {editingUser ? "Nova Senha (deixe vazio para não alterar)" : "Senha de Acesso"}
              </Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  id="userPassword" 
                  type="password"
                  className="pl-9" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required={!editingUser}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingUser ? "Salvar Alterações" : "Criar Acesso"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Exclusão */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-center text-red-600">Remover Acesso?</DialogTitle>
            <DialogDescription className="text-center pt-2">
              Isso desativará o login de <strong>{deleteConfirm?.name}</strong>. 
              Ele não poderá mais entrar no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} className="flex-1">Desativar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
