import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
}

export function ImageUpload({ value, onChange, bucket = "imagens" }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      setImgLoaded(false);
      onChange(data.publicUrl);
    } catch (err: any) {
      toast.error("Erro ao enviar imagem: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {value && (
        <div className="relative w-full h-36 rounded-lg overflow-hidden bg-muted">
          <img
            src={value}
            alt="preview"
            className={`w-full h-full object-cover transition-opacity ${imgLoaded ? "opacity-100" : "opacity-0 absolute"}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => onChange(null)}
          />
          {!imgLoaded && (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              Carregando...
            </div>
          )}
          {imgLoaded && (
            <button
              type="button"
              className="absolute top-1 right-1 bg-black/60 rounded-full p-1 hover:bg-black/80"
              onClick={() => {
                onChange(null);
                setImgLoaded(false);
              }}
            >
              <X className="h-3 w-3 text-white" />
            </button>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="w-full gap-2"
      >
        <Upload className="h-4 w-4" />
        {uploading ? "Enviando..." : value ? "Trocar imagem" : "Selecionar imagem"}
      </Button>
    </div>
  );
}
