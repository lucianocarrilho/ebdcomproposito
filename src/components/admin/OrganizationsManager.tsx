"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Search,
  Edit,
  Power,
  PowerOff,
  Loader2,
  Users,
  GraduationCap,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import OrgAccessButton from "@/components/admin/OrgAccessButton";
import {
  ORG_NAME_MAX_LENGTH,
  ORG_SLUG_MAX_LENGTH,
  suggestOrganizationSlug,
  validateOrganizationName,
  validateOrganizationSlug,
} from "@/lib/organization-validation";

export interface OrganizationItem {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    memberships: number;
    classes: number;
    students: number;
  };
}

type StatusFilter = "all" | "active" | "inactive";

interface OrganizationsManagerProps {
  initialOrganizations: OrganizationItem[];
}

export default function OrganizationsManager({
  initialOrganizations,
}: OrganizationsManagerProps) {
  const router = useRouter();
  const [organizations, setOrganizations] =
    useState<OrganizationItem[]>(initialOrganizations);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Create/Edit Dialog state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrganizationItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Deactivate confirmation state
  const [orgToDeactivate, setOrgToDeactivate] =
    useState<OrganizationItem | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const activeCount = useMemo(
    () => organizations.filter((org) => org.active).length,
    [organizations]
  );
  const inactiveCount = organizations.length - activeCount;

  const filteredOrganizations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return organizations.filter((org) => {
      if (statusFilter === "active" && !org.active) return false;
      if (statusFilter === "inactive" && org.active) return false;
      if (!term) return true;
      return (
        org.name.toLowerCase().includes(term) ||
        org.slug.toLowerCase().includes(term)
      );
    });
  }, [organizations, search, statusFilter]);

  const reloadOrganizations = async () => {
    try {
      const res = await fetch("/api/admin/organizations", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as OrganizationItem[];
        setOrganizations(data);
      }
    } catch {
      // Silently keep current list if reload fails
    }
    router.refresh();
  };

  const openCreateDialog = () => {
    setEditingOrg(null);
    setFormName("");
    setFormSlug("");
    setSlugTouched(false);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditDialog = (org: OrganizationItem) => {
    setEditingOrg(org);
    setFormName(org.name);
    setFormSlug(org.slug);
    setSlugTouched(true);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleNameChange = (value: string) => {
    setFormName(value);
    if (!editingOrg && !slugTouched) {
      setFormSlug(suggestOrganizationSlug(value));
    }
    if (formError) setFormError(null);
  };

  const handleSlugChange = (value: string) => {
    setSlugTouched(true);
    setFormSlug(value.toLowerCase());
    if (formError) setFormError(null);
  };

  const handleSubmitForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const nameCheck = validateOrganizationName(formName);
    if (!nameCheck.valid) {
      setFormError(nameCheck.error);
      return;
    }

    const slugCheck = validateOrganizationSlug(formSlug);
    if (!slugCheck.valid) {
      setFormError(slugCheck.error);
      return;
    }

    setSaving(true);
    try {
      const endpoint = editingOrg
        ? `/api/admin/organizations/${editingOrg.id}`
        : "/api/admin/organizations";
      const method = editingOrg ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameCheck.data,
          slug: slugCheck.data,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Não foi possível salvar a congregação.");
        return;
      }

      toast.success(
        editingOrg
          ? "Congregação atualizada com sucesso."
          : "Congregação criada com sucesso."
      );
      setIsFormOpen(false);
      setEditingOrg(null);
      await reloadOrganizations();
    } catch {
      setFormError("Erro de conexão ao salvar congregação.");
    } finally {
      setSaving(false);
    }
  };

  const executeToggleActive = async (
    org: OrganizationItem,
    nextActive: boolean
  ) => {
    setTogglingId(org.id);
    try {
      const res = await fetch(`/api/admin/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(
          data.error ||
            (nextActive
              ? "Não foi possível ativar a congregação."
              : "Não foi possível desativar a congregação.")
        );
        return;
      }

      toast.success(
        nextActive
          ? `Congregação "${org.name}" ativada com sucesso.`
          : `Congregação "${org.name}" desativada com sucesso.`
      );
      await reloadOrganizations();
    } catch {
      toast.error("Erro de conexão ao atualizar status da congregação.");
    } finally {
      setTogglingId(null);
      setOrgToDeactivate(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Congregações</h1>
          <p className="text-gray-500">
            Cadastre, edite, ative, desative e acesse as congregações do
            sistema.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          Nova Congregação
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-900">
                {organizations.length}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Ativas</p>
              <p className="text-2xl font-bold text-emerald-700">
                {activeCount}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
              <Power className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Inativas</p>
              <p className="text-2xl font-bold text-gray-700">
                {inactiveCount}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-gray-100 text-gray-600">
              <PowerOff className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome ou slug..."
            className="pl-9 bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            Todas ({organizations.length})
          </Button>
          <Button
            type="button"
            variant={statusFilter === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("active")}
          >
            Ativas ({activeCount})
          </Button>
          <Button
            type="button"
            variant={statusFilter === "inactive" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("inactive")}
          >
            Inativas ({inactiveCount})
          </Button>
        </div>
      </div>

      {/* Organizations List */}
      <Card>
        <CardHeader className="border-b border-gray-100">
          <CardTitle className="text-base font-semibold text-gray-900">
            Congregações Cadastradas ({filteredOrganizations.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredOrganizations.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <Building2 className="h-10 w-10 mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-700">
                Nenhuma congregação encontrada
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Ajuste o filtro ou crie uma nova congregação para começar.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredOrganizations.map((org) => {
                const isToggling = togglingId === org.id;

                return (
                  <div
                    key={org.id}
                    className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-gray-50/70 transition-colors"
                  >
                    <div className="flex items-start sm:items-center gap-4 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          org.active
                            ? "bg-primary/10 text-primary"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {org.name}
                          </h3>
                          <Badge
                            variant={org.active ? "success" : "destructive"}
                          >
                            {org.active ? "Ativa" : "Inativa"}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Slug:{" "}
                          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                            {org.slug}
                          </code>
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <UserCheck className="h-3.5 w-3.5 text-gray-400" />
                            {org._count.memberships} vínculo(s)
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <GraduationCap className="h-3.5 w-3.5 text-gray-400" />
                            {org._count.classes} classe(s)
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3.5 w-3.5 text-gray-400" />
                            {org._count.students} aluno(s)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap lg:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(org)}
                        disabled={isToggling}
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Editar
                      </Button>

                      {org.active ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-amber-700 border-amber-200 hover:bg-amber-50 hover:text-amber-800"
                          onClick={() => setOrgToDeactivate(org)}
                          disabled={isToggling}
                        >
                          {isToggling ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <PowerOff className="h-3.5 w-3.5" />
                          )}
                          Desativar
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                          onClick={() => executeToggleActive(org, true)}
                          disabled={isToggling}
                        >
                          {isToggling ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                          Ativar
                        </Button>
                      )}

                      <OrgAccessButton orgId={org.id} active={org.active} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Organization Modal */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!saving) {
            setIsFormOpen(open);
            if (!open) {
              setEditingOrg(null);
              setFormError(null);
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingOrg ? "Editar Congregação" : "Nova Congregação"}
            </DialogTitle>
            <DialogDescription>
              {editingOrg
                ? "Atualize o nome e o identificador único (slug) da congregação."
                : "Informe o nome e o identificador único (slug) para criar uma nova congregação."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitForm} className="space-y-4">
            {formError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="org-name">Nome da Congregação</Label>
              <Input
                id="org-name"
                value={formName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Congregação Central"
                maxLength={ORG_NAME_MAX_LENGTH}
                required
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-slug">Slug (identificador único)</Label>
              <Input
                id="org-slug"
                value={formSlug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="Ex: congregacao-central"
                maxLength={ORG_SLUG_MAX_LENGTH}
                required
                disabled={saving}
              />
              <p className="text-xs text-gray-500">
                Use apenas letras minúsculas sem acentos, números e hífens.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingOrg ? "Salvar Alterações" : "Criar Congregação"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation AlertDialog */}
      <AlertDialog
        open={!!orgToDeactivate}
        onOpenChange={(open) => {
          if (!open && !togglingId) {
            setOrgToDeactivate(null);
          }
        }}
      >
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar Congregação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar a congregação{" "}
              <strong className="text-gray-900">
                {orgToDeactivate?.name}
              </strong>
              ? Os usuários vinculados perderão o acesso operacional a ela até
              que seja reativada. Nenhum dado histórico será excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!togglingId}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!!togglingId}
              onClick={(e) => {
                e.preventDefault();
                if (orgToDeactivate) {
                  void executeToggleActive(orgToDeactivate, false);
                }
              }}
            >
              {togglingId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Desativando...
                </>
              ) : (
                "Confirmar Desativação"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
