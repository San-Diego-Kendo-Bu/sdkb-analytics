const WRAPPER_MULTIPLIER = 1.5;

function CardIcon( {icon, size, color} ){
    
    const IconWrapperStyle = {
        width : `${size * WRAPPER_MULTIPLIER}px`,
        height : `${size *  WRAPPER_MULTIPLIER}px`,
        backgroundColor : `rgba(${color.r}, ${color.g}, ${color.b}, 0.15)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "10px",
    };

    const IconStyle = {
        color : `rgba(${color.r}, ${color.g}, ${color.b}, 1.0)`
    };

    const Icon = icon;
    return(
        <div style={IconWrapperStyle}>
            <Icon size={size} style={IconStyle}/>
        </div>
    );
}
export default CardIcon