/**
 * TODO: component isn't updating after fetchPayments promise resolves. Gotta fix that somehow.
 */

import { fetchPayments } from "../js/payments/paymentManager";
import PaymentEntry from "../react_components/PaymentEntry";
import paymentStyles from '../../css/paymentpage.module.css';
import { useEffect, useState } from "react";

function Payments(){
    const [payments, setPayments] = useState(null);
    /**
     * No dependency array: the effect runs after every render 
     * Dependency array is empty ([]), it runs once on mount; 
     * Dependency array is provided, it runs only when those values change.
     */
    useEffect(async () => {
        async function startFetching(){ // TODO: handle errors
            const response = await fetchPayments();
            const data = response.data;
            setPayments(data);
        }
        
        startFetching();
        // return () => {
        // Cleanup function (optional)
        // };
    }, []);

    return (
        <>
            <h1>PAYMENTS</h1>
            <button onClick={()=>{setPayments(fetchPayments)}}>Refresh</button>
            {payments ? 
                <table>
                <thead>
                    <tr>
                        <th className={paymentStyles.mediumcell}>Title</th>
                        <th className={paymentStyles.mediumcell}>Created</th>
                        <th className={paymentStyles.mediumcell}>Due</th>
                        <th className={paymentStyles.shortcell}>Value</th>
                    </tr>
                </thead>
                <tbody>
                    {payments.map(p => (
                        <PaymentEntry key={p.payment_id} title={p.title} created_at={p.created_at} due_date={p.due_date} payment_value={p.payment_value}/>
                    ))}
                </tbody>
            </table> : <p>Fetching Payments...</p>
            }

        </>
    );
}
export default Payments;