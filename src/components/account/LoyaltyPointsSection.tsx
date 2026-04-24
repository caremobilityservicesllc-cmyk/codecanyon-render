import { useQuery } from '@tanstack/react-query';
import { Gift, Star, TrendingUp, TrendingDown, Award, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';

function getTierConfig(t: any) {
  const lt = (t as any).loyaltyTiers || {};
  return {
    bronze: { label: lt.bronze || 'Bronze', color: 'bg-amber-700 text-white', next: lt.silver || 'Silver', pointsNeeded: 500 },
    silver: { label: lt.silver || 'Silver', color: 'bg-gray-400 text-white', next: lt.gold || 'Gold', pointsNeeded: 2000 },
    gold: { label: lt.gold || 'Gold', color: 'bg-yellow-500 text-white', next: lt.platinum || 'Platinum', pointsNeeded: 5000 },
    platinum: { label: lt.platinum || 'Platinum', color: 'bg-purple-600 text-white', next: null, pointsNeeded: null },
  };
}

export function LoyaltyPointsSection() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['loyalty-balance', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('loyalty_balances')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['loyalty-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('loyalty_points')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const isLoading = balanceLoading || historyLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const TIER_CONFIG = getTierConfig(t);
  const totalPoints = balance?.total_points ?? 0;
  const lifetimePoints = balance?.lifetime_points ?? 0;
  const tier = (balance?.tier ?? 'bronze') as keyof ReturnType<typeof getTierConfig>;
  const tierInfo = TIER_CONFIG[tier] || TIER_CONFIG.bronze;

  const progressToNext = tierInfo.pointsNeeded
    ? Math.min((lifetimePoints / tierInfo.pointsNeeded) * 100, 100)
    : 100;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <Gift className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-3xl font-bold text-foreground">{totalPoints.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">{(t as any).loyalty?.availablePoints || 'Available Points'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center">
            <Award className="h-8 w-8 mx-auto mb-2 text-primary" />
            <Badge className={`${tierInfo.color} text-sm px-3 py-1 mb-1`}>
              {tierInfo.label}
            </Badge>
            <p className="text-sm text-muted-foreground mt-1">{(t as any).loyalty?.currentTier || 'Current Tier'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center">
            <Star className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-3xl font-bold text-foreground">{lifetimePoints.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">{(t as any).loyalty?.lifetimePoints || 'Lifetime Points'}</p>
          </CardContent>
        </Card>
      </div>

      {tierInfo.next && tierInfo.pointsNeeded && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">
                {((t as any).loyalty?.progressTo || 'Progress to {tier}').replace('{tier}', tierInfo.next)}
              </span>
              <span className="text-sm text-muted-foreground">
                {lifetimePoints.toLocaleString()} / {tierInfo.pointsNeeded.toLocaleString()} {(t as any).loyalty?.pts || 'pts'}
              </span>
            </div>
            <Progress value={progressToNext} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {((t as any).loyalty?.earnMore || 'Earn {points} more points to reach {tier} tier')
                .replace('{points}', Math.max(0, tierInfo.pointsNeeded - lifetimePoints).toLocaleString())
                .replace('{tier}', tierInfo.next)}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            {(t as any).loyalty?.pointsHistory || 'Points History'}
          </CardTitle>
          <CardDescription>{(t as any).loyalty?.recentActivity || 'Your recent points activity'}</CardDescription>
        </CardHeader>
        <CardContent>
          {!history || history.length === 0 ? (
            <div className="text-center py-8">
              <Gift className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">{(t as any).loyalty?.noActivityYet || 'No points activity yet'}</p>
              <p className="text-sm text-muted-foreground">{(t as any).loyalty?.startEarning || 'Complete rides to start earning loyalty points!'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <div key={entry.id}>
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      {entry.points_type === 'earned' ? (
                        <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                          <TrendingDown className="h-4 w-4 text-orange-500" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {entry.description || (entry.points_type === 'earned' 
                            ? ((t as any).loyalty?.pointsEarned || 'Points Earned') 
                            : ((t as any).loyalty?.pointsRedeemed || 'Points Redeemed'))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(entry.created_at), 'MMM d, yyyy · h:mm a')}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${entry.points_type === 'earned' ? 'text-green-500' : 'text-orange-500'}`}>
                      {entry.points_type === 'earned' ? '+' : '-'}{Math.abs(entry.points).toLocaleString()}
                    </span>
                  </div>
                  <Separator />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
