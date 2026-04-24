import { useState } from 'react';
import { Star, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface DriverRatingProps {
  bookingId: string;
  driverId: string;
  driverName: string;
  onRatingSubmitted: () => void;
}

export function DriverRating({ bookingId, driverId, driverName, onRatingSubmitted }: DriverRatingProps) {
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ratingLabels = ['', t.driverRating.poor, t.driverRating.fair, t.driverRating.good, t.driverRating.veryGood, t.driverRating.excellent];

  const handleSubmit = async () => {
    if (rating === 0) { toast.error(t.driverRating.pleaseSelectRating); return; }
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error(t.driverRating.signInToRate); setIsSubmitting(false); return; }
      const { error } = await supabase.from('driver_ratings').insert({ booking_id: bookingId, driver_id: driverId, user_id: user.id, rating, comment: comment.trim() || null });
      if (error) {
        if (error.code === '23505') toast.error(t.driverRating.alreadyRated);
        else throw error;
      } else {
        toast.success(t.driverRating.thankYou);
        onRatingSubmitted();
      }
    } catch (err) {
      console.error('Error submitting rating:', err);
      toast.error(t.driverRating.failedToSubmit);
    }
    setIsSubmitting(false);
  };

  const displayRating = hoveredRating || rating;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">{t.driverRating.rateYourRide}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t.driverRating.howWasExperience} {driverName}?</p>
      </div>
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" className="group transition-transform hover:scale-110 focus:outline-none" onMouseEnter={() => setHoveredRating(star)} onMouseLeave={() => setHoveredRating(0)} onClick={() => setRating(star)}>
            <Star className={cn("h-10 w-10 transition-colors", star <= displayRating ? "fill-yellow-400 text-yellow-400" : "fill-transparent text-muted-foreground/50 group-hover:text-yellow-400/50")} />
          </button>
        ))}
      </div>
      <div className="text-center">
        <span className="text-sm font-medium text-muted-foreground">
          {displayRating === 0 ? t.driverRating.selectRating : ratingLabels[displayRating]}
        </span>
      </div>
      <div>
        <Textarea placeholder={t.driverRating.sharePlaceholder} value={comment} onChange={(e) => setComment(e.target.value)} className="min-h-[80px] resize-none" maxLength={500} />
        <p className="mt-1 text-right text-xs text-muted-foreground">{comment.length}/500</p>
      </div>
      <Button onClick={handleSubmit} disabled={rating === 0 || isSubmitting} className="w-full">
        {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.driverRating.submitting}</>) : (<><Send className="mr-2 h-4 w-4" />{t.driverRating.submitRating}</>)}
      </Button>
    </div>
  );
}
