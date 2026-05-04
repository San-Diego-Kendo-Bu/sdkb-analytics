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

export function tzToMMDDYYY(tzString){
    const date = new Date(tzString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `
        ${month < 10 ? '0' + month : month}/${day < 10 ? '0' + day : day}/${year}  
        ${hours < 10 ? '0' + hours : hours}:${minutes < 10 ? '0' + minutes : minutes}
    `;
}