
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star } from 'lucide-react';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/types';

interface RatingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (appointmentId: string, rating: number, comment?: string) => Promise<void>;
  appointmentToRate: Appointment | null;
  isSubmitting: boolean;
}

export default function RatingDialog({ isOpen, onClose, onSubmit, appointmentToRate, isSubmitting }: RatingDialogProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (isOpen && appointmentToRate) {
      setRating(appointmentToRate.customerRating || 0);
      setComment(appointmentToRate.ratingComment || '');
    } else if (!isOpen) {
      // Reset when dialog closes
      setRating(0);
      setHoverRating(0);
      setComment('');
    }
  }, [isOpen, appointmentToRate]);

  const handleSubmit = async () => {
    if (!appointmentToRate || rating === 0) {
      // Optionally show a toast or inline message if rating is 0
      return;
    }
    await onSubmit(appointmentToRate.id, rating, comment);
  };

  if (!isOpen || !appointmentToRate) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader className="p-6 pb-4 text-center">
          <DialogTitle className="text-xl font-bold">Rate Your Service</DialogTitle>
          <DialogDescription className="text-sm text-gray-500 pt-1">
            How was your experience with <span className="font-semibold">{appointmentToRate.barberName}</span> for the <span className="font-semibold">{appointmentToRate.serviceName}</span> service?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-2">
          <div>
            <Label htmlFor="rating-stars" className="text-base mb-2 block text-center">Your Rating</Label>
            <div id="rating-stars" className="flex justify-center space-x-1 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    "h-8 w-8 cursor-pointer transition-colors duration-150",
                    (hoverRating || rating) >= star ? "text-yellow-400 fill-yellow-400" : "text-gray-300 dark:text-gray-600"
                  )}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  aria-label={`Rate ${star} out of 5 stars`}
                />
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="rating-comment" className="text-base mb-1 block">Add a Comment (Optional)</Label>
            <Textarea
              id="rating-comment"
              placeholder="Tell us more about your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px] text-base rounded-md"
              disabled={isSubmitting}
            />
          </div>
        </div>
        <DialogFooter className="p-6 pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="rounded-full h-11 px-6 text-base" disabled={isSubmitting} onClick={onClose}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit} className="rounded-full h-11 px-6 text-base" disabled={isSubmitting || rating === 0}>
            {isSubmitting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
            {isSubmitting ? 'Submitting...' : 'Submit Rating'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
