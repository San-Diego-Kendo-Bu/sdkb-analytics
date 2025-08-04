import { userManager} from "./cognitoManager.js";
import { rankToNum, compareRank, formatName, formatRank, rankToKanji } from "./nafudaTools.js";

let selectedMember = null;
let members = null;

async function renderTable() {
    try {
        const response = await fetch('https://j5z43ef3j0.execute-api.us-east-2.amazonaws.com/items');
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);

        const data = await response.json();
        members = data.items;
        members.sort(compareRank);

        const slips = [];
        let curRank = null;

        for (const member of members) {
            const memberId = member['member_id'];
            const rankNum = member['rank_number'];
            const rankType = member['rank_type'];
            const firstName = member['first_name'];
            const lastName = member['last_name'];
            const zekkenText = member['zekken_text'];

            if (curRank == null || curRank !== rankToNum(rankNum, rankType)) {
                const rankSlip = await generateSlip(rankToKanji(rankNum, rankType), formatRank(rankNum, rankType), -1);
                slips.push(rankSlip);
                curRank = rankToNum(rankNum, rankType);
            }

            const memberSlip = await generateSlip(zekkenText, formatName(firstName, lastName), memberId);
            slips.push(memberSlip);
        }

        const shelf = document.getElementById('shelf');
        slips.reverse();
        slips.forEach(slip => shelf.appendChild(slip));

    } catch (error) {
        console.error(error);
    }
}

async function generateSlip(frontText, backText, memberId) {

    frontText = frontText.replace(/\./g, '·').replace(/ /g, '\u00A0').replace(/一/g, '|');
    backText = backText.replace(/\./g, '·').replace(/ /g, '\u00A0').replace(/一/g, '|');
    const user = await userManager.getUser();

    const nafuda = document.createElement('div');
    nafuda.className = 'nafuda';

    const slip = document.createElement('div');
    if(memberId < 0) slip.className = 'slip rank';
    else slip.className = 'slip';

    const front = document.createElement('div');
    front.className = 'front';

    var kanjiSize;
    if(frontText.length <= 4) kanjiSize = 'kanjiLarge';
    else if(frontText.length <= 12) kanjiSize = 'kanjiMed';
    else kanjiSize = 'kanjiSmall';

    for (const char of frontText) {
        const span = document.createElement('span');
        span.className = kanjiSize;
        span.textContent = char;
        front.appendChild(span);
    }

    const back = document.createElement('div');
    back.className = 'back';

    for (const char of backText) {
        const span = document.createElement('span');
        span.className = 'character';
        span.textContent = char;
        back.appendChild(span);
    }

    slip.appendChild(front);
    slip.appendChild(back);
    nafuda.appendChild(slip);

    nafuda.addEventListener('mouseenter', () => {
        slip.classList.add('flipped');
    });

    nafuda.addEventListener('mouseleave', () => {
        setTimeout(() => slip.classList.remove('flipped'), 150);
    });
    if(memberId >= 0 && user != null) {
        nafuda.addEventListener('click', () => {
            openModal(memberId);
        });
        nafuda.style.cursor = 'pointer';
    }

    return nafuda;
}

function openModal(memberId) {
    for (let i = 0; i < members.length; i++) {
        if(members[i]['member_id'] === memberId) {
            selectedMember = members[i];
            break;
        }
    }

    document.getElementById('editFirstName').value = selectedMember.first_name || '';
    document.getElementById('editLastName').value = selectedMember.last_name || '';
    document.getElementById('editZekken').value = selectedMember.zekken_text || '';
    document.getElementById('editRankType').value = selectedMember.rank_type || 'dan';
    document.getElementById('editRankNumber').value = selectedMember.rank_number || 0;
    document.getElementById('modalOverlay').style.display = 'flex';

    let rankNumberInput = document.getElementById('editRankNumber');

    if (selectedMember['rank_type'] === 'shihan') {
        rankNumberInput.value = 0;
        rankNumberInput.placeholder = '';
        rankNumberInput.disabled = true;
    } else {
        rankNumberInput.disabled = false;
    }
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    selectedMember = null;
}

document.getElementById("signIn").addEventListener("click", async () => {
    await userManager.signinRedirect();
});

document.getElementById("signOut").addEventListener("click", async () => {
    const user = await userManager.getUser();
    if (user) {
        console.log("Logging out user:", user);
        sessionStorage.removeItem("access-token-stored");
        await userManager.removeUser(); // remove from storage
    } else {
        console.warn("No user found in session.");
    }

    // Force a page refresh to reflect the new state
    window.location.reload();
});

const user = await userManager.getUser();

document.getElementById('cancelButton').addEventListener('click', () => {
    closeModal();
});

/**
 * Save button fetches the values from the form and makes a PATCH request to the database with the updated
 * values. Then, after getting a response, it calls renderTable()
 **/
document.getElementById('saveButton').addEventListener('click', async () => {
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

        const response = await fetch('https://j5z43ef3j0.execute-api.us-east-2.amazonaws.com/items', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.access_token}`
            },
            body: JSON.stringify({
                rank_number: newRankNumber,
                rank_type: newRankType,
                last_name: newLastName,
                member_id: selectedMember['member_id'],
                first_name: newFirstName,
                zekken_text: newZekkenText
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        // Clear and re-render the shelf
        document.getElementById('shelf').innerHTML = '';
        await renderTable();  // ✅ WAIT for rendering to complete

        const data = await response.json();
        console.log("✅ Member added:", data);

    } catch (error) {
        console.error("❌ Failed to save or render table:", error);
        alert("Something went wrong. Please try again.");
    }
});

document.getElementById('removeButton').addEventListener('click', async () => {
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
                'Authorization': `Bearer ${user.access_token}`
            },
            body: JSON.stringify({
                member_id: selectedMember['member_id']
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        document.getElementById('shelf').innerHTML = '';
        await renderTable();  // ✅ Wait for re-render
        closeModal();         // ✅ Only close after table updated

    } catch (error) {
        console.error("❌ Failed to delete member:", error);
        alert("Failed to delete member. Please try again.");
    }
});

document.getElementById('openAddButton').addEventListener('click', ()=> {
    document.getElementById('addForm').style.display = 'flex';
});

document.getElementById('cancelAddButton').addEventListener('click', ()=> {
    document.getElementById('addForm').style.display = 'none';
});

document.getElementById('addForm').addEventListener('submit', async function(event) {
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

        const response = await fetch('https://j5z43ef3j0.execute-api.us-east-2.amazonaws.com/items', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.access_token}`
            },
            body: JSON.stringify({
                rank_number: newRankNumber,
                rank_type: newRankType,
                last_name: newLastName,
                member_id: null, // backend will generate this
                first_name: newFirstName,
                zekken_text: newZekkenText
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ Member added:", data);

        document.getElementById('shelf').innerHTML = '';
        await renderTable(); // ✅ Wait for table refresh

        addForm.style.display = 'none';
        addForm.reset();

    } catch (err) {
        console.error("❌ Error adding member:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
        alert("Failed to add member. Please check the form and try again.");
    }
});

document.getElementById('openAddGroupButton').addEventListener('click', () => {
    document.getElementById('groupCsvInput').click();
});

document.getElementById('groupCsvInput').addEventListener('change', async (event) => {
    try {
        const user = await userManager.getUser();
        if (!user || user.expired) {
            alert("You must be signed in to add a member.");
            return;
        }
        const file = event.target.files[0];
        let newFirstName = ''; // idx = 0
        let newLastName = ''; // idx = 1
        let newZekkenText = ''; // idx = 2
        let newRankType = ''; // idx = 3
        let newRankNumber = null; // idx = 4

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

                    if (cols.length < 5) {
                        alert(`Error: Row ${i + 1} is missing fields. Each row must have 5 columns.`);
                        throw new Error(`CSV row ${i + 1} is missing fields`);
                    }
                    
                    for (let j = 0; j < cols.length; j++) {
                        const col = cols[j].trim();
                        const idx = j;

                        console.log(`Row: ${i} | Col ${idx}: ${col}`);
                        if (idx == 0){
                            newFirstName = col;
                        } else if (idx == 1) {
                            newLastName = col;
                        } else if (idx == 2) {
                            newZekkenText = col;
                        } else if (idx == 3) {
                            newRankType = col;
                            if (newRankType !== 'shihan' && newRankType !== 'dan' && newRankType !== 'kyu') {
                                alert(`Error: Invalid rank type "${newRankType}" in row ${i + 1}. Must be "shihan", "dan", or "kyu".`);
                                throw new Error(`Invalid rank type "${newRankType}" in row ${i + 1}`);
                            }
                        } else if (idx == 4) {
                            newRankNumber = parseInt(col.trim(), 10);

                            if (isNaN(newRankNumber) || newRankNumber < 0 || (newRankType === 'dan' && (newRankNumber <= 0 || newRankNumber > 8)) 
                                || (newRankType === 'kyu' && (newRankNumber < 0 || newRankNumber > 6))) {
                                alert(`Error: Invalid rank number "${newRankNumber}" in row ${i + 1}`);
                                throw new Error(`Invalid rank number "${newRankNumber}" in row ${i + 1}`);
                            }
                        }
                    }

                    const response = await fetch('https://j5z43ef3j0.execute-api.us-east-2.amazonaws.com/items', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${user.access_token}`
                        },
                        body: JSON.stringify({
                            rank_number: newRankNumber,
                            rank_type: newRankType,
                            last_name: newLastName,
                            member_id: null, // backend will generate this
                            first_name: newFirstName,
                            zekken_text: newZekkenText
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
});

const rankTypeSelect = document.getElementById('editRankType');
const rankNumberInput = document.getElementById('editRankNumber');

rankTypeSelect.addEventListener('change', () => {
    if (rankTypeSelect.value === 'shihan') {
        rankNumberInput.value = 0;
        rankNumberInput.placeholder = '';
        rankNumberInput.disabled = true;
    } else {
        rankNumberInput.disabled = false;
    }
});

window.addEventListener('load', async () => {
    try {
        await renderTable();  // ✅ Properly waits for table to render
        console.log("✅ Table rendered successfully on load.");
    } catch (err) {
        console.error("❌ Failed to render table on load:", err);
    }
});
