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

function calcAge(birthday){
    if (!birthday) return null;
    const dob = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

// The RDS instance is stopped on a schedule (see database-stack.ts: 2am PT both weekdays and
// weekends). Payments close at midnight — 2 hours earlier than that — so a checkout initiated
// while the DB is still up has time to finish (Stripe confirmation + webhook) before the DB
// actually goes down — otherwise a successful Stripe charge can silently fail to record in
// submitted_payments. Midnight also lines up with when most payments are due anyway.
function isPaymentsClosed(){
    const now = new Date();
    const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const hour = pt.getHours();
    const day = pt.getDay();
    const isWeekend = day === 0 || day === 6;
    return hour < (isWeekend ? 5 : 7);
}

// "Today" for due-date/overdue comparisons needs to be the dojo's own calendar day (Pacific),
// not UTC's. UTC rolls over to the next calendar date at 5pm PDT / 4pm PST — comparing against
// a UTC-based "today" made payments look overdue several hours early every single evening,
// in the dojo's own timezone. `date` defaults to now; pass an explicit instant (e.g. the
// moment a payment was submitted) to get that instant's Pacific calendar date instead.
function getPacificDateString(date = new Date()){
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const get = (type) => parts.find(p => p.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
}

module.exports = { getTodayDate, getCurrentTimeUTC, calcAge, isPaymentsClosed, getPacificDateString }