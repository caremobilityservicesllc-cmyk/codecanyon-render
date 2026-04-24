import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export interface RideShare {
  id: string;
  booking_id: string;
  shared_by_user_id: string;
  shared_with_email: string;
  shared_with_user_id: string | null;
  share_token: string;
  cost_split_percentage: number;
  is_accepted: boolean;
  accepted_at: string | null;
  created_at: string;
  proposed_cost_split_percentage?: number | null;
  proposed_at?: string | null;
  proposed_by_user_id?: string | null;
  counter_proposal_accepted_at?: string | null;
}

export function useRideSharing(bookingId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const rs = (t as any).rideSharingToasts || {};
  const queryClient = useQueryClient();

  // Fetch shares for a specific booking
  const { data: bookingShares = [], isLoading } = useQuery({
    queryKey: ['ride-shares', bookingId],
    queryFn: async () => {
      if (!bookingId || !user) return [];
      
      const { data, error } = await supabase
        .from('ride_shares')
        .select('*')
        .eq('booking_id', bookingId);
      
      if (error) throw error;
      return data as RideShare[];
    },
    enabled: !!bookingId && !!user,
  });

  // Fetch shares received by current user
  const { data: receivedShares = [], isLoading: isLoadingReceived } = useQuery({
    queryKey: ['received-ride-shares', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('ride_shares')
        .select('*')
        .or(`shared_with_email.eq.${user.email},shared_with_user_id.eq.${user.id}`);
      
      if (error) throw error;
      return data as RideShare[];
    },
    enabled: !!user,
  });

  // Fetch shares created by current user (to see counter-proposals)
  const { data: createdShares = [], isLoading: isLoadingCreated } = useQuery({
    queryKey: ['shares-created-by-user', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('ride_shares')
        .select('*')
        .eq('shared_by_user_id', user.id);
      
      if (error) throw error;
      return data as RideShare[];
    },
    enabled: !!user,
  });

  // Generate shareable link
  const getShareLink = (shareToken: string) => {
    return `${window.location.origin}/share/${shareToken}`;
  };

  // Create a ride share invitation
  const createShare = useMutation({
    mutationFn: async ({ 
      bookingId, 
      email, 
      splitPercentage = 50 
    }: { 
      bookingId: string; 
      email: string; 
      splitPercentage?: number;
    }) => {
      if (!user) throw new Error('Must be logged in');
      
      const { data, error } = await supabase
        .from('ride_shares')
        .insert({
          booking_id: bookingId,
          shared_by_user_id: user.id,
          shared_with_email: email,
          cost_split_percentage: splitPercentage,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as RideShare;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['ride-shares'] });
      toast({
        title: rs.inviteSent || 'Invite sent!',
        description: (rs.shareLinkCreated || 'Share link created for {email}').replace('{email}', data.shared_with_email),
      });

      try {
        const { data: sharerProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', data.shared_by_user_id)
          .single();

        const { data: booking } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', data.booking_id)
          .single();

        if (booking) {
          const shareLink = getShareLink(data.share_token);
          const sharerName = sharerProfile?.full_name || sharerProfile?.email || 'A user';
          
          await supabase.functions.invoke('send-booking-email', {
            body: {
              type: 'share_invitation',
              email: data.shared_with_email,
              bookingReference: booking.booking_reference,
              pickupLocation: booking.pickup_location,
              dropoffLocation: booking.dropoff_location,
              pickupDate: booking.pickup_date,
              pickupTime: booking.pickup_time,
              vehicleName: booking.vehicle_name,
              passengers: booking.passengers,
              sharerName,
              shareLink,
              costSplitPercentage: data.cost_split_percentage,
              totalPrice: booking.total_price,
            },
          });

          const { data: recipientProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', data.shared_with_email)
            .single();

          if (recipientProfile) {
            await supabase
              .from('notifications')
              .insert({
                user_id: recipientProfile.id,
                booking_id: data.booking_id,
                type: 'share_invitation' as const,
                channel: 'in_app' as const,
                title: rs.rideShareInvitation || 'Ride Share Invitation',
                message: `${sharerName} invited you to share a ride (${booking.booking_reference}). Your share: ${data.cost_split_percentage}%`,
              });
          }
        }
      } catch (emailError) {
        console.error('Failed to send share invitation email:', emailError);
      }
    },
    onError: (error) => {
      toast({
        title: rs.failedToCreateShare || 'Failed to create share',
        description: rs.pleaseRetry || 'Please try again.',
        variant: 'destructive',
      });
      console.error('Create share error:', error);
    },
  });

  // Accept a ride share invitation
  const acceptShare = useMutation({
    mutationFn: async (shareToken: string) => {
      if (!user) throw new Error('Must be logged in');
      
      const { data, error } = await supabase
        .from('ride_shares')
        .update({
          shared_with_user_id: user.id,
          is_accepted: true,
          accepted_at: new Date().toISOString(),
        })
        .eq('share_token', shareToken)
        .select()
        .single();
      
      if (error) throw error;
      return data as RideShare;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['ride-shares'] });
      queryClient.invalidateQueries({ queryKey: ['received-ride-shares'] });
      toast({
        title: rs.rideShareAccepted || 'Ride share accepted!',
        description: rs.youAreNowSharing || 'You are now sharing this ride.',
      });

      try {
        const { data: sharerProfile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', data.shared_by_user_id)
          .single();

        const { data: booking } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', data.booking_id)
          .single();

        if (sharerProfile?.email && booking) {
          await supabase.functions.invoke('send-booking-email', {
            body: {
              type: 'share_accepted',
              email: sharerProfile.email,
              bookingReference: booking.booking_reference,
              pickupLocation: booking.pickup_location,
              dropoffLocation: booking.dropoff_location,
              pickupDate: booking.pickup_date,
              pickupTime: booking.pickup_time,
              vehicleName: booking.vehicle_name,
              passengers: booking.passengers,
              acceptedByEmail: data.shared_with_email,
              costSplitPercentage: data.cost_split_percentage,
              totalPrice: booking.total_price,
            },
          });
        }
      } catch (emailError) {
        console.error('Failed to send share acceptance email:', emailError);
      }
    },
    onError: (error) => {
      toast({
        title: rs.failedToAcceptShare || 'Failed to accept share',
        description: rs.invalidOrExpired || 'The invite link may be invalid or expired.',
        variant: 'destructive',
      });
      console.error('Accept share error:', error);
    },
  });

  // Delete/cancel a ride share
  const deleteShare = useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from('ride_shares')
        .delete()
        .eq('id', shareId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ride-shares'] });
      queryClient.invalidateQueries({ queryKey: ['received-ride-shares'] });
      toast({
        title: rs.shareRemoved || 'Share removed',
        description: rs.shareHasBeenCancelled || 'The ride share has been cancelled.',
      });
    },
    onError: (error) => {
      toast({
        title: rs.failedToRemoveShare || 'Failed to remove share',
        description: rs.pleaseRetry || 'Please try again.',
        variant: 'destructive',
      });
      console.error('Delete share error:', error);
    },
  });

  // Decline a ride share invitation (for recipients)
  const declineShare = useMutation({
    mutationFn: async (shareId: string) => {
      if (!user) throw new Error('Must be logged in');
      
      const { data: share, error: fetchError } = await supabase
        .from('ride_shares')
        .select('*')
        .eq('id', shareId)
        .or(`shared_with_email.eq.${user.email},shared_with_user_id.eq.${user.id}`)
        .single();
      
      if (fetchError || !share) throw new Error('Share not found');
      
      const { error } = await supabase
        .from('ride_shares')
        .delete()
        .eq('id', shareId)
        .or(`shared_with_email.eq.${user.email},shared_with_user_id.eq.${user.id}`);
      
      if (error) throw error;
      
      return share as RideShare;
    },
    onSuccess: async (share) => {
      queryClient.invalidateQueries({ queryKey: ['ride-shares'] });
      queryClient.invalidateQueries({ queryKey: ['received-ride-shares'] });
      toast({
        title: rs.invitationDeclined || 'Invitation declined',
        description: rs.youHaveDeclined || 'You have declined the ride share invitation.',
      });

      try {
        const { data: sharerProfile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', share.shared_by_user_id)
          .single();

        const { data: booking } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', share.booking_id)
          .single();

        if (booking) {
          await supabase
            .from('notifications')
            .insert({
              user_id: share.shared_by_user_id,
              booking_id: share.booking_id,
              type: 'share_declined' as const,
              channel: 'in_app' as const,
              title: rs.rideShareDeclined || 'Ride Share Declined',
              message: `${share.shared_with_email} declined your invitation to share ride ${booking.booking_reference}.`,
            });

          if (sharerProfile?.email) {
            await supabase.functions.invoke('send-booking-email', {
              body: {
                type: 'share_declined',
                email: sharerProfile.email,
                bookingReference: booking.booking_reference,
                pickupLocation: booking.pickup_location,
                dropoffLocation: booking.dropoff_location,
                pickupDate: booking.pickup_date,
                pickupTime: booking.pickup_time,
                vehicleName: booking.vehicle_name,
                passengers: booking.passengers,
                declinedByEmail: share.shared_with_email,
              },
            });
          }
        }
      } catch (notifyError) {
        console.error('Failed to send decline notifications:', notifyError);
      }
    },
    onError: (error) => {
      toast({
        title: rs.failedToDecline || 'Failed to decline',
        description: rs.pleaseRetry || 'Please try again.',
        variant: 'destructive',
      });
      console.error('Decline share error:', error);
    },
  });

  // Resend share invitation email
  const resendInvitation = useMutation({
    mutationFn: async (shareId: string) => {
      if (!user) throw new Error('Must be logged in');
      
      const { data: share, error: shareError } = await supabase
        .from('ride_shares')
        .select('*')
        .eq('id', shareId)
        .eq('shared_by_user_id', user.id)
        .single();
      
      if (shareError || !share) throw new Error('Share not found');
      if (share.is_accepted) throw new Error('Invitation already accepted');
      
      const { data: sharerProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', share.shared_by_user_id)
        .single();

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', share.booking_id)
        .single();

      if (bookingError || !booking) throw new Error('Booking not found');

      const shareLink = getShareLink(share.share_token);
      
      await supabase.functions.invoke('send-booking-email', {
        body: {
          type: 'share_invitation',
          email: share.shared_with_email,
          bookingReference: booking.booking_reference,
          pickupLocation: booking.pickup_location,
          dropoffLocation: booking.dropoff_location,
          pickupDate: booking.pickup_date,
          pickupTime: booking.pickup_time,
          vehicleName: booking.vehicle_name,
          passengers: booking.passengers,
          sharerName: sharerProfile?.full_name || sharerProfile?.email || 'A user',
          shareLink,
          costSplitPercentage: share.cost_split_percentage,
          totalPrice: booking.total_price,
        },
      });

      return share;
    },
    onSuccess: (share) => {
      toast({
        title: rs.invitationResent || 'Invitation resent!',
        description: (rs.newInvitationSent || 'A new invitation email has been sent to {email}').replace('{email}', share.shared_with_email),
      });
    },
    onError: (error) => {
      toast({
        title: rs.failedToResendInvitation || 'Failed to resend invitation',
        description: error.message || rs.pleaseRetry || 'Please try again.',
        variant: 'destructive',
      });
      console.error('Resend invitation error:', error);
    },
  });

  // Update cost split percentage for pending shares
  const updateCostSplit = useMutation({
    mutationFn: async ({ 
      shareId, 
      newPercentage 
    }: { 
      shareId: string; 
      newPercentage: number;
    }) => {
      if (!user) throw new Error('Must be logged in');
      
      const { data, error } = await supabase
        .from('ride_shares')
        .update({ cost_split_percentage: newPercentage })
        .eq('id', shareId)
        .eq('shared_by_user_id', user.id)
        .eq('is_accepted', false)
        .select()
        .single();
      
      if (error) throw error;
      return data as RideShare;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['ride-shares'] });
      toast({
        title: rs.costSplitUpdated || 'Cost split updated',
        description: (rs.shareUpdatedTo || 'Share updated to {percent}% for {email}')
          .replace('{percent}', String(data.cost_split_percentage))
          .replace('{email}', data.shared_with_email),
      });

      try {
        const { data: sharerProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', data.shared_by_user_id)
          .single();

        const { data: booking } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', data.booking_id)
          .single();

        if (booking) {
          const shareLink = getShareLink(data.share_token);
          const sharerName = sharerProfile?.full_name || sharerProfile?.email || 'A user';
          
          await supabase.functions.invoke('send-booking-email', {
            body: {
              type: 'share_invitation_updated',
              email: data.shared_with_email,
              bookingReference: booking.booking_reference,
              pickupLocation: booking.pickup_location,
              dropoffLocation: booking.dropoff_location,
              pickupDate: booking.pickup_date,
              pickupTime: booking.pickup_time,
              vehicleName: booking.vehicle_name,
              passengers: booking.passengers,
              sharerName,
              shareLink,
              costSplitPercentage: data.cost_split_percentage,
              totalPrice: booking.total_price,
            },
          });
        }
      } catch (emailError) {
        console.error('Failed to send updated invitation email:', emailError);
      }
    },
    onError: (error) => {
      toast({
        title: rs.failedToUpdateCostSplit || 'Failed to update cost split',
        description: rs.pleaseRetry || 'Please try again.',
        variant: 'destructive',
      });
      console.error('Update cost split error:', error);
    },
  });

  const counterPropose = useMutation({
    mutationFn: async ({ 
      shareToken, 
      proposedPercentage 
    }: { 
      shareToken: string; 
      proposedPercentage: number;
    }) => {
      if (!user) throw new Error('Must be logged in');
      
      const { data: share, error: shareError } = await supabase
        .from('ride_shares')
        .select('*')
        .eq('share_token', shareToken)
        .single();
      
      if (shareError || !share) throw new Error('Share not found');
      if (share.is_accepted) throw new Error('Share already accepted');
      
      const { error: updateError } = await supabase
        .from('ride_shares')
        .update({
          proposed_cost_split_percentage: proposedPercentage,
          proposed_at: new Date().toISOString(),
          proposed_by_user_id: user.id,
        })
        .eq('share_token', shareToken);
      
      if (updateError) throw updateError;
      
      return { share: share as RideShare, proposedPercentage };
    },
    onSuccess: async ({ share, proposedPercentage }) => {
      queryClient.invalidateQueries({ queryKey: ['ride-shares'] });
      queryClient.invalidateQueries({ queryKey: ['shares-created-by-user'] });
      toast({
        title: rs.counterProposalSent || 'Counter-proposal sent!',
        description: (rs.youveProposed || "You've proposed a {percent}% cost split to the sharer.").replace('{percent}', String(proposedPercentage)),
      });

      try {
        const { data: sharerProfile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', share.shared_by_user_id)
          .single();

        const { data: booking } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', share.booking_id)
          .single();

        if (booking) {
          await supabase
            .from('notifications')
            .insert({
              user_id: share.shared_by_user_id,
              booking_id: share.booking_id,
              type: 'share_counter_proposal' as const,
              channel: 'in_app' as const,
              title: rs.counterProposalReceived || 'Counter-Proposal Received',
              message: `${share.shared_with_email} proposed a ${proposedPercentage}% cost split for ride ${booking.booking_reference}.`,
            });

          if (sharerProfile?.email) {
            const shareLink = getShareLink(share.share_token);
            await supabase.functions.invoke('send-booking-email', {
              body: {
                type: 'share_counter_proposal',
                email: sharerProfile.email,
                bookingReference: booking.booking_reference,
                pickupLocation: booking.pickup_location,
                dropoffLocation: booking.dropoff_location,
                pickupDate: booking.pickup_date,
                pickupTime: booking.pickup_time,
                vehicleName: booking.vehicle_name,
                passengers: booking.passengers,
                proposedByEmail: share.shared_with_email,
                proposedPercentage,
                originalPercentage: share.cost_split_percentage,
                totalPrice: booking.total_price,
                shareLink,
              },
            });
          }
        }
      } catch (notifyError) {
        console.error('Failed to send counter-proposal notifications:', notifyError);
      }
    },
    onError: (error) => {
      toast({
        title: rs.failedToSendProposal || 'Failed to send proposal',
        description: error.message || rs.pleaseRetry || 'Please try again.',
        variant: 'destructive',
      });
      console.error('Counter-propose error:', error);
    },
  });

  // Accept a counter-proposal (for sharers)
  const acceptCounterProposal = useMutation({
    mutationFn: async (shareId: string) => {
      if (!user) throw new Error('Must be logged in');
      
      const { data: share, error: shareError } = await supabase
        .from('ride_shares')
        .select('*')
        .eq('id', shareId)
        .eq('shared_by_user_id', user.id)
        .single();
      
      if (shareError || !share) throw new Error('Share not found');
      if (!share.proposed_cost_split_percentage) throw new Error('No proposal to accept');
      if (share.is_accepted) throw new Error('Share already accepted');
      
      const { data: updatedShare, error: updateError } = await supabase
        .from('ride_shares')
        .update({
          cost_split_percentage: share.proposed_cost_split_percentage,
          proposed_cost_split_percentage: null,
          proposed_at: null,
          proposed_by_user_id: null,
          counter_proposal_accepted_at: new Date().toISOString(),
        })
        .eq('id', shareId)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      return { share: updatedShare as RideShare, originalPercentage: share.cost_split_percentage, newPercentage: share.proposed_cost_split_percentage };
    },
    onSuccess: async ({ share, originalPercentage, newPercentage }) => {
      queryClient.invalidateQueries({ queryKey: ['ride-shares'] });
      queryClient.invalidateQueries({ queryKey: ['shares-created-by-user'] });
      queryClient.invalidateQueries({ queryKey: ['received-ride-shares'] });
      toast({
        title: rs.proposalAccepted || 'Proposal accepted!',
        description: (rs.costSplitUpdatedTo || 'Cost split updated to {percent}%.').replace('{percent}', String(newPercentage)),
      });

      try {
        const { data: booking } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', share.booking_id)
          .single();

        if (booking) {
          const { data: recipientProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', share.shared_with_email)
            .single();

          if (recipientProfile) {
            await supabase
              .from('notifications')
              .insert({
                user_id: recipientProfile.id,
                booking_id: share.booking_id,
                type: 'share_accepted' as const,
                channel: 'in_app' as const,
                title: rs.proposalAcceptedTitle || 'Proposal Accepted!',
                message: `Your proposed ${newPercentage}% cost split for ride ${booking.booking_reference} was accepted.`,
              });
          }

          await supabase.functions.invoke('send-booking-email', {
            body: {
              type: 'share_proposal_accepted',
              email: share.shared_with_email,
              bookingReference: booking.booking_reference,
              pickupLocation: booking.pickup_location,
              dropoffLocation: booking.dropoff_location,
              pickupDate: booking.pickup_date,
              pickupTime: booking.pickup_time,
              vehicleName: booking.vehicle_name,
              passengers: booking.passengers,
              acceptedPercentage: newPercentage,
              totalPrice: booking.total_price,
            },
          });
        }
      } catch (notifyError) {
        console.error('Failed to send acceptance notifications:', notifyError);
      }
    },
    onError: (error) => {
      toast({
        title: rs.failedToAcceptProposal || 'Failed to accept proposal',
        description: error.message || rs.pleaseRetry || 'Please try again.',
        variant: 'destructive',
      });
      console.error('Accept counter-proposal error:', error);
    },
  });

  // Get share by token (for accepting invites)
  const getShareByToken = async (token: string) => {
    const { data, error } = await supabase
      .from('ride_shares')
      .select('*')
      .eq('share_token', token)
      .single();
    
    if (error) return null;
    return data as RideShare;
  };

  return {
    bookingShares,
    receivedShares,
    createdShares,
    isLoading,
    isLoadingReceived,
    isLoadingCreated,
    createShare,
    acceptShare,
    declineShare,
    deleteShare,
    resendInvitation,
    updateCostSplit,
    counterPropose,
    acceptCounterProposal,
    getShareByToken,
    getShareLink,
  };
}
