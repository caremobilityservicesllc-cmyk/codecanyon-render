import { useState, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAllPages, PageContent } from '@/hooks/usePageContent';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Eye, EyeOff, FileText, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

function PageEditor({ 
  page, 
  onSave, 
  onClose,
  t,
}: { 
  page: PageContent | null; 
  onSave: () => void; 
  onClose: () => void;
  t: any;
}) {
  const { user } = useAuth();
  const isNew = !page;
  const [title, setTitle] = useState(page?.title || '');
  const [slug, setSlug] = useState(page?.page_slug || '');
  const [content, setContent] = useState(page?.content || '');
  const [metaDescription, setMetaDescription] = useState(page?.meta_description || '');
  const [isPublished, setIsPublished] = useState(page?.is_published ?? true);
  const [footerSection, setFooterSection] = useState<string>(page?.footer_section || 'quick_links');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !slug.trim()) {
      toast.error(t.admin.titleSlugRequired);
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const { error } = await supabase.from('page_content').insert({
          page_slug: slug.toLowerCase().replace(/\s+/g, '-'),
          title,
          content,
          meta_description: metaDescription,
          is_published: isPublished,
          footer_section: footerSection,
          updated_by: user?.id || null,
        });
        if (error) throw error;
        toast.success(t.admin.pageCreated);
      } else {
        const { error } = await supabase
          .from('page_content')
          .update({
            title,
            content,
            meta_description: metaDescription,
            is_published: isPublished,
            footer_section: footerSection,
            updated_by: user?.id || null,
          })
          .eq('id', page.id);
        if (error) throw error;
        toast.success(t.admin.pageUpdated);
      }
      onSave();
      onClose();
    } catch (err: any) {
      toast.error(err.message || t.admin.failedToSavePage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t.admin.pageTitle}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={(t as any).placeholders?.pageTitle || "Terms of Service"} />
        </div>
        <div className="space-y-2">
          <Label>{t.admin.urlSlug}</Label>
          <Input 
            value={slug} 
            onChange={(e) => setSlug(e.target.value)} 
            placeholder="terms-of-service" 
            disabled={!isNew}
          />
          {!isNew && <p className="text-xs text-muted-foreground">{t.admin.slugCannotChange}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t.admin.metaDescriptionSeo}</Label>
        <Input 
          value={metaDescription} 
          onChange={(e) => setMetaDescription(e.target.value)} 
          placeholder={t.admin.metaDescriptionPlaceholder} 
          maxLength={160}
        />
        <p className="text-xs text-muted-foreground">{metaDescription.length}/160 {t.admin.characters}</p>
      </div>

      <div className="space-y-2">
        <Label>{t.admin.pageContent}</Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t.admin.pageContentPlaceholder}
          className="min-h-[250px] font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label>{t.admin.footerSection}</Label>
        <select
          value={footerSection}
          onChange={(e) => setFooterSection(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="quick_links">{t.admin.quickLinksSection}</option>
          <option value="legal">{t.admin.legalSection}</option>
          <option value="none">{t.admin.dontShowInFooter}</option>
        </select>
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={isPublished} onCheckedChange={setIsPublished} />
        <Label>{t.admin.published}</Label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>{t.common.cancel}</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {isNew ? t.admin.createPage : t.admin.savePageChanges}
        </Button>
      </div>
    </div>
  );
}

export default function AdminPages() {
  const { t } = useLanguage();
  const { pages, loading, refetch } = useAllPages();
  const [editingPage, setEditingPage] = useState<PageContent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleDelete = async (page: PageContent) => {
    if (!confirm(`${t.common.delete} "${page.title}"?`)) return;
    const { error } = await supabase.from('page_content').delete().eq('id', page.id);
    if (error) {
      toast.error(t.admin.failedToDeletePage);
    } else {
      toast.success(t.admin.pageDeleted);
      refetch();
    }
  };

  const openEditor = (page: PageContent | null) => {
    setEditingPage(page);
    setCreating(!page);
    setDialogOpen(true);
  };

  const slugToRoute: Record<string, string> = {
    'terms-of-service': '/terms',
    'privacy-policy': '/privacy',
    'contact': '/contact',
  };

  return (
    <AdminLayout title={t.admin.pageManagement} description={t.admin.pageManagementDesc}>
      <div className="flex justify-end mb-6">
        <Button onClick={() => openEditor(null)}>
          <Plus className="h-4 w-4 mr-2" />
          {t.admin.newPage}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : pages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t.admin.noPagesYet}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pages.map((page) => (
            <Card key={page.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{page.title}</h3>
                      <Badge variant={page.is_published ? 'default' : 'secondary'}>
                        {page.is_published ? t.admin.published : t.admin.draft}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">/{page.page_slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {slugToRoute[page.page_slug] && (
                    <Button variant="ghost" size="icon" asChild>
                      <a href={slugToRoute[page.page_slug]} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEditor(page)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(page)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{creating ? t.admin.createNewPage : `${t.admin.editPage}: ${editingPage?.title}`}</DialogTitle>
          </DialogHeader>
          <PageEditor 
            page={creating ? null : editingPage} 
            onSave={refetch} 
            onClose={() => setDialogOpen(false)}
            t={t}
          />
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
