import { rdsRead } from "../js/shared/rdsTools";
import { useEffect, useState } from "react";
import { tzToMMDDYYY } from "../js/shared/dateTools";

import PaymentEntry from "../react_components/PaymentEntry";
import DbForm from "../react_components/DbForm";

import paymentStyles from '../../css/paymentpage.module.css';
import dbComponentsStyles from '../../css/dbcomponents.module.css';

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
    const MAX_TITLE_LENGTH = 60;
    /**
     * No dependency array: the effect runs after every render 
     * Dependency array is empty ([]), it runs once on mount; 
     * Dependency array is provided, it runs only when those values change.
     */
    // useEffect(() => {
    //     async function startFetching(){ // TODO: handle errors
    //         const response = await rdsRead('GET', 'payments');
    //         const data = response ? response.data : null;
    //         setPayments(data);
    //     }
        
    //     startFetching();
    // }, []);
    useEffect(()=>{
        function simulateFetch(){
            setPayments(dummy);
        }
        simulateFetch();
    },[]);
    return (
        <div className={paymentStyles.page}>
            <div className={paymentStyles.header}>
                <header>
                    <h2 className={paymentStyles.title}>Payments</h2>
                    <span className={paymentStyles.count}>{payments ? payments.length : 0} payments</span>
                </header>
            </div>
            <DbForm className={paymentStyles.list}/>
            {payments ? 
                <div className={dbComponentsStyles.tableBody}>
                    {payments.map(p => (
                        <PaymentEntry 
                            key={p.payment_id} 
                            title={p.title.length <= MAX_TITLE_LENGTH ? p.title : (p.title.substring(0, MAX_TITLE_LENGTH) + "...")} 
                            created_at={tzToMMDDYYY(p.created_at)} 
                            due_date={tzToMMDDYYY(p.due_date)} 
                            payment_value={p.payment_value}
                        />
                    ))}
                </div>
            : <p>Fetching Payments...</p>
            }

        </div>
    );
}
export default Payments;