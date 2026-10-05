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

// Dates like due_date/created_at are stored as UTC midnight of the intended calendar day
// (see Payments.jsx's toIsoDate) — the UTC digits ARE the intended day. Reading them back with
// the local getters (getDate(), getMonth(), ...) reinterprets those digits in the viewer's own
// timezone instead, which rolls the displayed day back by one for anyone west of UTC (e.g.
// Pacific). The UTC getters read the stored digits back literally, independent of the viewer.
export function tzToMMDDYYY(tzString){
    const date = new Date(tzString);
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    return `
        ${month < 10 ? '0' + month : month}/${day < 10 ? '0' + day : day}/${year}
        ${hours < 10 ? '0' + hours : hours}:${minutes < 10 ? '0' + minutes : minutes}
    `;
}

export function extractDate(tzString){
    const date = new Date(tzString);
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    return {
        year: year,
        month: month < 10 ? '0' + month : month,
        day: day < 10 ? '0' + day : day,
        hours: date.getUTCHours(),
        minutes: date.getUTCMinutes()
    };
}

export function getMonthAbreviation(monthNumber){
    const monthAbreviations = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return monthAbreviations[monthNumber - 1] || '';
}