import AdminDashboard from "./AdminDashboard";
import Payments from "./Payments";
import Members from "./Members";
import Events from "./Events";
import Announcements from "./Announcements";
import TournamentResults from "./TournamentResults";

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
        case "TournamentResults":
            component = <TournamentResults/>;
            break;
        default:
            component = <AdminDashboard setPage={setPage}/>;
    }

    if (page === "Dashboard") return component;

    return (
        <div>
            <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 2%', borderBottom: '1px solid var(--border)' }}>
                <button
                    onClick={() => setPage("Dashboard")}
                    style={{
                        background: 'transparent',
                        border: '1px solid var(--border-btn)',
                        color: 'var(--text-secondary)',
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