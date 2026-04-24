import { useState } from 'react';
import { Share2, Copy, Mail, Check, X, Users, Percent, Link2, Trash2, Send, Pencil } from 'lucide-react';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useRideSharing, RideShare } from '@/hooks/useRideSharing';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface ShareRideDialogProps {
  bookingId: string;
  bookingReference: string;
  totalPrice?: number;
}

export function ShareRideDialog({ bookingId, bookingReference, totalPrice = 0 }: ShareRideDialogProps) {
  const { user } = useAuth();
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const sr = (t as any).shareRide || {};
  const { bookingShares, createShare, deleteShare, resendInvitation, updateCostSplit, getShareLink, isLoading } = useRideSharing(bookingId);
  const [email, setEmail] = useState('');
  const [splitPercentage, setSplitPercentage] = useState(50);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editingShareId, setEditingShareId] = useState<string | null>(null);
  const [editSplitPercentage, setEditSplitPercentage] = useState(50);

  if (!user) return null;

  const handleCreateShare = async () => {
    if (!email || !email.includes('@')) return;
    
    await createShare.mutateAsync({
      bookingId,
      email,
      splitPercentage,
    });
    
    setEmail('');
    setSplitPercentage(50);
  };

  const handleCopyLink = async (share: RideShare) => {
    const link = getShareLink(share.share_token);
    await navigator.clipboard.writeText(link);
    setCopiedToken(share.share_token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleStartEdit = (share: RideShare) => {
    setEditingShareId(share.id);
    setEditSplitPercentage(share.cost_split_percentage);
  };

  const handleSaveEdit = async (shareId: string) => {
    await updateCostSplit.mutateAsync({
      shareId,
      newPercentage: editSplitPercentage,
    });
    setEditingShareId(null);
  };

  const handleCancelEdit = () => {
    setEditingShareId(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          {sr.shareRide || 'Share Ride'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-accent" />
            {sr.shareRideSplitCost || 'Share Ride & Split Cost'}
          </DialogTitle>
          <DialogDescription>
            {(sr.inviteFriends || 'Invite friends to share booking {ref} and split the cost.').replace('{ref}', bookingReference)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Existing Shares */}
          {bookingShares.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">{sr.sharedWith || 'Shared With'}</Label>
              {bookingShares.map((share) => (
                <div
                  key={share.id}
                  className={cn(
                    "rounded-lg border p-3",
                    share.is_accepted ? "border-primary/30 bg-primary/5" : "border-border"
                  )}
                >
                  {/* Edit Mode */}
                  {editingShareId === share.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium shrink-0",
                          "bg-muted text-muted-foreground"
                        )}>
                          {share.shared_with_email.charAt(0).toUpperCase()}
                        </div>
                        <p className="text-sm font-medium truncate">{share.shared_with_email}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">{sr.theirShare || 'Their Share'}</Label>
                          <span className="text-sm font-medium text-accent">{editSplitPercentage}%</span>
                        </div>
                        <Slider
                          value={[editSplitPercentage]}
                          onValueChange={(values) => setEditSplitPercentage(values[0])}
                          min={10}
                          max={90}
                          step={5}
                          className="w-full"
                        />
                        {totalPrice > 0 && (
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>You: {formatPrice((totalPrice * (100 - editSplitPercentage)) / 100)}</span>
                            <span>They: {formatPrice((totalPrice * editSplitPercentage) / 100)}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={handleCancelEdit}
                        >
                          {t.common.cancel}
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => handleSaveEdit(share.id)}
                          disabled={updateCostSplit.isPending}
                        >
                          {updateCostSplit.isPending ? (sr.saving || 'Saving...') : t.common.save}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                          share.is_accepted 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted text-muted-foreground"
                        )}>
                          {share.shared_with_email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{share.shared_with_email}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Percent className="h-3 w-3" />
                            <span>
                              {share.cost_split_percentage}% {sr.share || 'share'}
                              {totalPrice > 0 && (
                                <span className="text-accent font-medium ml-1">
                                  ({formatPrice((totalPrice * share.cost_split_percentage) / 100)})
                                </span>
                              )}
                            </span>
                            {share.is_accepted ? (
                              <span className="flex items-center gap-1 text-accent">
                                <Check className="h-3 w-3" /> {sr.accepted || 'Accepted'}
                              </span>
                            ) : (
                              <span className="text-yellow-600">{sr.pending || 'Pending'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!share.is_accepted && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => handleStartEdit(share)}
                              title={sr.editCostSplit || 'Edit cost split'}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => resendInvitation.mutate(share.id)}
                              disabled={resendInvitation.isPending}
                              title={sr.resendInvitation || 'Resend invitation email'}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleCopyLink(share)}
                          title={sr.copyShareLink || 'Copy share link'}
                        >
                          {copiedToken === share.share_token ? (
                            <Check className="h-4 w-4 text-accent" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteShare.mutate(share.id)}
                          disabled={deleteShare.isPending}
                          title={sr.removeShare || 'Remove share'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* New Share Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="share-email">{sr.friendsEmail || "Friend's Email"}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute inset-inline-start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="share-email"
                    type="email"
                    placeholder="friend@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="ps-10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{sr.theirShare || 'Their Share'}</Label>
                <span className="text-sm font-medium text-accent">{splitPercentage}%</span>
              </div>
              <Slider
                value={[splitPercentage]}
                onValueChange={(values) => setSplitPercentage(values[0])}
                min={10}
                max={90}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{(sr.youPay || 'You pay: {percent}%').replace('{percent}', String(100 - splitPercentage))}</span>
                <span>{(sr.theyPay || 'They pay: {percent}%').replace('{percent}', String(splitPercentage))}</span>
              </div>
              {totalPrice > 0 && (
                <div className="flex justify-between text-sm font-medium bg-accent/10 rounded-lg px-3 py-2 mt-2">
                  <span className="text-foreground">
                    You: {formatPrice((totalPrice * (100 - splitPercentage)) / 100)}
                  </span>
                  <span className="text-accent">
                    They: {formatPrice((totalPrice * splitPercentage) / 100)}
                  </span>
                </div>
              )}
            </div>

            <Button
              onClick={handleCreateShare}
              disabled={!email || !email.includes('@') || createShare.isPending}
              className="w-full gap-2"
            >
              <Link2 className="h-4 w-4" />
              {createShare.isPending ? (sr.creating || 'Creating...') : (sr.createShareLink || 'Create Share Link')}
            </Button>
          </div>

          {/* Instructions */}
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">{sr.howItWorks || 'How it works:'}</p>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>{sr.step1 || "Enter your friend's email and choose the cost split"}</li>
              <li>{sr.step2 || 'Copy the share link and send it to them'}</li>
              <li>{sr.step3 || "They'll create an account (if needed) and accept the share"}</li>
              <li>{sr.step4 || 'Both parties will see the booking in their accounts'}</li>
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
