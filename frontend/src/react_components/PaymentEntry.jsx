import paymentStyles from '../../css/paymentpage.module.css';
import {extractDate, getMonthAbreviation} from '/src/js/shared/dateTools';
function PaymentEntry({id,title,created_at,due_date,payment_value,overdue_penalty,is_dojo_due,actions}){

    const dueDateObj = extractDate(due_date);
    const createdAtObj = extractDate(created_at);
    const monthAbreviation = getMonthAbreviation(dueDateObj.month);
    const numPayment = Number(payment_value);
    const numPenalty = overdue_penalty != null ? Number(overdue_penalty) : null;
    const isOverdue = due_date ? new Date().toISOString().slice(0, 10) > due_date.slice(0, 10) : false;
    const total = isOverdue && numPenalty ? numPayment + numPenalty : numPayment;

    return(
    <div className={paymentStyles.card}>
        <div className={paymentStyles.dateBadge}>
            <span className={paymentStyles.dueDateLabel}>{isOverdue ? 'Overdue' : 'Due'}</span>
            <span className={paymentStyles.dateDay}>{dueDateObj.day}</span>
            <span className={paymentStyles.dateMonth}>{monthAbreviation}</span>
        </div>
        <div className={paymentStyles.cardBody}>
            <div className={paymentStyles.cardTop}>
                {isOverdue && numPenalty ? (
                    <>
                        <span className={paymentStyles.cardValue} style={{ color: '#e05252' }}>${total.toFixed(2)}</span>
                        <span className={paymentStyles.configLabel}>{title}</span>
                        <span className={paymentStyles.badge} style={{ backgroundColor: '#d32f2f' }}>Overdue</span>
                        {is_dojo_due && <span className={paymentStyles.badge} style={{ backgroundColor: '#6a1b9a' }}>Dojo Due</span>}
                    </>
                ) : (
                    <>
                        <span className={paymentStyles.cardValue}>${numPayment.toFixed(2)}</span>
                        <span className={paymentStyles.configLabel}>{title}</span>
                        {is_dojo_due && <span className={paymentStyles.badge} style={{ backgroundColor: '#6a1b9a' }}>Dojo Due</span>}
                    </>
                )}
            </div>
            {isOverdue && numPenalty ? (
                <div className={paymentStyles.configRow}>
                    <span className={paymentStyles.cardLateFee} style={{ color: '#e05252' }}>
                        ${numPayment.toFixed(2)} base + ${numPenalty.toFixed(2)} overdue penalty
                    </span>
                </div>
            ) : numPenalty ? (
                <div className={paymentStyles.configRow}>
                    <span className={paymentStyles.cardLateFee}>Late fee: +${numPenalty.toFixed(2)} if past due</span>
                </div>
            ) : null}

            <div className={paymentStyles.configRow}>
                <span className={paymentStyles.cardMeta}>Created: {createdAtObj.day} {getMonthAbreviation(createdAtObj.month)} {createdAtObj.year}</span>
            </div>

            {actions && <div className={paymentStyles.cardActions} style={{ marginTop: '0.75rem' }}>{actions}</div>}
        </div>
    </div>
    );
}
export default PaymentEntry;