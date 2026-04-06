import paymentStyles from '../../css/paymentpage.module.css';

function PaymentEntry({id,title,created_at,due_date,payment_value}){
    return(
        <tr>
            <td className={paymentStyles.mediumcell}>{title}</td>
            <td className={paymentStyles.mediumcell}>{created_at}</td>
            <td className={paymentStyles.mediumcell}>{due_date}</td>
            <td className={paymentStyles.shortcell}>{payment_value}</td>
        </tr>
    );
}
export default PaymentEntry;