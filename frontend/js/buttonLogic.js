/**
 * TODO: For the search button logic, you could return the div that's created in it,
 * this way you can hook the "openModal" function on main.
 */

import { userManager } from "./cognitoManager.js";
import * as paymentManager from "./paymentManager.js";

export async function setButtonsDisplay() {
    
    const user = await userManager.getUser();
    
    const signOut = document.getElementById("signOut");
    const signIn = document.getElementById("signIn");

    signOut.style.display = (user && !user.expired) ? "inline" : "none";
    signIn.style.display = (user && !user.expired) ? "none" : "inline";
    
    if(!user || user.expired) return;

    try {
        const response = await fetch('https://j5z43ef3j0.execute-api.us-east-2.amazonaws.com/admins',{
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.id_token}`
            }
        });
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);

        const data = await response.json();
        //console.log(data);
        
        if(!data.isAdmin) return;
        
        const addDropdownButton = document.getElementById('addDropdownButton');
        const removeDropdownButton = document.getElementById('removeDropdownButton');
        const searchDropdownButton = document.getElementById('searchDropdownButton');
        const openCreatePayment = document.getElementById('openCreatePayment');

        addDropdownButton.style.display = "inline";
        removeDropdownButton.style.display = "inline";
        searchDropdownButton.style.display = "inline";
        openCreatePayment.style.display = "inline";
        
    } catch (error) {
        console.error(error);
    }
}

export async function signInLogic(){
    await userManager.signinRedirect({
        extraQueryParams: {
            identity_provider: "Google",
            prompt: "select_account" // always show account picker
        }
    });
}

export async function signOutLogic(){
    const user = await userManager.getUser();
    if (user) {
        console.log("Logging out user:", user);
        sessionStorage.removeItem("access-token-stored");
        await userManager.removeUser(); // remove from storage
    } else {
        console.warn("No user found in session.");
    }
    window.location.reload();
}

export function cancelEditLogic(){
    document.getElementById('modalOverlay').style.display = 'none';
}

export async function saveButtonLogic(selectedMember){
    try {
        const user = await userManager.getUser();
        if (!user || user.expired) {
            alert("You must be signed in to save changes.");
            return;
        }
        
        const newFirstName = document.getElementById('editFirstName').value;
        const newLastName = document.getElementById('editLastName').value;
        const newZekkenText = document.getElementById('editZekken').value;
        const newRankType = document.getElementById('editRankType').value;
        const newRankNumber = parseInt(document.getElementById('editRankNumber').value, 10);
        const newEmail = document.getElementById('editEmail').value;
        const newBirthday = document.getElementById('editBirthday').value;
        const newStatus = document.getElementById('editStatus').value;

        const response = await fetch('https://j5z43ef3j0.execute-api.us-east-2.amazonaws.com/items', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.id_token}`
            },
            body: JSON.stringify({
                rank_number: newRankNumber,
                rank_type: newRankType,
                last_name: newLastName,
                member_id: selectedMember['member_id'],
                first_name: newFirstName,
                zekken_text: newZekkenText,
                email: newEmail,
                birthday: newBirthday || null,
                status: newStatus
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        document.getElementById('shelf').innerHTML = '';        
        const data = await response.json();
        console.log("✅ Member updated:", data);
    } catch (error) {
        console.error("❌ Failed to save:", error);
        alert("Something went wrong. Please try again.");
    }
}

export async function removeButtonLogic(selectedMember){
    try {
        const user = await userManager.getUser();
        if (!user || user.expired) {
            alert("You must be signed in to remove a member.");
            return;
        }

        const response = await fetch('https://j5z43ef3j0.execute-api.us-east-2.amazonaws.com/items', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.id_token}`
            },
            body: JSON.stringify({
                member_id: selectedMember['member_id']
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        document.getElementById('shelf').innerHTML = '';

    } catch (error) {
        console.error("❌ Failed to delete member:", error);
        alert("Failed to delete member. Please try again.");
    }
}

export async function addFormSubmitLogic(event){

    event.preventDefault();
    const addForm = event.target;

    try {
        const user = await userManager.getUser();
        if (!user || user.expired) {
            alert("You must be signed in to add a member.");
            return;
        }

        const newFirstName = document.getElementById('addFirstName').value;
        const newLastName = document.getElementById('addLastName').value;
        const newZekkenText = document.getElementById('addZekken').value;
        const newRankType = document.getElementById('addRankType').value;
        const newRankNumber = parseInt(document.getElementById('addRankNumber').value, 10);
        const newEmail = document.getElementById('addEmail').value;
        const newBirthday = document.getElementById('addBirthday').value;
        
        const isGuest = document.getElementById('isGuest').checked ? 'yes':'no';

        const response = await fetch('https://j5z43ef3j0.execute-api.us-east-2.amazonaws.com/items', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.id_token}`
            },
            body: JSON.stringify({
                rank_number: newRankNumber,
                rank_type: newRankType,
                last_name: newLastName,
                member_id: null, // backend will generate this
                first_name: newFirstName,
                zekken_text: newZekkenText,
                email: newEmail,
                birthday: newBirthday || null,
                is_guest: isGuest
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ Member added:", data);

        document.getElementById('shelf').innerHTML = '';

        addForm.style.display = 'none';
        addForm.reset();

    } catch (err) {
        console.error("❌ Error adding member:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
        alert("Failed to add member. Please check the form and try again.");
    }
}

export async function createPaymentSubmit(event){
    event.preventDefault();
    const createForm = event.target;

    const currDate = new Date();

    const year = currDate.getFullYear();
    const month = String(currDate.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(currDate.getDate()).padStart(2, '0');


    const createdAt = `${year}-${month}-${day}`;
    const paymentValue = document.getElementById('paymentValue').value;
    // const dueDate = document.getElementById('dueDate').value;
    const dueDate = document.getElementById('dueDate').value;
    const overduePenalty = document.getElementById('overduePenalty').value;
    const eventId = document.getElementById('eventId').value;

    await paymentManager.createPayment(createdAt,paymentValue,dueDate,overduePenalty,eventId);

    createForm.style.display = 'none';
    createForm.reset();
}

export function dropdownButtonLogic(dropdownElementId){
    const dropdownElement = document.getElementById(dropdownElementId);
    dropdownElement.style.display = (dropdownElement.style.display == 'flex') ? 'none' : 'flex';
}

export function openFormLogic(formId){

    document.getElementById(formId).style.display = 'flex';

    const removeMemberPanel = document.getElementById('remove-member'); // target
    if (removeMemberPanel && removeMemberPanel.style.display === 'flex') removeMemberPanel.style.display = 'none';
    
    const addMemberPanel = document.getElementById('add-member');
    if (addMemberPanel && addMemberPanel.style.display === 'flex') addMemberPanel.style.display = 'none';
    
    const searchMemberPanel = document.getElementById('search-member');
    if (searchMemberPanel && searchMemberPanel.style.display === 'flex') searchMemberPanel.style.display = 'none';

}

export function findMatchingMembers(members, firstNameId, lastNameId){

    const firstName = document.getElementById(firstNameId).value.trim();
    const lastName = document.getElementById(lastNameId).value.trim();

    if (!firstName || !lastName) {
        alert("Please enter both first name and last name.");
        return;
    }
    
    // Search for matching members
    const matchingMembers = members.filter(member => 
        member.first_name.toLowerCase().includes(firstName.toLowerCase()) && 
        member.last_name.toLowerCase().includes(lastName.toLowerCase())
    );
    
    if (matchingMembers.length === 0) {
        alert(`No members found matching "${firstName} ${lastName}".`);
        return;
    }

    return matchingMembers;
}

export function cancelDropdownLogic(formId, resultId){
    const form = document.getElementById(formId);
    form.style.display = 'none';
    form.reset();
    
    if(resultId)
        document.getElementById(resultId).style.display = 'none';
}

export async function csvAddLogic(event){
    try {
        console.log("CSV ADD");
        const user = await userManager.getUser();
        if (!user || user.expired) {
            alert("You must be signed in to add a member.");
            return;
        }
        const file = event.target.files[0];
        const COLS_NUM = 7;
        let newFirstName = ''; // idx = 0
        let newLastName = ''; // idx = 1
        let newZekkenText = ''; // idx = 2
        let newRankType = ''; // idx = 3
        let newRankNumber = null; // idx = 4
        let newEmail = ''; // idx = 5
        let isGuest = ''; // idx = 6

        if (file) {
            // Example: Read the CSV file as text
            const reader = new FileReader();

            reader.onload = async function(e) {
                const csvText = e.target.result;
                // Split into rows
                const rows = csvText.trim().split('\n');
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const cols = row.split(',');

                    if (cols.length < COLS_NUM) {
                        alert(`Error: Row ${i + 1} is missing fields. Each row must have ${COLS_NUM} columns.`);
                        throw new Error(`CSV row ${i + 1} is missing fields`);
                    }
                    
                    for (let j = 0; j < cols.length; j++) {
                        const col = cols[j].trim();
                        const idx = j;

                        console.log(`Row: ${i} | Col ${idx}: ${col}`);
                        
                        switch(idx){
                            case 0:
                                newFirstName = col;
                                break;
                            case 1:
                                newLastName = col;
                                break;
                            case 2:
                                newZekkenText = col;
                                break;
                            case 3:
                                newRankType = col;
                                if (newRankType !== 'shihan' && newRankType !== 'dan' && newRankType !== 'kyu') {
                                    alert(`Error: Invalid rank type "${newRankType}" in row ${i + 1}. Must be "shihan", "dan", or "kyu".`);
                                    throw new Error(`Invalid rank type "${newRankType}" in row ${i + 1}`);
                                }
                                break;
                            case 4:
                                newRankNumber = parseInt(col.trim(), 10);

                                if (isNaN(newRankNumber) || newRankNumber < 0 || (newRankType === 'dan' && (newRankNumber <= 0 || newRankNumber > 8)) 
                                    || (newRankType === 'kyu' && (newRankNumber < 0 || newRankNumber > 6))) {
                                    alert(`Error: Invalid rank number "${newRankNumber}" in row ${i + 1}`);
                                    throw new Error(`Invalid rank number "${newRankNumber}" in row ${i + 1}`);
                                }
                                break;
                            case 5:
                                newEmail = col;
                                break;
                            case 6:
                                isGuest = col;
                                break;
                        }
                    }

                    const response = await fetch('https://j5z43ef3j0.execute-api.us-east-2.amazonaws.com/items', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${user.id_token}`
                        },
                        body: JSON.stringify({
                            rank_number: newRankNumber,
                            rank_type: newRankType,
                            last_name: newLastName,
                            member_id: null, // backend will generate this
                            first_name: newFirstName,
                            zekken_text: newZekkenText,
                            email: newEmail,
                            is_guest: isGuest
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`Server returned ${response.status}`);
                    }
                
                }
                window.location.reload();
            };
            
            reader.readAsText(file);
        } 
    } catch (err) {
        console.error("❌ Error adding group:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
        alert("Failed to add group. Please resubmit .csv file and try again.");
    }
}