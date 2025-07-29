import { userManager} from "./cognitoManager.js";

function rankToNum(num, type) {
    if(type === "shihan") return 10;
    if(type === "dan") return num;
    if(num === 0) return -10;
    return -1 * num;
}

function compareRank(a, b) {
    const aNum = rankToNum(a['rank_number'], a['rank_type']);
    const bNum = rankToNum(b['rank_number'], b['rank_type']);
    if(aNum > bNum) return -1; // higher rank, comes first
    if(aNum === bNum) return 0; // equal rank
    return 1; // lower rank, comes second
}

function formatName(first, last) {
    const firstInitial = first?.[0]?.toUpperCase() || '';
    const lastName = (last || '').toUpperCase();
    return `${firstInitial}.${lastName}`;
}

function formatRank(num, type) {
    if(type === 'shihan') return 'DOJO SHIHAN';
    return `${num} ${type.toUpperCase()}`;
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

function rankToKanji(num, type) {
    if(type === 'shihan') return '師範';
    
    // testing
    var nums;
    if(type === 'dan') nums = ['無','初','二','三','四','五','六','七','八'];
    else nums = ['無','一','二','三','四','五','六','七','八'];
    const types = {'kyu':'級','dan':'段'};

    return `${nums[num]}${types[type]}`;
}

let members = null;

async function renderTable() {
    try {
        const response = await fetch('https://usk4xisdph.execute-api.us-east-2.amazonaws.com/members');
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

let selectedMember = null;

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

        const response = await fetch('https://usk4xisdph.execute-api.us-east-2.amazonaws.com/members', {
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

        console.log("✅ Save and render complete.");

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

        const response = await fetch('https://usk4xisdph.execute-api.us-east-2.amazonaws.com/members', {
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

        console.log("✅ Member deleted:", data);

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

        const response = await fetch('https://usk4xisdph.execute-api.us-east-2.amazonaws.com/members', {
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
