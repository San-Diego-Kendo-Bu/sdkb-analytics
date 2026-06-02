import paymentStyles from '../../css/paymentpage.module.css';
import {extractDate, getMonthAbreviation} from '/src/js/shared/dateTools';
function PaymentEntry({id,title,created_at,due_date,payment_value,overdue_value}){
    
    const dueDateObj = extractDate(due_date);
    const createdAtObj = extractDate(created_at);
    const monthAbreviation = getMonthAbreviation(dueDateObj.month);
    const amountDue = payment_value.toFixed(2);
    const lateFee = (overdue_value && overdue_value > 0) 
        ? (((overdue_value / payment_value) - 1) * 100).toFixed(2) 
        : undefined; 
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
            {lateFee ?
                <div className={paymentStyles.configRow}>
                    <span className={paymentStyles.cardLateFee}>{lateFee}% Late Fee</span>
                </div>
                : null
            }

            <div className={paymentStyles.configRow}>
                <span className={paymentStyles.cardMeta}>Created: {createdAtObj.day} {getMonthAbreviation(createdAtObj.month)} {createdAtObj.year}</span>
            </div>

        </div>
        {/* <tr>
            <td className={paymentStyles.longcell}>{title}</td>
            <td className={paymentStyles.longcell}>{created_at}</td>
            <td className={paymentStyles.longcell}>{due_date}</td>
            <td className={paymentStyles.longcell}>{payment_value}</td>
        </tr> */}
    </div>
    );
}
export default PaymentEntry;