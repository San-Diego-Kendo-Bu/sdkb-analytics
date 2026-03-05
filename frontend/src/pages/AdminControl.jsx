import AdminDashboard from "./AdminDashboard";
import Payments from "./Payments";
import Members from "./Members";

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
        default:
            component = <AdminDashboard setPage={setPage}/>;
    }
    return component;
}
export default AdminControl;