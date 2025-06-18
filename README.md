# BarberFlow - Barber Booking Application

BarberFlow is a modern, full-stack web application designed to seamlessly connect barbers and customers, facilitating appointment booking, service management, and scheduling. This application is built with a focus on a clean user experience and robust functionality.

## Key Features

*   **Dual User Roles:** Separate interfaces and functionalities for Customers and Barbers.
*   **Authentication:** Secure user registration and login for both roles.
*   **Barber Dashboard:**
    *   Manage services (add, edit, delete).
    *   Set and update weekly work schedules.
    *   Manage unavailable dates.
    *   View and manage today's appointments (check-in, mark as done).
    *   Add walk-in appointments.
    *   Toggle online booking availability.
*   **Customer Dashboard:**
    *   View upcoming appointments.
    *   Cancel appointments.
    *   Explore available barbers and their services.
*   **Booking System:**
    *   Customers can select services, pick available dates/times, and confirm bookings.
    *   Visual progress stepper for booking flow.
    *   Real-time availability checking.
*   **Profile Management:** Users can edit their profile information.
*   **Push Notifications:** (Foundation laid) For appointment reminders and other updates via Firebase Cloud Messaging.
*   **Responsive Design:** Optimized for both desktop and mobile use.
*   **Theme Toggle:** Light and Dark mode support.

## Tech Stack

*   **Frontend:** Next.js (App Router), React, TypeScript
*   **UI:** ShadCN UI Components, Tailwind CSS
*   **Backend & Database:** Firebase (Authentication, Firestore)
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
6.  (For Push Notifications) Enable Firebase Cloud Messaging and generate a VAPID key, then update it in `src/components/layout/UserNav.tsx`.

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
    *   `barber/` & `customer/`: Role-specific routes.
*   `src/components/`: Reusable UI components.
    *   `auth/`: Authentication related forms and wrappers.
    *   `barber/`: Components specific to the barber role.
    *   `customer/`: Components specific to the customer role.
    *   `layout/`: Layout components (navigation, theme, etc.).
    *   `ui/`: ShadCN UI primitives.
*   `src/contexts/`: React Context providers (e.g., `AuthContext`).
*   `src/firebase/`: Firebase configuration and initialization.
*   `src/hooks/`: Custom React hooks.
*   `src/lib/`: Utility functions, constants.
*   `src/types/`: TypeScript type definitions.
*   `public/`: Static assets, including `firebase-messaging-sw.js`.

<!-- This README provides a comprehensive overview of the BarberFlow application. -->
<!-- It details features, tech stack, setup instructions, and project structure. -->
<!-- It is intended for developers and anyone looking to understand or contribute to the project. -->
