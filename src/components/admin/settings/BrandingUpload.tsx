import { useState, useRef } from 'react';
import { Image, Upload, Trash2, Loader2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface BrandingUploadProps {
  label: React.ReactNode;
  description: string;
  currentUrl: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
  uploadPath: string;
  previewSize: 'large' | 'small';
}

export function BrandingUpload({
  label,
  description,
  currentUrl,
  onUpload,
  onRemove,
  uploadPath,
  previewSize,
}: BrandingUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon'];
    if (!validTypes.includes(file.type)) {
      toast.error(t.brandingUpload.invalidFileType);
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t.brandingUpload.fileTooLarge);
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${uploadPath}_${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('branding-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('branding-assets')
        .getPublicUrl(fileName);

      onUpload(urlData.publicUrl);
      const labelText = typeof label === 'string' ? label : 'Asset';
      toast.success(t.brandingUpload.uploadedSuccessfully.replace('{label}', labelText));
    } catch (err) {
      console.error('Upload error:', err);
      const labelText = typeof label === 'string' ? label : 'asset';
      toast.error(t.brandingUpload.failedToUpload.replace('{label}', labelText));
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (!currentUrl) return;

    try {
      // Extract filename from URL
      const urlParts = currentUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      
      // Delete from storage
      await supabase.storage
        .from('branding-assets')
        .remove([fileName]);

      onRemove();
      toast.success(t.brandingUpload.removed.replace('{label}', typeof label === 'string' ? label : 'Asset'));
    } catch (err) {
      console.error('Remove error:', err);
      // Still remove from state even if storage delete fails
      onRemove();
    }
  };

  const previewImageSize = previewSize === 'large' ? 'h-16 w-16' : 'h-8 w-8';
  const placeholderIconSize = previewSize === 'large' ? 'h-8 w-8' : 'h-6 w-6';

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <div className="flex items-start gap-4">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 overflow-hidden">
          {currentUrl ? (
            <img 
              src={currentUrl} 
              alt={typeof label === 'string' ? label : 'Preview'} 
              className={`${previewImageSize} object-contain`}
            />
          ) : (
            previewSize === 'large' ? (
              <Image className={`${placeholderIconSize} text-muted-foreground/50`} />
            ) : (
              <Globe className={`${placeholderIconSize} text-muted-foreground/50`} />
            )
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              {currentUrl ? t.brandingUpload.change : t.brandingUpload.upload}
            </Button>
            {currentUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={uploading}
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t.brandingUpload.remove}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {description}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}
