import DashboardLayout from '../components/DashboardLayout';
import StudentSpace from '../components/dashboard/StudentSpace';

export default function StudentDashboard() {
  return (
    <DashboardLayout title="Academic Profile">
      <StudentSpace />
    </DashboardLayout>
  );
}
