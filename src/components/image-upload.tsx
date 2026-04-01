"use client";

import React, { useState } from "react";
import { Upload, Loader2, X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { toast } from "sonner";

interface ImageUploadProps {
  onUpload: (url: string) => void;
  defaultImage?: string | null;
  label?: string;
}

export function ImageUpload({ onUpload, defaultImage, label = "Foto" }: ImageUploadProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(defaultImage || null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 4 * 1024 * 1024; // 4MB
    if (file.size > maxSize) {
      alert(`O arquivo é muito grande (${(file.size / 1024 / 1024).toFixed(2)}MB). O limite é 4MB.`);
      return;
    }

    setLoading(true);
    console.log("Iniciando processo de upload para:", file.name, "Tamanho:", file.size);

    // Local preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      // 1. Tentar obter credenciais do Vercel Blob via API segura
      let credData;
      try {
        const credRes = await fetch('/api/upload-url');
        if (credRes.ok) {
          credData = await credRes.json();
        }
      } catch (e) {
        console.warn("Falha ao consultar /api/upload-url:", e);
      }
      
      // Se tivermos credenciais, tentamos o upload direto (Cliente -> Vercel Blob)
      if (credData?.token && credData?.baseUrl) {
        console.log("Credenciais do Blob detectadas. Tentando upload direto...");
        
        const sanitized = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-._]/g, '');
        const uniqueName = `${Date.now()}-${sanitized}`;
        const uploadUrl = `${credData.baseUrl}/${uniqueName}`;

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${credData.token}`,
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        });

        if (uploadRes.ok) {
          const publicUrl = `${credData.baseUrl}/${uniqueName}`;
          onUpload(publicUrl);
          console.log('Upload Vercel Blob direto com sucesso:', publicUrl);
          setLoading(false);
          return;
        }
        console.warn('Upload direto falhou (status ' + uploadRes.status + '), tentando via servidor...');
      }

      // 2. Fallback: Upload via API Local (/api/upload)
      // Usamos o corpo binário direto conforme a API espera (request.arrayBuffer())
      console.log("Iniciando upload via API do servidor (/api/upload)...");
      const serverUploadRes = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: {
           'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });

      if (!serverUploadRes.ok) {
        const errorText = await serverUploadRes.text();
        let errorMsg = `Erro ${serverUploadRes.status}`;
        try {
          const errJson = JSON.parse(errorText);
          errorMsg = errJson.details || errJson.error || errorMsg;
        } catch (e) {
          errorMsg = errorText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const serverData = await serverUploadRes.json();
      if (serverData.url) {
        onUpload(serverData.url);
        console.log('Upload via servidor concluído:', serverData.url);
      } else {
        throw new Error('Servidor não retornou a URL da imagem.');
      }

    } catch (error: any) {
      console.error('--- ERRO FATAL NO UPLOAD ---');
      console.error('Mensagem:', error.message);
      console.error('Stack:', error.stack);
      
      toast.error(`Falha no upload: ${error.message || 'Erro desconhecido'}`);
      
      // Reverter preview se falhou e não tinha imagem antes
      if (!defaultImage) setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const clearImage = () => {
    setPreview(null);
    onUpload("");
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-4">
        <div className="relative group overflow-hidden w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
          {preview ? (
            <>
              <Image 
                src={preview} 
                alt="Preview" 
                fill 
                className="object-cover"
              />
              <button 
                type="button"
                onClick={clearImage}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 -translate-y-2 group-hover:translate-x-0 group-hover:translate-y-0"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <Camera className="h-8 w-8 text-gray-300 group-hover:scale-110 transition-transform" />
          )}
          {loading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <Input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            id="image-upload-input"
            onChange={handleFileChange}
            disabled={loading}
          />
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => {
              const input = document.getElementById('image-upload-input');
              if (input) input.click();
            }}
            className="w-full shadow-sm hover:bg-gray-50"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Enviando...
              </div>
            ) : (preview ? "Alterar Foto" : "Selecionar Foto")}
          </Button>
          <p className="text-[10px] text-gray-400 mt-1">PNG, JPG ou GIF. Máx. 4MB.</p>
        </div>
      </div>
    </div>
  );
}
