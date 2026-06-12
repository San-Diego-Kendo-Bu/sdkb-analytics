import paymentStyles from '../../css/paymentpage.module.css';
import {extractDate, getMonthAbreviation} from '/src/js/shared/dateTools';
function PaymentEntry({id,title,created_at,due_date,payment_value,overdue_penalty}){

    const dueDateObj = extractDate(due_date);
    const createdAtObj = extractDate(created_at);
    const monthAbreviation = getMonthAbreviation(dueDateObj.month);
    const numPayment = Number(payment_value);
    const numPenalty = overdue_penalty != null ? Number(overdue_penalty) : null;
    const amountDue = numPayment.toFixed(2);

    return(
    <div className={paymentStyles.card}>
        <div className={paymentStyles.dateBadge}>
            <span className={paymentStyles.dueDateLabel}>Due</span>
            <span className={paymentStyles.dateDay}>{dueDateObj.day}</span>
            <span className={paymentStyles.dateMonth}>{monthAbreviation}</span>
        </div>
        <div className={paymentStyles.cardBody}>
            <div className={paymentStyles.cardTop}>
                <span className={paymentStyles.cardValue}>${amountDue}</span>
                <span className={paymentStyles.configLabel}>{title}</span>
            </div>
            {overdue_penalty != null && overdue_penalty > 0 ?
                <div className={paymentStyles.configRow}>
                    <span className={paymentStyles.cardLateFee}>Additional ${overdue_penalty} if late</span>
                </div>
                : null
            }

            <div className={paymentStyles.configRow}>
                <span className={paymentStyles.cardMeta}>Created: {createdAtObj.day} {getMonthAbreviation(createdAtObj.month)} {createdAtObj.year}</span>
            </div>

        </div>
    </div>
    );
}
export default PaymentEntry;