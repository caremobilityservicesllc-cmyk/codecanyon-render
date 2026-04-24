import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Search, Users, Mail, Phone, Car, Calendar } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { TablePagination } from '@/components/admin/TablePagination';
import { useServerPagination } from '@/hooks/useServerPagination';
import type { Database } from '@/integrations/supabase/types';
import {
  MobileDataCard,
  MobileDataRow,
  MobileDataHeader,
  MobileDataList,
} from '@/components/admin/MobileDataCard';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useLanguage } from '@/contexts/LanguageContext';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function AdminCustomers() {
  const { t } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalCustomers, setTotalCustomers] = useState(0);

  const pagination = useServerPagination({ defaultPageSize: 10 });

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (searchQuery.trim()) {
        query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
      }

      query = query.range(pagination.rangeFrom, pagination.rangeTo);

      const { data, error, count } = await query;

      if (error) throw error;
      setProfiles(data || []);
      pagination.setTotalCount(count || 0);
      if (!searchQuery.trim()) setTotalCustomers(count || 0);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast.error(t.admin.failedToLoadCustomers);
    } finally {
      setLoading(false);
    }
  }, [pagination.rangeFrom, pagination.rangeTo, searchQuery]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    pagination.resetPage();
  }, [searchQuery]);

  return (
    <AdminLayout
      title={t.admin.customers}
      description={t.admin.viewManageCustomers}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.admin.totalCustomers}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{totalCustomers}</span>
            </div>
          </CardContent>
        </Card>

        <div className="relative max-w-md">
          <Search className="absolute inset-inline-start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t.admin.searchCustomers}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-10"
          />
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden">
          <MobileDataList
            isLoading={loading}
            loadingText={t.admin.loadingCustomers}
            isEmpty={profiles.length === 0}
            emptyText={t.admin.noCustomersFound}
          >
            {profiles.map((profile) => (
              <MobileDataCard key={profile.id}>
                <MobileDataHeader
                  title={
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      {profile.full_name || 'N/A'}
                    </div>
                  }
                />
                {profile.email && (
                  <MobileDataRow label={t.auth.email}>
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate max-w-[150px]">{profile.email}</span>
                    </div>
                  </MobileDataRow>
                )}
                {profile.phone && (
                  <MobileDataRow label={t.common.phone}>
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      {profile.phone}
                    </div>
                  </MobileDataRow>
                )}
                <MobileDataRow label={t.admin.preferredVehicle}>
                  <div className="flex items-center gap-1">
                    <Car className="h-3 w-3 text-muted-foreground" />
                    {profile.preferred_vehicle || t.common.none}
                  </div>
                </MobileDataRow>
                <MobileDataRow label={t.admin.joined}>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {format(new Date(profile.created_at), 'MMM dd, yyyy')}
                  </div>
                </MobileDataRow>
              </MobileDataCard>
            ))}
          </MobileDataList>

          <TablePagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            totalPages={pagination.totalPages}
            from={pagination.from}
            to={pagination.to}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block rounded-xl border border-border bg-card shadow-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.auth.fullName}</TableHead>
                <TableHead>{t.auth.email}</TableHead>
                <TableHead>{t.common.phone}</TableHead>
                <TableHead>{t.admin.preferredVehicle}</TableHead>
                <TableHead>{t.admin.joined}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {t.admin.noCustomersFound}
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">
                      {profile.full_name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {profile.email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {profile.email}
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {profile.phone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {profile.phone}
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>{profile.preferred_vehicle || t.common.none}</TableCell>
                    <TableCell>
                      {format(new Date(profile.created_at), 'MMM dd, yyyy')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <TablePagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            totalPages={pagination.totalPages}
            from={pagination.from}
            to={pagination.to}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </div>
      </div>
    </AdminLayout>
  );
}