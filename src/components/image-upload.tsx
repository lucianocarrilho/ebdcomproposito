"use client";

import React, { useState, useEffect } from "react";
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
  
  // Sincronizar prévia quando a imagem padrão mudar (ex: ao fechar/abrir diálogos)
  useEffect(() => {
    setPreview(defaultImage || null);
  }, [defaultImage]);

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
      // Usamos apenas a API do servidor (/api/upload) para upload
      // Isso evita problemas de CORS e permite centralizar o token no backend
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
        console.log('Upload concluído:', serverData.url);
        toast.success("Foto enviada com sucesso!");
      } else {
        throw new Error('Servidor não retornou a URL da imagem.');
      }
    } catch (error: any) {
      console.error('--- ERRO NO UPLOAD ---');
      console.error('Mensagem:', error.message);
      
      const finalError = error.message === 'Failed to fetch' 
        ? "Não foi possível conectar ao servidor de upload. Verifique sua conexão."
        : error.message;

      toast.error(`Falha no upload: ${finalError}`);
      
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
