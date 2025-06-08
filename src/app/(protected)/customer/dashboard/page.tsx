'use client';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export default function CustomerDashboardPage() {
  const { user } = useAuth();
  return (
    <ProtectedPage expectedRole="customer">
      <div className="space-y-8">
        <h1 className="text-4xl font-headline font-bold">
          Welcome, {user?.firstName || user?.displayName || 'Customer'}!
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>Your Appointments</CardTitle>
            <CardDescription>View and manage your upcoming appointments.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">You have no upcoming appointments.</p>
            <Button className="mt-4">Book New Appointment</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Explore Services</CardTitle>
            <CardDescription>Discover services offered by our talented barbers.</CardDescription>
          </CardHeader>
          <CardContent>
             <p className="text-muted-foreground">Service listings will appear here.</p>
             <Button variant="outline" className="mt-4">Browse All Services</Button>
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
