import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PageContent {
  id: string;
  page_slug: string;
  title: string;
  content: string;
  meta_description: string;
  is_published: boolean;
  updated_at: string;
  updated_by: string | null;
  footer_section: 'legal' | 'quick_links' | 'none';
}

export function usePageContent(slug: string) {
  const [page, setPage] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPage() {
      setLoading(true);
      const { data, error } = await supabase
        .from('page_content')
        .select('*')
        .eq('page_slug', slug)
        .eq('is_published', true)
        .maybeSingle();

      if (!error && data) {
        setPage(data as PageContent);
      }
      setLoading(false);
    }
    fetchPage();
  }, [slug]);

  return { page, loading };
}

export function useAllPages() {
  const [pages, setPages] = useState<PageContent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('page_content')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setPages(data as PageContent[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPages();
  }, []);

  return { pages, loading, refetch: fetchPages };
}

export function useAllPublishedPages() {
  const [pages, setPages] = useState<PageContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('page_content')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: true });
      if (data) setPages(data as PageContent[]);
      setLoading(false);
    }
    fetch();
  }, []);

  return { pages, loading };
}
