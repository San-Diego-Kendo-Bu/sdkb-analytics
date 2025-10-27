function padNumber(number){
    return number.toString().padStart(2, '0');
}

function getTodayDate(){
    const date = new Date();
    const year = date.getFullYear();
    const month = padNumber(date.getMonth() + 1);
    const day = padNumber(date.getDate());

    return `${year}-${month}-${day}`;
}

function getCurrentTimeUTC(){
    const date = new Date();
    const year = date.getFullYear();
    const month = padNumber(date.getMonth() + 1);
    const day = padNumber(date.getDate());
    const hour = padNumber(date.getHours());
    const minute = padNumber(date.getMinutes());
    const second = padNumber(date.getSeconds());

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

module.exports = { getTodayDate, getCurrentTimeUTC }