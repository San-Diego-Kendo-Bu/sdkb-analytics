import DashboardCard from '../react_components/DashboardCard';
import { MdEditCalendar } from "react-icons/md";
import { BiCalendarPlus } from "react-icons/bi";
import { MdOutlineAnnouncement } from "react-icons/md";
import { TfiAnnouncement } from "react-icons/tfi";
import { MdManageAccounts } from "react-icons/md";
import { MdPayment } from "react-icons/md";
import '../../css/admindashboard.css';

const palettes = {
  purple : {
    r : 100,
    g : 70,
    b : 180,
    a : 1
  },
  pink : {
    r: 176, 
    g : 70, 
    b : 180,
    a : 1
  },
  yellow : {
    r : 255,
    g : 180,
    b : 18,
    a : 1
  },
  orange : {
    r : 255, 
    g : 140, 
    b : 18,
    a : 1
  },
  blue : {
    r : 41,
    g : 79,
    b : 204,
    a : 1
  },
  red : {
    r : 255,
    g : 18, 
    b : 18,
    a : 1
  },
  green : {
    r : 49, 
    g : 168, 
    b : 75,
    a: 1
  },
  aqua : {
    r: 18, 
    g : 255, 
    b : 222,
    a : 1
  }
}


function AdminDashboard() {
  const cardWidth = 390;
  const cardHeight = 210
  return (
    <>
      <div style={{padding:"2%"}}>
        <header>
          <h1>Quick Actions</h1>
          <p> Common tasks and management tools</p>
        </header>
        <div className='container'>
          <DashboardCard 
          title='Create Event' 
          description='Add a new event to your calendar'
          icon={BiCalendarPlus}
          color={palettes.purple}
          width={cardWidth}
          height={cardHeight}
          />
          <DashboardCard 
          title='Create Announcement' 
          description='Create structured announcements'
          icon={TfiAnnouncement}
          color={palettes.yellow}
          width={cardWidth}
          height={cardHeight}
          />
          <DashboardCard 
          title='View Payments' 
          description='Review payment history and analytics'
          icon={MdPayment}
          color={palettes.green}
          width={cardWidth}
          height={cardHeight}
          />
        </div>
        <div className='container'>
          <DashboardCard 
          title='Manage Events' 
          description='Edit and organize events'
          icon={MdEditCalendar}
          color={palettes.pink}
          width={cardWidth}
          height={cardHeight}
          />
          <DashboardCard 
          title='Manage Announcements' 
          description='Edit and organize announcements'
          icon={MdOutlineAnnouncement}
          color={palettes.orange}
          width={cardWidth}
          height={cardHeight}
          />
          <DashboardCard 
          title='Manage Members' 
          description='View and manage member accounts'
          icon={MdManageAccounts}
          color={palettes.blue}
          width={cardWidth}
          height={cardHeight}
          />
        </div>
      </div>
    </>
  )
}

export default AdminDashboard;
