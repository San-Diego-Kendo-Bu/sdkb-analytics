import DashboardCard from '../react_components/DashboardCard';
import { MdEditCalendar } from "react-icons/md";
import { MdOutlineAnnouncement } from "react-icons/md";
import { MdManageAccounts } from "react-icons/md";
import { MdPayment } from "react-icons/md";
import '../../css/admindashboard.css';

function AdminDashboard({setPage}) {
  const palettes = {
    pink : { r: 176, g : 70, b : 180, a : 1 },
    orange : { r : 255, g : 140, b : 18, a : 1 },
    blue : { r : 41, g : 79, b : 204, a : 1 },
    green : { r : 49, g : 168, b : 75, a: 1 },
  };

  const cardWidth = 390;
  const cardHeight = 210;
  return (
    <div className='admin-dashboard'>
      <div style={{padding:"2%"}}>
        <header className='page-header'>
          <h1>Quick Actions</h1>
          <p> Common tasks and management tools</p>
        </header>
        <div className='admin-dashboard container'>
          <DashboardCard 
          title='Payments' 
          description='Review payment history and analytics'
          icon={MdPayment}
          color={palettes.green}
          width={cardWidth}
          height={cardHeight}
          onClick={()=>setPage("Payments")}
          />
          <DashboardCard 
          title='Announcements' 
          description='Edit and organize announcements'
          icon={MdOutlineAnnouncement}
          color={palettes.orange}
          width={cardWidth}
          height={cardHeight}
          onClick={()=>{console.log("Announcements");}}
          />
        </div>
        <div className='container'>
          <DashboardCard 
          title='Members' 
          description='View and manage member accounts'
          icon={MdManageAccounts}
          color={palettes.blue}
          width={cardWidth}
          height={cardHeight}
          onClick={()=>setPage("Members")}
          />
          <DashboardCard 
          title='Events' 
          description='Edit and organize events'
          icon={MdEditCalendar}
          color={palettes.pink}
          width={cardWidth}
          height={cardHeight}
          onClick={()=>setPage("Events")}
          />
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
