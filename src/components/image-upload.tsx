"use client";

import React, { useState } from "react";
import { Upload, Loader2, X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";

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

    // Local preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setLoading(true);
    console.log("Iniciando upload do arquivo:", file.name);

    try {
      const response = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file,
      });

      const data = await response.json();
      console.log("Resposta do servidor:", data);

      if (data.url) {
        onUpload(data.url);
        console.log("Upload concluído com sucesso. URL:", data.url);
      } else {
        console.error("Erro no upload: URL não retornada", data);
        alert("Erro ao processar imagem no servidor.");
      }
    } catch (error) {
      console.error('Network error during upload:', error);
      alert("Erro de conexão ao enviar imagem.");
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
