import paymentStyles from '../../css/paymentpage.module.css';
function PaymentEntry({id,title,created_at,due_date,payment_value}){
    return(
    <tr>
        <td className={paymentStyles.longcell}>{title}</td>
        <td className={paymentStyles.longcell}>{created_at}</td>
        <td className={paymentStyles.longcell}>{due_date}</td>
        <td className={paymentStyles.longcell}>{payment_value}</td>
    </tr>
    );
}
export default PaymentEntry;