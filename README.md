# BarberFlow - Barber Booking & Management Application

BarberFlow is a modern, full-stack web application designed to seamlessly connect barbers and customers. It facilitates appointment booking, service management, scheduling, financial tracking, and provides robust operational policies to ensure a smooth experience for both user roles. This application is built with a focus on a clean user experience and extensive functionality.

## Core Functionalities

### For Customers:
*   **User Authentication:** Secure registration and login.
*   **Dashboard:** View upcoming and past appointments.
*   **Explore Barbers:** Discover available barbers and view their detailed profiles, including services, bio, and specialties.
*   **Booking System:**
    *   Select services from a chosen barber.
    *   Pick available dates and time slots, respecting barber's schedule, unavailable dates, and minimum booking lead times.
    *   Visual progress stepper guides through the booking flow.
    *   Real-time availability checking based on barber's schedule and existing appointments.
    *   Confirm booking details before finalizing.
*   **Appointment Management:**
    *   View upcoming appointments with details.
    *   Check-in for appointments.
    *   Confirm service start/completion (if initiated by barber).
    *   Cancel upcoming appointments (subject to cancellation policies).
    *   Rebook past services.
*   **Profile Management:** Edit personal information (name, phone, address).
*   **Notifications:** (Foundation laid) Receive reminders for upcoming appointments and updates.

### For Barbers:
*   **User Authentication:** Secure verification and registration/login.
*   **Dashboard:**
    *   Overview of today's appointments.
    *   Quick actions: Record customer arrival (check-in), confirm service start/completion, mark as no-show.
    *   Add walk-in appointments, with automatic slot finding.
    *   Toggle online booking acceptance.
    *   Toggle temporary unavailability (busy mode).
*   **Service Management:** Add, edit, and delete services offered (name, price, duration).
*   **Schedule Management:** Set and update weekly work schedules (open/closed days, start/end times).
*   **Availability Management:** Mark specific dates as unavailable (e.g., holidays, personal days off).
*   **Financial Tracking (Earnings Page):**
    *   View daily and weekly earnings from completed appointments.
    *   Manually add and manage daily spending entries.
    *   Automatically calculated daily and weekly profits (Earnings - Spendings).
*   **Profile Management:** Edit personal information and barber-specific details (bio, specialties).
*   **Notifications:** (Foundation laid) Potentially receive notifications for new bookings or cancellations.

## Key Features (Detailed)

*   **Dual User Roles:** Separate, tailored interfaces and functionalities for Customers and Barbers.
*   **Secure Authentication:** Firebase-powered user registration and login.
*   **Comprehensive Barber Dashboard:** Central hub for barbers to manage their day-to-day operations, including today's appointments, walk-ins, and operational status toggles.
*   **Dynamic Customer Booking:** Multi-step booking process with real-time slot availability, service selection, and confirmation.
*   **Service Customization:** Barbers can define their services with names, prices, and durations.
*   **Flexible Scheduling:** Barbers can set their regular weekly hours and mark specific dates as unavailable.
*   **Financial Overview:** Dedicated page for barbers to track earnings, manage spendings, and view profits.
*   **Walk-In Appointment Support:** Barbers can easily add walk-in customers, with the system finding the earliest available slot.
*   **Profile Personalization:** Users can update their profile details; barbers can add a bio and list specialties.
*   **Push Notification System:** Foundation for Firebase Cloud Messaging to send reminders and other alerts (e.g., appointment reminders function implemented).
*   **Responsive Design:** Optimized for a consistent experience on both desktop and mobile web browsers.
*   **Theme Toggle:** Light and Dark mode support for user preference.
*   **Local Storage Caching:** Enhances user experience by caching frequently accessed data (e.g., services, schedules, appointments) for faster initial loads.
*   **Detailed Code Commenting:** Facilitates easier understanding and maintenance of the codebase.

## Implemented Policies

The application incorporates several policies to ensure fair usage and smooth operations:

### Customer Booking & Interaction Policies:
1.  **Minimum Booking Lead Time:** Customers cannot book appointments less than a predefined time (e.g., 15 minutes) before the desired slot on the current day.
2.  **Cancellation Lead Time:** Customers cannot cancel an appointment if it's within a predefined time (e.g., 2 hours) of the scheduled start.
3.  **Daily Cancellation Limit:** Customers are limited to a certain number of cancellations per day (e.g., 2).
4.  **Weekly Cancellation Limit:** Customers are limited to a certain number of cancellations per week (e.g., 4).
5.  **Daily Active Booking Limit:** Customers can only have a limited number of active (non-cancelled/completed) bookings per day (e.g., 1).
6.  **Weekly Active Booking Limit:** Customers can only have a limited number of active bookings per week (e.g., 2).

### Barber Operational Policies:
1.  **No-Show Tracking:**
    *   **Grace Period:** A short grace period (e.g., 5 minutes) is given after an appointment's start time.
    *   **Decision Point:** If the customer hasn't arrived after the grace period, the barber can choose to "Mark No-Show" or still "Record Arrival" if the customer arrives late.
2.  **Online Booking Status Toggle:** Barbers can enable/disable acceptance of new online bookings. This does not affect existing appointments or their ability to add walk-ins.
3.  **Temporary Unavailability Toggle ("Busy Mode"):**
    *   Barbers can mark themselves as temporarily unavailable (e.g., for a short break).
    *   The duration of this unavailability is tracked.
    *   Upon returning to "Available" status, all of the barber's *upcoming appointments for that day* are automatically shifted forward by the duration of the unavailability.
    *   Customers viewing the barber's profile or booking page will see if the barber is temporarily busy.

## User Flows

### Typical Customer Flow:
1.  Register or Login as a Customer.
2.  From the dashboard, explore available barbers or view upcoming appointments.
3.  Select a barber to view their profile and services.
4.  Initiate booking: Select a service, choose an available date and time slot.
5.  Confirm booking details.
6.  On appointment day: Check-in via the dashboard. Confirm service completion if prompted.
7.  Cancel appointments (if within policy limits).

### Typical Barber Flow:
1.  Verify (if first-time barber registration) then Register or Login as a Barber.
2.  Land on the Dashboard:
    *   Manage today's appointments (check-in, start, complete, no-show).
    *   Add walk-in appointments.
    *   Toggle online booking status or temporary unavailability.
3.  Navigate to "Manage Services" to add, edit, or delete services.
4.  Navigate to "My Schedule" to set weekly working hours.
5.  Navigate to "My Availability" to block out specific unavailable dates.
6.  Navigate to "My Financials" to view earnings, add/manage spendings, and track profits.
7.  Navigate to "Edit Profile" to update personal and professional details.

## Tech Stack

*   **Frontend:** Next.js (App Router), React, TypeScript
*   **UI:** ShadCN UI Components, Tailwind CSS
*   **Backend & Database:** Firebase (Authentication, Firestore)
*   **Push Notifications:** Firebase Cloud Messaging (FCM)
*   **AI (Future Integration):** Genkit
*   **Offline Capabilities:** Basic local storage caching for improved UX.

## Getting Started

### Prerequisites

*   Node.js (version 18.x or later recommended)
*   npm or yarn

### Firebase Setup

1.  Ensure you have a Firebase project created.
2.  Obtain your Firebase project configuration (apiKey, authDomain, etc.).
3.  Update the Firebase configuration in `src/firebase/config.ts` with your project's credentials.
4.  Set up Firebase Authentication (Email/Password).
5.  Enable Firestore database.
    *   **Firestore Rules:** For development and initial testing, permissive rules are provided in `firestore.rules`. **These rules are NOT production-ready and MUST be replaced with secure, fine-grained rules before any public deployment.** Deploy rules using `firebase deploy --only firestore:rules`.
    *   **Required Indexes:** Ensure you have the necessary Firestore indexes for queries (details often noted in comments within data-fetching functions, especially for `sendAppointmentReminders` and `BarberEarningsPage`).
6.  (For Push Notifications) Enable Firebase Cloud Messaging and generate a VAPID key, then update it in `src/components/layout/UserNav.tsx`.
7.  (For Scheduled Functions) Deploy the `sendAppointmentReminders` Cloud Function from the `functions` directory.

### Running Locally

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd barberflow-app 
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
3.  **Run the development server:**
    The application runs on port 9002 by default.
    ```bash
    npm run dev
    # or
    yarn dev
    ```
4.  Open [http://localhost:9002](http://localhost:9002) in your browser to see the application.

## Project Structure

*   `src/app/`: Main application routes using Next.js App Router.
    *   `(protected)/`: Routes requiring authentication.
        *   `barber/`: Barber-specific authenticated routes (dashboard, services, schedule, availability, earnings).
        *   `customer/`: Customer-specific authenticated routes (dashboard, booking, view barber).
        *   `profile/`: Shared profile editing route.
    *   `barber/` & `customer/`: Public-facing auth routes for barbers and customers (login, register).
    *   `forgot-password/`: Password reset page.
    *   `page.tsx`: Root entry point, handles role selection or redirects.
*   `src/components/`: Reusable UI components.
    *   `auth/`: Authentication related forms and wrappers (RoleSelector, AuthFormWrapper, LoginForm, etc.).
    *   `barber/`: Components specific to the barber role (AppointmentCard, DayScheduleInput, ManageServicesSection, etc.).
    *   `customer/`: Components specific to the customer role.
    *   `icons/`: Custom icon components (BarberFlowLogo).
    *   `layout/`: Layout components (ProtectedPage, UserNav, ThemeToggle, OfflineIndicator, etc.).
    *   `ui/`: ShadCN UI primitives (Button, Card, Dialog, etc.).
    *   `user/`: User-related components (ProfileEditForm).
*   `src/contexts/`: React Context providers (e.g., `AuthContext`).
*   `src/firebase/`: Firebase configuration (`config.ts`).
*   `src/hooks/`: Custom React hooks (useAuth, useOfflineStatus, useToast, useIsMobile).
*   `src/lib/`: Utility functions, constants, and type definitions (`constants.ts`, `firestoreUtils.ts`, `localStorageUtils.ts`, `utils.ts`).
*   `src/types/`: TypeScript type definitions (`index.ts`).
*   `src/functions/`: Firebase Cloud Functions (e.g., `sendAppointmentReminders`).
*   `public/`: Static assets, including `firebase-messaging-sw.js`.

<!-- This README provides a comprehensive overview of the BarberFlow application. -->
<!-- It details features, tech stack, setup instructions, and project structure. -->
<!-- It is intended for developers and anyone looking to understand or contribute to the project. -->
<!-- Generated by AI. -->
