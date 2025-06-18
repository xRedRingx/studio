/**
 * @fileoverview AppointmentCard component for the Barber Dashboard.
 * This component displays details of a single appointment for today
 * and provides relevant action buttons for the barber (e.g., check-in, mark done, mark no-show).
 * The card's appearance changes based on the appointment status and whether it needs attention.
 */
'use client';

import { Button } from '@/components/ui/button'; // Button UI component.
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // Card UI components.
import type { Appointment, AppointmentStatus } from '@/types'; // Type definitions.
import { cn } from '@/lib/utils'; // Utility for conditional class names.
import { User, Clock, CheckCircle2, UserCheck, AlertCircle, AlertTriangle, Play, LogIn, CheckSquare, Users, UserX } from 'lucide-react'; // Icons.
import LoadingSpinner from '../ui/loading-spinner'; // Loading spinner UI.

/**
 * Props for the AppointmentCard component.
 * @interface AppointmentCardProps
 * @property {Appointment} appointment - The appointment data to display.
 * @property {(appointmentId: string, action: 'BARBER_CHECK_IN' | 'BARBER_CONFIRM_START' | 'BARBER_MARK_DONE' | 'BARBER_CONFIRM_COMPLETION' | 'BARBER_MARK_NO_SHOW') => Promise<void>} onAppointmentAction - Callback function to handle appointment actions.
 * @property {boolean} isInteracting - True if an action on this card is currently being processed.
 * @property {boolean} [isStale] - Optional. True if the appointment is considered stale (e.g., past start time but not acted upon).
 * @property {boolean} [isNextCandidate] - Optional. True if this is the next upcoming appointment.
 * @property {boolean} [isPastGracePeriod] - Optional. True if the appointment is past the no-show grace period.
 */
interface AppointmentCardProps {
  appointment: Appointment;
  onAppointmentAction: (appointmentId: string, action: 'BARBER_CHECK_IN' | 'BARBER_CONFIRM_START' | 'BARBER_MARK_DONE' | 'BARBER_CONFIRM_COMPLETION' | 'BARBER_MARK_NO_SHOW') => Promise<void>;
  isInteracting: boolean;
  isStale?: boolean;
  isNextCandidate?: boolean;
  isPastGracePeriod?: boolean;
}

/**
 * AppointmentCard component.
 * Displays an individual appointment with actions for the barber.
 *
 * @param {AppointmentCardProps} props - The component's props.
 * @returns {JSX.Element} The rendered appointment card.
 */
export default function AppointmentCard({ appointment, onAppointmentAction, isInteracting, isStale, isNextCandidate, isPastGracePeriod }: AppointmentCardProps) {
  const { status, customerId } = appointment;
  const isWalkIn = customerId === null; // True if this is a walk-in appointment.

  // Dynamically set card styling based on appointment state.
  let cardTitleClass = "text-base font-semibold";
  let cardBgClass = "bg-card";
  let cardBorderClass = "border border-border";
  let statusBadge = null; // JSX for a status badge, if any.
  let timeClass = "text-gray-500 dark:text-gray-400";
  let mainIcon = <User className="mr-2 h-4 w-4 opacity-70" />; // Default icon.

  // Determine if the appointment needs special attention (stale or past grace period for no-show).
  const needsAttention = isStale || (isPastGracePeriod && (status === 'upcoming' || status === 'customer-initiated-check-in'));

  // Apply specific styling if the appointment needs attention.
  if (needsAttention) {
    cardTitleClass = "text-yellow-700 dark:text-yellow-500";
    cardBgClass = "bg-yellow-500/10 dark:bg-yellow-700/15";
    cardBorderClass = "border-yellow-500 ring-2 ring-yellow-500/50 shadow-lg shadow-yellow-500/20";
    statusBadge = <span className="text-xs font-semibold uppercase text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded-full bg-yellow-500/20 flex items-center"><AlertTriangle className="h-3.5 w-3.5 mr-1.5"/>Needs Attention</span>;
    timeClass = "text-yellow-700 dark:text-yellow-500";
    mainIcon = <AlertTriangle className="mr-2 h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
  } else if (isNextCandidate && (status === 'upcoming' || status === 'customer-initiated-check-in' || status === 'barber-initiated-check-in')) {
    // Styling for the "Next Up" appointment.
    cardTitleClass = "text-primary-foreground";
    cardBgClass = "bg-primary/90 dark:bg-primary/80";
    cardBorderClass = "border-primary ring-2 ring-primary/80 shadow-lg shadow-primary/30";
    statusBadge = <span className="text-xs font-semibold uppercase text-primary-foreground px-2 py-1 rounded-full bg-primary-foreground/20 flex items-center"><AlertCircle className="h-3.5 w-3.5 mr-1.5"/>Next Up</span>;
    timeClass = "text-primary-foreground/90";
    mainIcon = <Users className="mr-2 h-4 w-4 opacity-80" />;
  } else if (status === 'in-progress') {
    // Styling for "In Progress" appointments.
     cardBgClass = "bg-primary/10 dark:bg-primary/15";
     cardBorderClass = "border-primary/50";
     cardTitleClass = "text-primary";
     timeClass = "text-primary";
     statusBadge = <span className="text-xs font-semibold uppercase text-primary px-2 py-1 rounded-full bg-primary/15 flex items-center"><Play className="h-3 w-3 mr-1.5 fill-current"/>In Progress</span>;
     mainIcon = <Play className="mr-2 h-4 w-4 text-primary" />;
  } else if (status === 'completed') {
    // Styling for "Completed" appointments.
     cardBgClass = "bg-green-500/10 dark:bg-green-700/15 opacity-90";
     cardBorderClass = "border-green-500/50";
     cardTitleClass = "text-green-700 dark:text-green-400";
     timeClass = "text-green-600 dark:text-green-500";
     mainIcon = <CheckCircle2 className="mr-2 h-4 w-4 text-green-600 dark:text-green-500" />;
  } else if (status === 'no-show') {
    // Styling for "No-Show" appointments.
    cardTitleClass = "text-destructive";
    cardBgClass = "bg-destructive/10 dark:bg-destructive/15 opacity-80";
    cardBorderClass = "border-destructive/50";
    statusBadge = <span className="text-xs font-semibold uppercase text-destructive px-2 py-1 rounded-full bg-destructive/15 flex items-center"><UserX className="h-3 w-3 mr-1.5"/>No-Show</span>;
    timeClass = "text-destructive/80";
    mainIcon = <UserX className="mr-2 h-4 w-4 text-destructive" />;
  }

  /**
   * Renders the appropriate action buttons based on the appointment's status.
   * @returns {JSX.Element | null} The action buttons or null if no actions are applicable.
   */
  const renderActionButtons = () => {
    // No actions for completed, cancelled, or no-show appointments.
    if (status === 'completed' || status === 'cancelled' || status === 'no-show') return null;

    // Button to record customer arrival (barber check-in).
    const recordArrivalButton = (
        <Button
            variant={needsAttention && !isWalkIn ? "default" : "outline"} // Special variant if attention needed.
            onClick={() => onAppointmentAction(appointment.id, 'BARBER_CHECK_IN')}
            size="sm"
            className={cn(
                "rounded-full h-9 px-4",
                needsAttention && !isWalkIn && "bg-yellow-500 hover:bg-yellow-600 text-white dark:text-yellow-900 dark:bg-yellow-600 dark:hover:bg-yellow-700 dark:hover:text-white border-yellow-600"
            )}
            disabled={isInteracting} // Disable if another action is in progress.
        >
            {isInteracting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <LogIn className="mr-2 h-4 w-4" />} Record Arrival
        </Button>
    );

    // Button to mark the appointment as a no-show.
    const markNoShowButton = (
        <Button
            variant="destructive"
            onClick={() => onAppointmentAction(appointment.id, 'BARBER_MARK_NO_SHOW')}
            size="sm"
            className="rounded-full h-9 px-4"
            disabled={isInteracting}
        >
            {isInteracting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <UserX className="mr-2 h-4 w-4" />} Mark No-Show
        </Button>
    );

    // --- Actions for Walk-In Appointments ---
    if (isWalkIn) {
      if (status === 'in-progress') {
        return ( // Only action for in-progress walk-in is "Mark Done".
          <Button onClick={() => onAppointmentAction(appointment.id, 'BARBER_MARK_DONE')} size="sm" className="rounded-full h-9 px-4" disabled={isInteracting}>
            {isInteracting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Mark Done
          </Button>
        );
      }
      return null; // No other actions for walk-ins on this card.
    }

    // --- Actions for Scheduled Appointments ---
    switch (status) {
      case 'upcoming': // Upcoming appointment.
        return (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {isPastGracePeriod && markNoShowButton} {/* Show No-Show button if past grace period. */}
                {recordArrivalButton}
            </div>
        );
      case 'customer-initiated-check-in': // Customer has checked in.
        return (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {isPastGracePeriod && markNoShowButton} {/* Show No-Show button if past grace period. */}
                <Button onClick={() => onAppointmentAction(appointment.id, 'BARBER_CONFIRM_START')} size="sm" className={cn("rounded-full h-9 px-4", needsAttention && "bg-yellow-500 hover:bg-yellow-600 text-white dark:text-yellow-900 dark:bg-yellow-600 dark:hover:bg-yellow-700 dark:hover:text-white border-yellow-600" )} disabled={isInteracting}>
                    {isInteracting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />} Confirm & Start
                </Button>
            </div>
        );
      case 'barber-initiated-check-in': // Barber recorded arrival, waiting for customer.
        return <p className={cn("text-sm", timeClass, needsAttention ? "font-semibold" : "text-muted-foreground")}>Waiting for customer to confirm check-in.</p>;
      case 'in-progress': // Service is in progress.
        return (
          <Button onClick={() => onAppointmentAction(appointment.id, 'BARBER_MARK_DONE')} size="sm" className="rounded-full h-9 px-4" disabled={isInteracting}>
            {isInteracting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <CheckSquare className="mr-2 h-4 w-4" />} Mark Service Done
          </Button>
        );
      case 'customer-initiated-completion': // Customer marked service as done.
        return (
          <Button onClick={() => onAppointmentAction(appointment.id, 'BARBER_CONFIRM_COMPLETION')} size="sm" className="rounded-full h-9 px-4" disabled={isInteracting}>
            {isInteracting ? <LoadingSpinner className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Confirm Completion
          </Button>
        );
      case 'barber-initiated-completion': // Barber marked done, waiting for customer.
        return <p className={cn("text-sm text-muted-foreground", timeClass)}>Waiting for customer to confirm completion.</p>;
      default:
        return null;
    }
  };

  /**
   * Gets a user-friendly label for the appointment status.
   * @returns {string} The display label for the status.
   */
  const getStatusLabel = () => {
    switch (status) {
        case 'upcoming':
            if (isPastGracePeriod) return 'Past Grace Period';
            return isNextCandidate && !needsAttention ? 'Next Up' : (needsAttention ? 'Needs Attention (Past Start)' : 'Upcoming');
        case 'customer-initiated-check-in':
            if (isPastGracePeriod) return 'Customer Waiting (Past Grace)';
            return needsAttention ? 'Customer Waiting (Stale)' : 'Customer Checked In';
        case 'barber-initiated-check-in': return needsAttention ? `Barber Recorded Arrival (Stale)` : `Barber Recorded Arrival ${isWalkIn ? '(Walk-In)' : ''}`;
        case 'in-progress': return 'Service In Progress';
        case 'customer-initiated-completion': return 'Customer Marked Done';
        case 'barber-initiated-completion': return `Barber Marked Done ${isWalkIn ? '(Walk-In)' : ''}`;
        case 'completed': return 'Completed';
        case 'cancelled': return 'Cancelled';
        case 'no-show': return 'No-Show';
        default: return status; // Default to the raw status string if no mapping.
    }
  };

  return (
    <Card className={cn("shadow-md hover:shadow-lg rounded-xl transition-all duration-200 ease-in-out overflow-hidden", cardBorderClass, cardBgClass)}>
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
            {/* Appointment title with customer name and icon. */}
            <CardTitle className={cn(cardTitleClass, "flex items-center")}>
                {mainIcon}
                {appointment.customerName} {isWalkIn && !statusBadge && <span className="text-xs font-normal ml-1.5 opacity-80">(Walk-In)</span>}
            </CardTitle>
            {/* Status badge, if applicable. */}
            {statusBadge && <div className="flex-shrink-0 ml-2">{statusBadge}</div>}
        </div>
        {/* Service name. */}
        <p className={cn("text-sm", timeClass, "opacity-90")}>
          {appointment.serviceName}
        </p>
      </CardHeader>
      <CardContent className="pb-3 pt-1 px-4">
        {/* Appointment time. */}
        <div className={cn(
            "flex items-center text-sm mb-1 font-medium",
           timeClass
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          <span>{appointment.startTime} - {appointment.endTime}</span>
        </div>
        {/* Detailed status label. */}
        <p className={cn("text-xs capitalize", timeClass, "opacity-80")}>Status: {getStatusLabel()}</p>
      </CardContent>
      {/* Footer with action buttons, if applicable. */}
      {(status !== 'completed' && status !== 'cancelled' && status !== 'no-show') && (
        <CardFooter className="flex justify-end items-center space-x-2 pb-3 pt-2 px-4 bg-transparent">
          {renderActionButtons()}
        </CardFooter>
      )}
    </Card>
  );
}
