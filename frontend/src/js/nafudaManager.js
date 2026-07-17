import { userManager } from "./cognitoManager.js";
import { rankToNum, compareRank, formatName, formatRank, rankToKanji } from "./nafudaTools.js";
import * as buttonLogic from "./buttonLogic.js";

const NAFUDA_ORDER_API = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com/nafudaorder';

let selectedMember = null;
let members = null;
let renderedSlips = [];
let nafudaOrder = {};
let dragSource = null;

async function loadNafudaOrder() {
    try {
        const res = await fetch(NAFUDA_ORDER_API);
        if (res.ok) {
            const data = await res.json();
            nafudaOrder = data.order ?? {};
        }
    } catch { nafudaOrder = {}; }
}

async function saveNafudaOrder(user) {
    try {
        await fetch(NAFUDA_ORDER_API, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` },
            body: JSON.stringify({ order: nafudaOrder }),
        });
    } catch (err) {
        console.error('Failed to save nafuda order:', err);
    }
}

async function renderTable() {
    try {
        const user = await userManager.getUser();

        await loadNafudaOrder();

        const [membersResponse, adminResponse] = await Promise.all([
            fetch('https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com/members'),
            user ? fetch('https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com/admins', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.id_token}`
                }
            }) : Promise.resolve(null)
        ]);

        if (!membersResponse.ok) throw new Error(`HTTP error ${membersResponse.status}`);

        const data = await membersResponse.json();
        members = data.items.filter(m => m.status !== 'inactive');
        members.sort(compareRank);

        let isAdmin = false;
        if (adminResponse && adminResponse.ok) {
            const adminData = await adminResponse.json();
            isAdmin = adminData.isAdmin;
        }

        // Group members by rank bracket, preserving compareRank sort order
        const rankGroups = new Map();
        const rankKeyOrder = [];
        for (const member of members) {
            const rankKey = `${member.rank_type}_${member.rank_number}`;
            if (!rankGroups.has(rankKey)) {
                rankGroups.set(rankKey, []);
                rankKeyOrder.push(rankKey);
            }
            rankGroups.get(rankKey).push(member);
        }

        // Apply saved drag order within each bracket
        for (const rankKey of rankKeyOrder) {
            const group = rankGroups.get(rankKey);
            const savedOrder = nafudaOrder[rankKey];
            if (savedOrder && savedOrder.length > 0) {
                const idToMember = new Map(group.map(m => [m.member_id, m]));
                const ordered = [];
                for (const id of savedOrder) {
                    if (idToMember.has(id)) { ordered.push(idToMember.get(id)); idToMember.delete(id); }
                }
                for (const m of idToMember.values()) ordered.push(m);
                rankGroups.set(rankKey, ordered);
            }
        }

        const slips = [];
        let curRank = null;

        for (const rankKey of rankKeyOrder) {
            for (const member of rankGroups.get(rankKey)) {
                const memberId = member['member_id'];
                const rankNum = member['rank_number'];
                const rankType = member['rank_type'];
                const firstName = member['first_name'];
                const lastName = member['last_name'];
                const zekkenText = member['zekken_text'];

                if (curRank == null || curRank !== rankToNum(rankNum, rankType)) {
                    slips.push(generateSlip(rankToKanji(rankNum, rankType), formatRank(rankNum, rankType), -1, isAdmin));
                    curRank = rankToNum(rankNum, rankType);
                }

                const memberSlip = generateSlip(formatName(firstName, lastName), zekkenText, memberId, isAdmin);

                if (isAdmin) {
                    memberSlip.setAttribute('draggable', 'true');

                    memberSlip.addEventListener('dragstart', (e) => {
                        dragSource = { memberId, rankKey };
                        e.dataTransfer.effectAllowed = 'move';
                        memberSlip.style.opacity = '0.4';
                    });

                    memberSlip.addEventListener('dragend', () => {
                        memberSlip.style.opacity = '';
                    });

                    memberSlip.addEventListener('dragover', (e) => {
                        if (dragSource && dragSource.rankKey === rankKey) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            memberSlip.style.outline = '2px solid #ffc107';
                        }
                    });

                    memberSlip.addEventListener('dragleave', () => {
                        memberSlip.style.outline = '';
                    });

                    memberSlip.addEventListener('drop', async (e) => {
                        e.preventDefault();
                        memberSlip.style.outline = '';
                        if (!dragSource || dragSource.rankKey !== rankKey || dragSource.memberId === memberId) return;

                        const currentOrder = rankGroups.get(rankKey).map(m => m.member_id);
                        const fromIdx = currentOrder.indexOf(dragSource.memberId);
                        const toIdx = currentOrder.indexOf(memberId);
                        if (fromIdx === -1 || toIdx === -1) return;

                        const newOrder = [...currentOrder];
                        newOrder.splice(fromIdx, 1);
                        newOrder.splice(toIdx, 0, dragSource.memberId);

                        nafudaOrder[rankKey] = newOrder;
                        dragSource = null;
                        await saveNafudaOrder(user);
                        await renderTable();
                    });
                }

                slips.push(memberSlip);
            }
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

function fitZekkenFront(frontEl) {
    if (!frontEl) return;

    frontEl.style.transform = '';
    const spans = frontEl.querySelectorAll('span');
    spans.forEach(s => {
        s.style.lineHeight = '';
        s.style.marginTop = '';
        s.style.marginBottom = '';
    });
    frontEl.offsetHeight;

    const available = frontEl.clientHeight;
    let content = frontEl.scrollHeight;
    if (content <= available) return;

    const lineHeights = [1.0, 0.95, 0.9, 0.85, 0.8, 0.75];
    for (const lh of lineHeights) {
        spans.forEach(s => { s.style.lineHeight = String(lh); });
        frontEl.offsetHeight;
        content = frontEl.scrollHeight;
        if (content <= available) return;
    }

    const scale = Math.max(0.6, Math.min(1, available / content));
    frontEl.style.transform = `translateZ(0.001px) scale(${scale})`;
}

function fitAllZekkenFronts() {
    const shelf = document.getElementById('shelf');
    if (!shelf) return;
    const fronts = shelf.querySelectorAll('.slip .front');
    fronts.forEach(fitZekkenFront);
}

function fitKanjiBack(backEl) {
    if (!backEl) return;
    const spans = backEl.querySelectorAll('span');
    if (!spans.length) return;

    spans.forEach(s => { s.style.fontSize = ''; });
    backEl.offsetHeight;

    const overflows = () =>
        backEl.scrollHeight > backEl.clientHeight ||
        backEl.scrollWidth > backEl.clientWidth;

    if (!overflows()) return;

    const baseSize = parseFloat(getComputedStyle(spans[0]).fontSize);
    const minSize = Math.max(8, baseSize * 0.4);
    let size = baseSize;

    while (size > minSize && overflows()) {
        size = Math.max(minSize, size - 2);
        spans.forEach(s => { s.style.fontSize = `${size}px`; });
        backEl.offsetHeight;
    }
}

function fitAllKanjiBacks() {
    const shelf = document.getElementById('shelf');
    if (!shelf) return;
    shelf.querySelectorAll('.slip .back').forEach(fitKanjiBack);
}

function generateSlip(frontText, backText, memberId, isAdmin) {
    frontText = frontText.replace(/\./g, '·').replace(/ /g, '\u00A0').replace(/ー/g, '|');
    backText = backText.replace(/\./g, '·').replace(/ /g, '\u00A0').replace(/ー/g, '|');

    const nafuda = document.createElement('div');
    nafuda.className = 'nafuda';

    const slip = document.createElement('div');
    if (memberId < 0) slip.className = 'slip rank';
    else slip.className = 'slip';

    const front = document.createElement('div');
    front.className = 'front';

    for (const char of frontText) {
        const span = document.createElement('span');
        span.className = 'kanjiMed';
        span.textContent = char;
        front.appendChild(span);
    }

    const back = document.createElement('div');
    back.className = 'back';

    var backKanjiSize;
    if (backText.length <= 4) backKanjiSize = 'kanjiLarge';
    else if (backText.length <= 12) backKanjiSize = 'kanjiMed';
    else backKanjiSize = 'kanjiSmall';

    for (const char of backText) {
        const span = document.createElement('span');
        span.className = backKanjiSize;
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

    if (memberId >= 0 && isAdmin) {
        nafuda.addEventListener('click', () => {
            openModal(memberId);
        });
        nafuda.style.cursor = 'pointer';
    }

    return nafuda;
}

function layoutShelf() {
    try {
        if (!renderedSlips || renderedSlips.length === 0) return;

        const slipWidth = 70;
        const shelf = document.getElementById('shelf');
        if (!shelf) return;

        const shelfWidth = shelf.clientWidth;
        const isMobile = shelfWidth <= 600;

        if (isMobile) {
            shelf.innerHTML = '';
            const rowDiv = document.createElement('div');
            rowDiv.classList.add('slip-row');
            renderedSlips.forEach(slip => rowDiv.appendChild(slip));
            shelf.appendChild(rowDiv);

            (window.requestAnimationFrame || setTimeout)(() => { fitAllZekkenFronts(); fitAllKanjiBacks(); }, 0);
        } else {
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

            (window.requestAnimationFrame || setTimeout)(() => { fitAllZekkenFronts(); fitAllKanjiBacks(); }, 0);
        }
    } catch (e) {
        console.error('Failed to layout shelf:', e);
    }
}

function openModal(memberId) {
    for (let i = 0; i < members.length; i++) {
        if (members[i]['member_id'] === memberId) {
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
    document.getElementById('editBirthday').value = selectedMember.birthday || '';
    document.getElementById('editStatus').value = selectedMember.status || '';
    document.getElementById('editIsStudent').checked = selectedMember.is_student === true;
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

function displayRemoveResults(matchingMembers) {
    const resultsDiv = document.getElementById('removeResults');
    const resultsList = document.getElementById('removeResultsList');

    resultsList.innerHTML = '';

    matchingMembers.forEach(member => {
        const memberDiv = document.createElement('div');
        memberDiv.style.cssText = `
            border: 1px solid var(--border);
            padding: 10px;
            margin: 5px 0;
            border-radius: 5px;
            background-color: var(--bg-tertiary);
            color: var(--text-primary);
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
            if (!confirm(`Remove ${member.first_name} ${member.last_name} from the system? This cannot be undone.`)) return;
            try {
                const user = await userManager.getUser();
                if (!user || user.expired) {
                    alert("You must be signed in to remove a member.");
                    return;
                }

                const response = await fetch('https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com/members', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${user.id_token}`
                    },
                    body: JSON.stringify({
                        member_id: member.member_id
                    })
                });

                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}`);
                }

                document.getElementById('removeForm').style.display = 'none';
                document.getElementById('removeResults').style.display = 'none';
                document.getElementById('removeForm').reset();

                document.getElementById('shelf').innerHTML = '';
                await renderTable();

                console.log('Member removed successfully');

            } catch (error) {
                console.error("❌ Failed to remove member:", error);
            }
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
            border: 1px solid var(--border);
            padding: 10px;
            margin: 5px 0;
            border-radius: 5px;
            background-color: var(--bg-tertiary);
            color: var(--text-primary);
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

        memberDiv.addEventListener('click', () => {
            openModal(member.member_id);
            document.getElementById('searchForm').style.display = 'none';
            document.getElementById('searchResults').style.display = 'none';
            document.getElementById('searchForm').reset();
        });

        resultsList.appendChild(memberDiv);
    });

    resultsDiv.style.display = 'block';
}

let listenersSetup = false;

function setupEventListeners() {
    if (listenersSetup) return;
    listenersSetup = true;
    
    // Click outside to close dropdowns and forms
    document.addEventListener('click', function (event) {
        const addDropdownButton = document.getElementById('addDropdownButton');
        const addMember = document.getElementById('add-member');
        const csvInput = document.getElementById('groupCsvInput');
        if (
            event.target !== addMember && !addMember.contains(event.target) &&
            event.target !== addDropdownButton && !addDropdownButton.contains(event.target) &&
            event.target !== csvInput && !csvInput.contains(event.target)
        ) {
            if (addMember.style.display == 'flex') addMember.style.display = 'none';
        }

        const addForm = document.getElementById('addForm');
        const openAddButton = document.getElementById('openAddButton');
        const addMemberContainer = document.getElementById('add-member');
        if (
            event.target !== addForm && !addForm.contains(event.target) &&
            event.target !== openAddButton && !addMemberContainer.contains(event.target)
        ) {
            if (addForm.style.display == 'flex') {
                addForm.style.display = 'none';
                addForm.reset();
            }
        }

        const removeDropdownButton = document.getElementById('removeDropdownButton');
        const removeMember = document.getElementById('remove-member');
        if (
            event.target !== removeMember && !removeMember.contains(event.target) &&
            event.target !== removeDropdownButton && !removeDropdownButton.contains(event.target)
        ) {
            if (removeMember.style.display == 'flex') removeMember.style.display = 'none';
        }

        const searchDropdownButton = document.getElementById('searchDropdownButton');
        const searchMember = document.getElementById('search-member');
        if (
            event.target !== searchMember && !searchMember.contains(event.target) &&
            event.target !== searchDropdownButton && !searchDropdownButton.contains(event.target)
        ) {
            if (searchMember.style.display == 'flex') searchMember.style.display = 'none';
        }

        const downloadDropdownButton = document.getElementById('downloadDropdownButton');
        const downloadMember = document.getElementById('download-member');
        if (
            downloadMember && 
            event.target !== downloadMember && !downloadMember.contains(event.target) &&
            event.target !== downloadDropdownButton && !downloadDropdownButton.contains(event.target)
        ) {
            if (downloadMember && downloadMember.style.display == 'flex') downloadMember.style.display = 'none';
        }

        const removeForm = document.getElementById('removeForm');
        const openRemoveButton = document.getElementById('openRemoveButton');
        const removeMemberContainer = document.getElementById('remove-member');
        if (
            event.target !== removeForm && !removeForm.contains(event.target) &&
            event.target !== openRemoveButton && !removeMemberContainer.contains(event.target)
        ) {
            if (removeForm.style.display == 'flex') {
                removeForm.style.display = 'none';
                document.getElementById('removeResults').style.display = 'none';
                removeForm.reset();
            }
        }

        const searchForm = document.getElementById('searchForm');
        const openSearchButton = document.getElementById('openSearchButton');
        const searchMemberContainer = document.getElementById('search-member');
        if (
            event.target !== searchForm && !searchForm.contains(event.target) &&
            event.target !== openSearchButton && !searchMemberContainer.contains(event.target)
        ) {
            if (searchForm.style.display == 'flex') {
                searchForm.style.display = 'none';
                document.getElementById('searchResults').style.display = 'none';
                searchForm.reset();
            }
        }
    });

    // Modal buttons
    document.getElementById('cancelButton').addEventListener('click', () => {
        closeModal();
    });

    document.getElementById('saveButton').addEventListener('click', async () => {
        try {
            await buttonLogic.saveButtonLogic(selectedMember);
            closeModal();
            await renderTable();
        } catch (error) {
            console.error("❌ Failed to save or render table:", error);
            alert("Something went wrong. Please try again.");
        }
    });

    document.getElementById('removeButton').addEventListener('click', async () => {
        const name = `${selectedMember.first_name} ${selectedMember.last_name}`;
        if (!confirm(`Remove ${name} from the system? This cannot be undone.`)) return;
        try {
            await buttonLogic.removeButtonLogic(selectedMember);
            closeModal();
            await renderTable();
        } catch (error) {
            console.error("❌ Failed to delete member:", error);
            alert("Failed to delete member. Please try again.");
        }
    });

    // Add form
    document.getElementById('addForm').addEventListener('submit', async function (event) {
        try {
            await buttonLogic.addFormSubmitLogic(event);
            await renderTable();
        } catch (err) {
            console.error("❌ Error adding member:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
            alert("Failed to add member. Please check the form and try again.");
        }
    });

    // Dropdown buttons
    document.getElementById('addDropdownButton').addEventListener('click', () => { 
        buttonLogic.dropdownButtonLogic('add-member'); 
    });

    document.getElementById('removeDropdownButton').addEventListener('click', () => { 
        buttonLogic.dropdownButtonLogic('remove-member'); 
    });

    document.getElementById('searchDropdownButton').addEventListener('click', () => { 
        buttonLogic.dropdownButtonLogic('search-member'); 
    });

    const downloadBtn = document.getElementById('downloadDropdownButton');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => { 
            buttonLogic.dropdownButtonLogic('download-member'); 
        });
    }

    // Open form buttons
    document.getElementById('openAddButton').addEventListener('click', () => { 
        buttonLogic.openFormLogic('addForm'); 
    });

    document.getElementById('openRemoveButton').addEventListener('click', () => { 
        buttonLogic.openFormLogic('removeForm'); 
    });

    document.getElementById('openSearchButton').addEventListener('click', () => { 
        buttonLogic.openFormLogic('searchForm'); 
    });

    const openDownloadBtn = document.getElementById('openDownloadButton');
    if (openDownloadBtn) {
        openDownloadBtn.addEventListener('click', () => { 
            buttonLogic.exportCsv(members); 
        });
    }

    // Cancel buttons
    document.getElementById('cancelAddButton').addEventListener('click', () => {
        buttonLogic.cancelDropdownLogic('addForm');
    });

    document.getElementById('cancelRemoveButton').addEventListener('click', () => {
        buttonLogic.cancelDropdownLogic('removeForm', 'removeResults');
    });

    document.getElementById('cancelSearchButton').addEventListener('click', () => {
        buttonLogic.cancelDropdownLogic('searchForm', 'searchResults');
    });

    // Search buttons
    document.getElementById('searchRemoveButton').addEventListener('click', async () => {
        const matchingMembers = buttonLogic.findMatchingMembers(members, 'removeFirstName', 'removeLastName');
        if (matchingMembers && matchingMembers.length > 0) { 
            displayRemoveResults(matchingMembers); 
        }
    });

    document.getElementById('searchMemberButton').addEventListener('click', async () => {
        const matchingMembers = buttonLogic.findMatchingMembers(members, 'searchFirstName', 'searchLastName');
        if (matchingMembers && matchingMembers.length > 0) { 
            displaySearchResults(matchingMembers); 
        }
    });

    // CSV upload
    document.getElementById('openAddGroupButton').addEventListener('click', () => {
        document.getElementById('groupCsvInput').click();
    });

    document.getElementById('groupCsvInput').addEventListener('change', async (event) => {
        buttonLogic.csvAddLogic(event);
    });

    // Rank type change handler
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
}

export function getMembers() {
    return members;
}

export function getSelectedMember() {
    return selectedMember;
}

export { 
    renderTable, 
    layoutShelf, 
    setupEventListeners 
};
