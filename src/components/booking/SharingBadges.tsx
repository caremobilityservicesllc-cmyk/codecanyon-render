import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Award, Users, PiggyBank, Star, Trophy, Sparkles, Target, Zap, Crown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  requirement: { type: 'rides' | 'savings' | 'special'; value: number };
  color: string;
  bgColor: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

function useSharingBadges(): BadgeDefinition[] {
  const { t } = useLanguage();
  const sb = (t as any).sharingBadgeItems || {};
  return [
    { id: 'first-share', name: sb.firstShare || 'First Share', description: sb.firstShareDesc || 'Complete your first shared ride', icon: Sparkles, requirement: { type: 'rides', value: 1 }, color: 'text-blue-500', bgColor: 'bg-blue-500/20', rarity: 'common' },
    { id: 'social-rider', name: sb.socialRider || 'Social Rider', description: sb.socialRiderDesc || 'Complete 5 shared rides', icon: Users, requirement: { type: 'rides', value: 5 }, color: 'text-emerald-500', bgColor: 'bg-emerald-500/20', rarity: 'uncommon' },
    { id: 'sharing-enthusiast', name: sb.sharingEnthusiast || 'Sharing Enthusiast', description: sb.sharingEnthusiastDesc || 'Complete 10 shared rides', icon: Star, requirement: { type: 'rides', value: 10 }, color: 'text-amber-500', bgColor: 'bg-amber-500/20', rarity: 'rare' },
    { id: 'share-master', name: sb.shareMaster || 'Share Master', description: sb.shareMasterDesc || 'Complete 25 shared rides', icon: Trophy, requirement: { type: 'rides', value: 25 }, color: 'text-purple-500', bgColor: 'bg-purple-500/20', rarity: 'epic' },
    { id: 'sharing-legend', name: sb.sharingLegend || 'Sharing Legend', description: sb.sharingLegendDesc || 'Complete 50 shared rides', icon: Crown, requirement: { type: 'rides', value: 50 }, color: 'text-yellow-500', bgColor: 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20', rarity: 'legendary' },
    { id: 'penny-pincher', name: sb.pennyPincher || 'Penny Pincher', description: sb.pennyPincherDesc || 'Save {currency}25 through ride sharing', icon: PiggyBank, requirement: { type: 'savings', value: 25 }, color: 'text-green-500', bgColor: 'bg-green-500/20', rarity: 'common' },
    { id: 'smart-saver', name: sb.smartSaver || 'Smart Saver', description: sb.smartSaverDesc || 'Save {currency}100 through ride sharing', icon: Target, requirement: { type: 'savings', value: 100 }, color: 'text-teal-500', bgColor: 'bg-teal-500/20', rarity: 'uncommon' },
    { id: 'savings-pro', name: sb.savingsPro || 'Savings Pro', description: sb.savingsProDesc || 'Save {currency}250 through ride sharing', icon: Zap, requirement: { type: 'savings', value: 250 }, color: 'text-cyan-500', bgColor: 'bg-cyan-500/20', rarity: 'rare' },
    { id: 'savings-champion', name: sb.savingsChampion || 'Savings Champion', description: sb.savingsChampionDesc || 'Save {currency}500 through ride sharing', icon: Award, requirement: { type: 'savings', value: 500 }, color: 'text-indigo-500', bgColor: 'bg-indigo-500/20', rarity: 'epic' },
  ];
}

const RARITY_STYLES = {
  common: 'border-slate-300 dark:border-slate-600',
  uncommon: 'border-emerald-400 dark:border-emerald-500',
  rare: 'border-blue-400 dark:border-blue-500',
  epic: 'border-purple-400 dark:border-purple-500',
  legendary: 'border-yellow-400 dark:border-yellow-500 shadow-lg shadow-yellow-500/20',
};

interface SharingBadgesProps {
  totalRides: number;
  totalSavings: number;
  compact?: boolean;
}

export function SharingBadges({ totalRides, totalSavings, compact = false }: SharingBadgesProps) {
  const { currency } = useSystemSettings();
  const { t } = useLanguage();
  const SHARING_BADGES = useSharingBadges();
  const resolveCurrency = (text: string) => text.replace(/\{currency\}/g, currency.symbol);
  const { earnedBadges, nextBadges } = useMemo(() => {
    const earned: (BadgeDefinition & { progress: number })[] = [];
    const next: (BadgeDefinition & { progress: number })[] = [];
    SHARING_BADGES.forEach(badge => {
      let currentValue = badge.requirement.type === 'rides' ? totalRides : totalSavings;
      const progress = Math.min((currentValue / badge.requirement.value) * 100, 100);
      if (currentValue >= badge.requirement.value) {
        earned.push({ ...badge, progress: 100 });
      } else {
        next.push({ ...badge, progress });
      }
    });
    next.sort((a, b) => b.progress - a.progress);
    return { earnedBadges: earned, nextBadges: next.slice(0, 3) };
  }, [totalRides, totalSavings]);

  if (compact) {
    return (
      <TooltipProvider>
        <div className="flex flex-wrap gap-2">
          {earnedBadges.map((badge, index) => {
            const Icon = badge.icon;
            return (
              <Tooltip key={badge.id}>
                <TooltipTrigger asChild>
                  <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: index * 0.1, type: 'spring', stiffness: 200 }} className={cn('flex items-center justify-center w-10 h-10 rounded-full border-2', badge.bgColor, RARITY_STYLES[badge.rarity])}>
                    <Icon className={cn('h-5 w-5', badge.color)} />
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-semibold">{badge.name}</p>
                  <p className="text-xs text-muted-foreground">{resolveCurrency(badge.description)}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
          {earnedBadges.length === 0 && (
            <p className="text-sm text-muted-foreground">{t.sharingBadgesSection.noBadgesYet}</p>
          )}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Award className="h-5 w-5 text-accent" />
          {t.sharingBadgesSection.sharingAchievements}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {earnedBadges.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">{t.sharingBadgesSection.earnedBadges}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {earnedBadges.map((badge, index) => {
                const Icon = badge.icon;
                return (
                  <motion.div key={badge.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className={cn('relative flex flex-col items-center gap-2 p-4 rounded-lg border-2', badge.bgColor, RARITY_STYLES[badge.rarity])}>
                    <Badge variant="secondary" className="absolute -top-2 -right-2 text-[10px] capitalize">{badge.rarity}</Badge>
                    <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 0.5, delay: index * 0.2 + 0.3 }}>
                      <Icon className={cn('h-8 w-8', badge.color)} />
                    </motion.div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">{badge.name}</p>
                      <p className="text-xs text-muted-foreground">{resolveCurrency(badge.description)}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {nextBadges.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">{t.sharingBadgesSection.upNext}</h4>
            <div className="space-y-2">
              {nextBadges.map((badge) => {
                const Icon = badge.icon;
                const currentValue = badge.requirement.type === 'rides' ? totalRides : totalSavings;
                const unit = badge.requirement.type === 'rides' ? t.common.rides : currency.symbol;
                return (
                  <div key={badge.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className={cn('flex items-center justify-center w-10 h-10 rounded-full opacity-50', badge.bgColor)}>
                      <Icon className={cn('h-5 w-5', badge.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-foreground">{badge.name}</p>
                        <span className="text-xs text-muted-foreground">
                          {badge.requirement.type === 'savings' ? currency.symbol : ''}{Math.floor(currentValue)}/{badge.requirement.type === 'savings' ? currency.symbol : ''}{badge.requirement.value}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${badge.progress}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} className={cn('h-full rounded-full', badge.bgColor.replace('/20', ''))} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {earnedBadges.length === 0 && nextBadges.length === 0 && (
          <div className="text-center py-6">
            <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t.sharingBadgesSection.startSharing}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
