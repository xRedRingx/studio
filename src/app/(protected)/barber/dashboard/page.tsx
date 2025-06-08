'use client';
import ProtectedPage from '@/components/layout/ProtectedPage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export default function BarberDashboardPage() {
  const { user } = useAuth();
  return (
    <ProtectedPage expectedRole="barber">
      <div className="space-y-8">
         <h1 className="text-4xl font-headline font-bold">
          Barber Dashboard, {user?.firstName || user?.displayName || 'Barber'}!
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>Your Schedule</CardTitle>
            <CardDescription>Manage your appointments and availability.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Your schedule for today is empty.</p>
            <Button className="mt-4">View Full Schedule</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manage Services</CardTitle>
            <CardDescription>Add, edit, or remove the services you offer.</CardDescription>
          </CardHeader>
          <CardContent>
             <p className="text-muted-foreground">You have not added any services yet.</p>
             <Button variant="outline" className="mt-4">Add New Service</Button>
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
