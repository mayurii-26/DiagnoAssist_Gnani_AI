import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import DoctorPresenceManager from "@/components/DoctorPresenceManager";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="dashboard-layout">
            <Sidebar />
            <div className="dashboard-main">
                <TopBar />
                <div className="dashboard-content">{children}</div>
            </div>
            <DoctorPresenceManager />
        </div>
    );
}
