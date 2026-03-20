import { fetchPayments } from "../js/payments/paymentManager";

function Payments(){

    return (
        <>
            <h1>PAYMENTS</h1>
            <button onClick={()=>{fetchPayments()}}>Fetch Payments</button>
        </>
    );
}
export default Payments;