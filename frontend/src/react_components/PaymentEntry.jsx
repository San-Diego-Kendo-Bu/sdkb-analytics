import paymentStyles from '../../css/paymentpage.module.css';
import {extractDate, getMonthAbreviation} from '/src/js/shared/dateTools';
function PaymentEntry({id,title,created_at,due_date,payment_value}){
    
    const dueDateObj = extractDate(due_date);
    const createdAtObj = extractDate(created_at);
    const monthAbreviation = getMonthAbreviation(dueDateObj.month);

    return(
    <div className={paymentStyles.card}>
        <div className={paymentStyles.dateBadge}>
            <span className={paymentStyles.dueDateLabel}>Due</span>
            <span className={paymentStyles.dateDay}>{dueDateObj.day}</span>
            <span className={paymentStyles.dateMonth}>{monthAbreviation}</span>
        </div>
        <div className={paymentStyles.cardBody}>
            <div className={paymentStyles.cardTop}>
                <span className={paymentStyles.cardTitle}>${payment_value}</span>
                <span className={paymentStyles.configLabel}>{title}</span>
            </div>
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