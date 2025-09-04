import { userManager } from "./cognitoManager.js";
import { signInLogic, signOutLogic } from "./buttonLogic.js";
import { rankToNum, compareRank, formatName, formatRank, rankToKanji } from "./nafudaTools.js";

let selectedMember = null;
let members = null;
let renderedSlips = [];

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

        renderedSlips = slips;
        layoutShelf();

    } catch (error) {
        console.error(error);
    }
}

function createEmptySlip() {
    const nafuda = document.createElement('div');
    nafuda.className = 'nafuda';

    const slip = document.createElement('div');
    slip.className = 'slip';

    const front = document.createElement('div');
    front.className = 'front';

    slip.appendChild(front);
    nafuda.appendChild(slip);

    return nafuda;
}

async function generateSlip(frontText, backText, memberId) {
    const user = await userManager.getUser();

    frontText = frontText.replace(/\./g, '·').replace(/ /g, '\u00A0').replace(/ー/g, '|');
    backText = backText.replace(/\./g, '·').replace(/ /g, '\u00A0').replace(/ー/g, '|');

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
    
    let isAdmin;
    if(user){
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
            isAdmin = data.isAdmin;
            
        } catch (error) {
            console.error(error);
        }
    }

    if(memberId >= 0 && isAdmin) {
        nafuda.addEventListener('click', () => {
            openModal(memberId);
        });
        nafuda.style.cursor = 'pointer';
    }

    return nafuda;
}

function displayRemoveResults(matchingMembers) {
    const resultsDiv = document.getElementById('removeResults');
    const resultsList = document.getElementById('removeResultsList');
    
    resultsList.innerHTML = '';
    
    matchingMembers.forEach(member => {
        const memberDiv = document.createElement('div');
        memberDiv.style.cssText = `
            border: 1px solid #ccc;
            padding: 10px;
            margin: 5px 0;
            border-radius: 5px;
            background-color: #f9f9f9;
        `;
        
        const memberInfo = document.createElement('div');
        memberInfo.innerHTML = `
            <strong>${member.first_name} ${member.last_name}</strong><br>
            Rank: ${formatRank(member.rank_number, member.rank_type)}<br>
            Email: ${member.email || 'N/A'}<br>
            Zekken: ${member.zekken_text || 'N/A'}
        `;
        
        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove This Member';
        removeButton.style.cssText = `
            background-color: #dc3545;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
            margin-top: 5px;
        `;
        
        removeButton.addEventListener('click', async () => {
            await removeMember(member.member_id);
        });
        
        memberDiv.appendChild(memberInfo);
        memberDiv.appendChild(removeButton);
        resultsList.appendChild(memberDiv);
    });
    
    resultsDiv.style.display = 'block';
}

function displaySearchResults(matchingMembers) {
    const resultsDiv = document.getElementById('searchResults');
    const resultsList = document.getElementById('searchResultsList');
    
    resultsList.innerHTML = '';
    
    matchingMembers.forEach(member => {
        const memberDiv = document.createElement('div');
        memberDiv.style.cssText = `
            border: 1px solid #ccc;
            padding: 10px;
            margin: 5px 0;
            border-radius: 5px;
            background-color: #f9f9f9;
            cursor: pointer;
        `;
        
        const memberInfo = document.createElement('div');
        memberInfo.innerHTML = `
            <strong>${member.first_name} ${member.last_name}</strong><br>
            Rank: ${formatRank(member.rank_number, member.rank_type)}<br>
            Email: ${member.email || 'N/A'}<br>
            Zekken: ${member.zekken_text || 'N/A'}
        `;
        
        memberDiv.appendChild(memberInfo);
        
        // Add click handler to open edit form
        memberDiv.addEventListener('click', () => {
            openModal(member.member_id);
            // Close the search form
            document.getElementById('searchForm').style.display = 'none';
            document.getElementById('searchResults').style.display = 'none';
            document.getElementById('searchForm').reset();
        });
        
        resultsList.appendChild(memberDiv);
    });
    
    resultsDiv.style.display = 'block';
}

async function removeMember(memberId) {
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
                member_id: memberId
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        // Close the form and refresh the table
        document.getElementById('removeForm').style.display = 'none';
        document.getElementById('removeResults').style.display = 'none';
        document.getElementById('removeForm').reset();
        
        document.getElementById('shelf').innerHTML = '';
        await renderTable();

        console.log('Member removed successfully');

    } catch (error) {
        console.error("❌ Failed to remove member:", error);
    }
}

function layoutShelf() {
    try {
        if (!renderedSlips || renderedSlips.length === 0) return;

        const slipWidth = 70;
        const shelf = document.getElementById('shelf');
        if (!shelf) return;

        const shelfWidth = shelf.clientWidth;
        
        // check if mobile
        const isMobile = shelfWidth <= 600;
        
        if (isMobile) {
            // mobile
            shelf.innerHTML = '';
            const rowDiv = document.createElement('div');
            rowDiv.classList.add('slip-row');
            renderedSlips.forEach(slip => rowDiv.appendChild(slip));
            shelf.appendChild(rowDiv);
        } else {
            // desktop
            const slipsPerRow = Math.max(2, Math.floor(shelfWidth / slipWidth));

            let row = [];
            const rows = [];

            for (let i = 0; i < renderedSlips.length; i++) {
                const slip = renderedSlips[i];
                if (slip.firstChild.classList.contains('rank') && row.length === slipsPerRow - 1) {
                    row.unshift(createEmptySlip());
                    i--;
                } else {
                    row.unshift(slip);
                }

                if (row.length === slipsPerRow) {
                    rows.push(row);
                    row = [];
                }
            }

            if (row.length > 0) {
                while (row.length < slipsPerRow) {
                    row.unshift(createEmptySlip());
                }
                rows.push(row);
            }

            shelf.innerHTML = '';
            for (const r of rows) {
                const rowDiv = document.createElement('div');
                rowDiv.classList.add('slip-row');
                r.forEach(slip => rowDiv.appendChild(slip));
                shelf.appendChild(rowDiv);
            }
        }
    } catch (e) {
        console.error('Failed to layout shelf:', e);
    }
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
    document.getElementById('editEmail').value = selectedMember.email || '';
    document.getElementById('editStatus').value = selectedMember.status || '';
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

async function setButtonsDisplay() {
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

        addDropdownButton.style.display = "inline";
        removeDropdownButton.style.display = "inline";
        searchDropdownButton.style.display = "inline";
        
    } catch (error) {
        console.error(error);
    }
}

document.addEventListener('click', function(event){
    /**
     * Check if user has clicked away from the add member dropdown. If they did, then close it if it's open.
     */
    const addDropdownButton = document.getElementById('addDropdownButton');
    const addMember = document.getElementById('add-member');
    const csvInput = document.getElementById('groupCsvInput');
    if(
        event.target !== addMember && !addMember.contains(event.target) &&
        event.target !== addDropdownButton && !addDropdownButton.contains(event.target) &&
        event.target !==  csvInput && !csvInput.contains(event.target)
    ){
        if(addMember.style.display == 'flex') addMember.style.display = 'none';
    }

    /**
     * Check if user has clicked away from the add form. If they did, then close it if it's open.
     * Do not close when clicking the ADD MEMBER button or within the add-member container.
     */
    const addForm = document.getElementById('addForm');
    const openAddButton = document.getElementById('openAddButton');
    const addMemberContainer = document.getElementById('add-member');
    if(
        event.target !== addForm && !addForm.contains(event.target) &&
        event.target !== openAddButton && !addMemberContainer.contains(event.target)
    ){
        if(addForm.style.display == 'flex') {
            addForm.style.display = 'none';
            addForm.reset();
        }
    }
    
    /**
     * Check if user has clicked away from the remove member dropdown. If they did, then close it if it's open.
     */
    const removeDropdownButton = document.getElementById('removeDropdownButton');
    const removeMember = document.getElementById('remove-member');
    if(
        event.target !== removeMember && !removeMember.contains(event.target) &&
        event.target !== removeDropdownButton && !removeDropdownButton.contains(event.target)
    ){
        if(removeMember.style.display == 'flex') removeMember.style.display = 'none';
    }
    
    /**
     * Check if user has clicked away from the search member dropdown. If they did, then close it if it's open.
     */
    const searchDropdownButton = document.getElementById('searchDropdownButton');
    const searchMember = document.getElementById('search-member');
    if(
        event.target !== searchMember && !searchMember.contains(event.target) &&
        event.target !== searchDropdownButton && !searchDropdownButton.contains(event.target)
    ){
        if(searchMember.style.display == 'flex') searchMember.style.display = 'none';
    }
    
    /**
     * Check if user has clicked away from the remove form. If they did, then close it if it's open.
     * Do not close when clicking the REMOVE MEMBER button or within the remove-member container.
     */
    const removeForm = document.getElementById('removeForm');
    const openRemoveButton = document.getElementById('openRemoveButton');
    const removeMemberContainer = document.getElementById('remove-member');
    if(
        event.target !== removeForm && !removeForm.contains(event.target) &&
        event.target !== openRemoveButton && !removeMemberContainer.contains(event.target)
    ){
        if(removeForm.style.display == 'flex') {
            removeForm.style.display = 'none';
            document.getElementById('removeResults').style.display = 'none';
            removeForm.reset();
        }
    }
    
    /**
     * Check if user has clicked away from the search form. If they did, then close it if it's open.
     * Do not close when clicking the SEARCH MEMBER button or within the search-member container.
     */
    const searchForm = document.getElementById('searchForm');
    const openSearchButton = document.getElementById('openSearchButton');
    const searchMemberContainer = document.getElementById('search-member');
    if(
        event.target !== searchForm && !searchForm.contains(event.target) &&
        event.target !== openSearchButton && !searchMemberContainer.contains(event.target)
    ){
        if(searchForm.style.display == 'flex') {
            searchForm.style.display = 'none';
            document.getElementById('searchResults').style.display = 'none';
            searchForm.reset();
        }
    }
});

window.addEventListener('DOMContentLoaded', async () => {
    try {
        await renderTable();  // ✅ Properly waits for table to render
        
        console.log("✅ Table rendered successfully on load.");
    } catch (err) {
        console.error("❌ Failed to render table on load:", err);
    }

    // adjust layout on window resize without refetching data
    let resizeTimeoutId = null;
    window.addEventListener('resize', () => {
        if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
        resizeTimeoutId = setTimeout(() => {
            layoutShelf();
        }, 150);
    });

    await setButtonsDisplay();
    
    document.getElementById("signIn").addEventListener("click", signInLogic);

    document.getElementById("signOut").addEventListener("click", signOutLogic);

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
            const newEmail = document.getElementById('editEmail').value;
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
                    status: newStatus
                })
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

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
            await renderTable();  // ✅ Wait for re-render
            closeModal();         // ✅ Only close after table updated

        } catch (error) {
            console.error("❌ Failed to delete member:", error);
            alert("Failed to delete member. Please try again.");
        }
    });

    document.getElementById('addDropdownButton').addEventListener('click', ()=>{
        let addMember = document.getElementById('add-member');
        addMember.style.display = (addMember.style.display == 'flex') ? 'none' : 'flex';
    });
    
    document.getElementById('removeDropdownButton').addEventListener('click', ()=>{
        let removeMember = document.getElementById('remove-member');
        removeMember.style.display = (removeMember.style.display == 'flex') ? 'none' : 'flex';
    });
    
    document.getElementById('searchDropdownButton').addEventListener('click', ()=>{
        let searchMember = document.getElementById('search-member');
        searchMember.style.display = (searchMember.style.display == 'flex') ? 'none' : 'flex';
    });
    
    document.getElementById('openAddButton').addEventListener('click', ()=> {
        document.getElementById('addForm').style.display = 'flex';
        const addMemberPanel = document.getElementById('add-member');
        if (addMemberPanel && addMemberPanel.style.display === 'flex') addMemberPanel.style.display = 'none';
        const removeMemberPanel = document.getElementById('remove-member');
        if (removeMemberPanel && removeMemberPanel.style.display === 'flex') removeMemberPanel.style.display = 'none';
        const searchMemberPanel = document.getElementById('search-member');
        if (searchMemberPanel && searchMemberPanel.style.display === 'flex') searchMemberPanel.style.display = 'none';
    });

    document.getElementById('openRemoveButton').addEventListener('click', ()=> {
        document.getElementById('removeForm').style.display = 'flex';
        const removeMemberPanel = document.getElementById('remove-member');
        if (removeMemberPanel && removeMemberPanel.style.display === 'flex') removeMemberPanel.style.display = 'none';
        const addMemberPanel = document.getElementById('add-member');
        if (addMemberPanel && addMemberPanel.style.display === 'flex') addMemberPanel.style.display = 'none';
        const searchMemberPanel = document.getElementById('search-member');
        if (searchMemberPanel && searchMemberPanel.style.display === 'flex') searchMemberPanel.style.display = 'none';
    });
    
    document.getElementById('openSearchButton').addEventListener('click', ()=> {
        document.getElementById('searchForm').style.display = 'flex';
        const searchMemberPanel = document.getElementById('search-member');
        if (searchMemberPanel && searchMemberPanel.style.display === 'flex') searchMemberPanel.style.display = 'none';
        const addMemberPanel = document.getElementById('add-member');
        if (addMemberPanel && addMemberPanel.style.display === 'flex') addMemberPanel.style.display = 'none';
        const removeMemberPanel = document.getElementById('remove-member');
        if (removeMemberPanel && removeMemberPanel.style.display === 'flex') removeMemberPanel.style.display = 'none';
    });

    document.getElementById('cancelAddButton').addEventListener('click', ()=> {
        document.getElementById('addForm').style.display = 'none';
    });

    document.getElementById('cancelRemoveButton').addEventListener('click', ()=> {
        document.getElementById('removeForm').style.display = 'none';
        document.getElementById('removeResults').style.display = 'none';
        document.getElementById('removeForm').reset();
    });
    
    document.getElementById('cancelSearchButton').addEventListener('click', ()=> {
        document.getElementById('searchForm').style.display = 'none';
        document.getElementById('searchResults').style.display = 'none';
        document.getElementById('searchForm').reset();
    });

    document.getElementById('searchRemoveButton').addEventListener('click', async ()=> {
        const firstName = document.getElementById('removeFirstName').value.trim();
        const lastName = document.getElementById('removeLastName').value.trim();
        
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
        
        // Display results
        displayRemoveResults(matchingMembers);
    });
    
    document.getElementById('searchMemberButton').addEventListener('click', async ()=> {
        const firstName = document.getElementById('searchFirstName').value.trim();
        const lastName = document.getElementById('searchLastName').value.trim();
        
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
        
        // Display results
        displaySearchResults(matchingMembers);
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
            const newEmail = document.getElementById('addEmail').value;
            
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
                    is_guest: isGuest
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
                alert("You must be signed in to remove a member.");
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
    
    let resizeReflowTimeout = null;
    window.addEventListener('resize', () => {
        if (resizeReflowTimeout) clearTimeout(resizeReflowTimeout);
        resizeReflowTimeout = setTimeout(async () => {
            try {
                const shelf = document.getElementById('shelf');
                if (shelf) shelf.innerHTML = '';
                await renderTable();
            } catch (err) {
                console.error('Failed to re-render on resize', err);
            }
        }, 150);
    });
});