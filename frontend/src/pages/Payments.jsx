/**
 * TODO: component isn't updating after fetchPayments promise resolves. Gotta fix that somehow.
 */

import { fetchPayments } from "../js/payments/paymentManager";
import PaymentEntry from "../react_components/PaymentEntry";
import { useEffect, useState } from "react";

import { tzToMMDDYYY } from "../js/shared/dateTools";

import paymentStyles from '../../css/paymentpage.module.css';
import entryTableStyles from '../../css/entrytable.module.css';

const dummy = [
    {
        payment_id : 0,
        title: "2025 Dojo Glorious Membership Fee",
        created_at: "2026-04-05T19:09:52.000Z",
        due_date: "2025-11-30T00:00:00.000Z",
        payment_value: 50
    },
    {
        payment_id : 1,
        title: "i kendo it",
        created_at: "2026-04-05T19:04:51.000Z",
        due_date: "2025-11-30T00:00:00.000Z",
        payment_value: 50
    },
    {
        payment_id : 2,
        title: "2025 Dojo Glorious Membership Fee",
        created_at: "2026-04-05T19:21:25.000Z",
        due_date: "2025-11-30T00:00:00.000Z",
        payment_value: 50
    },
    {
        payment_id : 3,
        title: "Overdue no assignments or submissions",
        created_at: "2026-04-12T19:32:34.000Z",
        due_date: "2025-12-12T00:00:00.000Z",
        payment_value: 10
    }
];

function Payments(){
    const [payments, setPayments] = useState(null);
    const MAX_TITLE_LENGTH = 30;
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
    }, []);

    return (
        <>
            <h1>PAYMENTS</h1>
            {payments ? 
                <table>
                <thead>
                    <tr>
                        <th className={paymentStyles.longcell}>Title</th>
                        <th className={paymentStyles.longcell}>Created</th>
                        <th className={paymentStyles.longcell}>Due</th>
                        <th className={paymentStyles.shortcell}>Value</th>
                    </tr>
                </thead>
                <tbody className={entryTableStyles.tableBody}>
                    {payments.map(p => (
                        <PaymentEntry 
                            key={p.payment_id} 
                            title={p.title.length <= MAX_TITLE_LENGTH ? p.title : (p.title.substring(0, MAX_TITLE_LENGTH) + "...")} 
                            created_at={tzToMMDDYYY(p.created_at)} 
                            due_date={tzToMMDDYYY(p.due_date)} 
                            payment_value={p.payment_value}
                        />
                    ))}
                </tbody>
            </table> : <p>Fetching Payments...</p>
            }

        </>
    );
}
export default Payments;