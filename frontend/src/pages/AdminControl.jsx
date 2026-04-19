import AdminDashboard from "./AdminDashboard";
import Payments from "./Payments";
import Members from "./Members";
import Events from "./Events";

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
        default:
            component = <AdminDashboard setPage={setPage}/>;
    }
    return component;
}
export default AdminControl;