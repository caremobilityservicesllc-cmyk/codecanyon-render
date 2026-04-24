import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const notificationIcons: Record<string, string> = {
  booking_confirmed: '✅',
  driver_assigned: '🚗',
  driver_arriving: '📍',
  ride_started: '🚀',
  ride_completed: '🏁',
  ride_cancelled: '❌',
  reminder: '⏰',
  promo: '🎉',
  share_invitation: '📩',
  share_accepted: '✅',
  share_declined: '👋',
  share_counter_proposal: '💬',
};

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications();
  const { t } = useLanguage();

  if (!user) return null;

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }
    if (notification.booking_id) {
      navigate(`/track?id=${notification.booking_id}`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t.notificationBell.notifications}</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-xs"
              onClick={() => markAllAsRead.mutate()}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              {t.notificationBell.markAllRead}
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t.notificationBell.loadingNotifications}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t.notificationBell.noNotifications}</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  'flex flex-col items-start gap-1 p-3 cursor-pointer transition-colors',
                  !notification.is_read && 'bg-primary/5',
                  notification.booking_id && 'hover:bg-primary/10'
                )}
                onSelect={(e) => {
                  e.preventDefault();
                  handleNotificationClick(notification);
                }}
              >
                <div className="flex items-start gap-2 w-full">
                  <span className="text-lg shrink-0">
                    {notificationIcons[notification.type] || '📌'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{notification.title}</p>
                      {!notification.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground/70">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                      {notification.booking_id && (
                        <span className="text-xs text-accent flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          {t.notificationBell.viewDetails}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
