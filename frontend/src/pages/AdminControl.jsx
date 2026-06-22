import AdminDashboard from "./AdminDashboard";
import Payments from "./Payments";
import Members from "./Members";
import Events from "./Events";
import Announcements from "./Announcements";

import { useState } from "react";

function AdminControl(){
    const [page, setPage] = useState("Dashboard");
    let component;
    switch(page){
        case "Members":
            component = <Members/>;
            break;
        case "Payments":
            component = <Payments/>;
            break;
        case "Events":
            component = <Events/>;
            break;
        case "Announcements":
            component = <Announcements/>;
            break;
        default:
            component = <AdminDashboard setPage={setPage}/>;
    }

    if (page === "Dashboard") return component;

    return (
        <div>
            <div style={{ background: '#1a1a2e', padding: '0.75rem 2%' }}>
                <button
                    onClick={() => setPage("Dashboard")}
                    style={{
                        background: 'transparent',
                        border: '1px solid #555',
                        color: '#ccc',
                        borderRadius: '6px',
                        padding: '0.3rem 0.9rem',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                    }}
                >
                    ← Back
                </button>
            </div>
            {component}
        </div>
    );
}
export default AdminControl;