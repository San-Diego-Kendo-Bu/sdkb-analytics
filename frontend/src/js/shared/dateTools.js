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