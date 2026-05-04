import dbComponentsStyles from '../../css/dbcomponents.module.css';
import { useState } from 'react';
function DbForm(){
    const [toggled, setToggle] = useState(false);
     
    const toggleForm = () => {
        setToggle(!toggled);
    }
    
    const printForm = (event) => {
        event.preventDefault();
        alert(event);
    }

    return(<>
        <button onClick={toggleForm}>Add Payment</button>
        {!toggled ? null : 
        <form className={dbComponentsStyles.dbForm} onSubmit={printForm}>
            <label>
                Title *
                <input type="text" id="ptitle" name="title" placeholder="Invoice" required/>
            </label>
            <label>
                Value *
                <input type="number" id="pvalue" name="payment_value" placeholder="20.00" min="1" required/>
            </label>
            <label>
                Overdue Fee
                <input type="number" id="poverduepenalty" name="overdue_penalty" min="1" placeholder="0.00" />
            </label>
            <label>
                Due *
                <input type="datetime-local" id="pduedate" name="due_date" required/>
            </label>
            <button type="submit">Submit</button>
        </form>
        }
        
    </>);
}
export default DbForm;