import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Shield, Clock, CheckCircle, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface OnboardingWelcomeProps {
  driverName: string;
  onStart: () => void;
}

export function OnboardingWelcome({ driverName, onStart }: OnboardingWelcomeProps) {
  const { t } = useLanguage();
  const firstName = driverName.split(' ')[0];

  const features = [
    { icon: <FileText className="h-5 w-5" />, title: t.onboarding.documentsRequired, description: t.onboarding.documentsRequiredDesc },
    { icon: <Clock className="h-5 w-5" />, title: t.onboarding.quickProcess, description: t.onboarding.quickProcessDesc },
    { icon: <Shield className="h-5 w-5" />, title: t.onboarding.secureUpload, description: t.onboarding.secureUploadDesc },
    { icon: <CheckCircle className="h-5 w-5" />, title: t.onboarding.fastVerification, description: t.onboarding.fastVerificationDesc },
  ];

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-8 pb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{t.onboarding.welcome}, {firstName}! 👋</h2>
          <p className="text-muted-foreground max-w-md mx-auto">{t.onboarding.letsGetVerified}</p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 mb-8">
          {features.map((feature, index) => (
            <motion.div key={feature.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">{feature.icon}</div>
              <div>
                <p className="font-medium text-sm">{feature.title}</p>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-center">
          <Button onClick={onStart} size="lg" className="gap-2">
            {t.onboarding.startOnboarding}
            <ChevronRight className="h-5 w-5" />
          </Button>
          <p className="text-xs text-muted-foreground mt-3">{t.onboarding.saveProgress}</p>
        </motion.div>
      </CardContent>
    </Card>
  );
}
