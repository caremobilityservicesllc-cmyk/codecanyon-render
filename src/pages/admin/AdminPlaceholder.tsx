import { Construction } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';

interface AdminPlaceholderProps {
  title: string;
  description: string;
}

export default function AdminPlaceholder({ title, description }: AdminPlaceholderProps) {
  return (
    <AdminLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
          <Construction className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-muted-foreground max-w-md">{description}</p>
      </div>
    </AdminLayout>
  );
}
