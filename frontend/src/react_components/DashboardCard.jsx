import { useState } from "react";
import CardIcon from "./CardIcon";

function DashboardCard({title, description, icon, color, width, height}){
    const [hover, setHover] = useState(false);

    const cardStyle = {
        backgroundColor: `rgba(${color.r}, ${color.g}, ${color.b}, 0.1)`,
        borderRadius: "20px",
        padding:"3%",
        width:`${width}px`,
        height:`${height}px`,
    };

    const cardStyleHover = {
        backgroundColor: `rgba(${color.r}, ${color.g}, ${color.b}, 0.2)`,
        borderRadius: "20px",
        padding:"3%",
        width:`${width}px`,
        height:`${height}px`,
        cursor:"pointer"
    }
    return(
        <div className="dashboard-card" 
        style={hover ? cardStyleHover : cardStyle} 
        onMouseEnter={ () => setHover(true)}
        onMouseLeave={ () => setHover(false)}
        >
            <CardIcon icon={icon} size={40} color={color} />
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    );
}
export default DashboardCard;