/* ============================================================
   LEGGO — Multi-Trip Sync Engine (STABLE)
   assets/db.js
   ============================================================ */

// 1. 🔗 CONNECTION
const SUPABASE_URL = 'https://ojzxouqvntvfdiiehtmm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VVp0Ay1pCZogwnFLZbQg3w_Dj8wJ_Pm';
const leggoClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.leggoDB = leggoClient;

// 2. 🆔 CONFIGURATION
const TRIP_MAP = {
    'scandinavia-2026': '11111111-1111-1111-1111-111111111111',
    'scotland-2026':    '33333333-3333-3333-3333-333333333333' 
};

const ERSALINA_FAMILY_ID = '22222222-2222-2222-2222-222222222221';
let CURRENT_TRIP_ID = null;

// 3. 🔄 THE MASTER SYNC
async function syncEverything() {
    if (!CURRENT_TRIP_ID) return;
    console.log(`🛰️ Fetching Trip Data: ${CURRENT_TRIP_ID}`);
    
    const { data: budgetData } = await window.leggoDB
        .from('leggo_budget_items')
        .select('*')
        .eq('trip_id', CURRENT_TRIP_ID)
        .order('sort_order', { ascending: true });

    const { data: packData } = await window.leggoDB
        .from('leggo_packing_items')
        .select('*')
        .eq('trip_id', CURRENT_TRIP_ID)
        .eq('family_id', ERSALINA_FAMILY_ID)
        .order('sort_order', { ascending: true });

    renderBudget(budgetData || []);
    renderPacking(packData || []);
}

// 4. 🎨 BUDGET RENDERER
function renderBudget(items) {
    // Render rows for every .budget-category in the DOM
    document.querySelectorAll('.budget-category').forEach(catEl => {
        const cat = catEl.id.replace('cat-', '');
        const container = catEl.querySelector('.budget-rows');
        if (!container) return;

        container.innerHTML = `
            <div class="budget-col-header">
                <span></span><span></span><span>ITEM</span><span>AMOUNT</span><span>≈ EUR</span><span></span>
            </div>`;

        items.filter(i => i.category === cat).forEach(item => {
            const row = document.createElement('div');
            row.className = `budget-row ${item.is_paid ? 'is-paid' : ''}`;
            row.setAttribute('data-id', item.id);
            row.innerHTML = `
                <span class="drag-handle">⠿</span>
                <span class="check ${item.is_paid ? 'is-checked' : ''}"
                      onclick="toggleStatus(event, '${item.id}', 'leggo_budget_items', 'is_paid', ${item.is_paid})"></span>
                <div class="budget-row__desc">
                    <input class="budget-desc-input" placeholder="Item name…" onchange="updateBudgetDesc('${item.id}', this.value)">
                    <input class="budget-notes-input" placeholder="Details…" onchange="updateBudgetNotes('${item.id}', this.value)">
                </div>
                <div class="budget-row__foreign">
                    <input class="budget-input" onchange="updateBudgetValue('${item.id}', this.value)">
                </div>
                <div class="budget-row__eur">
                    <span class="budget-row__eur-amount" data-eur-val="${item.amount_eur || 0}">€ ${(item.amount_eur || 0).toLocaleString('en-US', {minimumFractionDigits:2})}</span>
                </div>
                <button class="delete-item-btn" onclick="deleteItem(event, '${item.id}')" title="Delete item">×</button>
            `;
            row.querySelector('.budget-desc-input').value = item.description || '';
            row.querySelector('.budget-notes-input').value = item.notes || '';
            row.querySelector('.budget-input').value = item.amount_text || '';
            container.appendChild(row);
        });
    });
    if (window.calculateBudget) window.calculateBudget();
    initSortable();
}

// 5. 🎨 PACKING RENDERER
function renderPacking(items) {
    const sections = ['docs', 'clothes', 'tech-kids'];
    sections.forEach(sec => {
        const container = document.querySelector(`#pack-${sec} .pack-rows`);
        if (!container) return;
        container.innerHTML = '';

        items.filter(i => i.category_key === sec).forEach(item => {
            const row = document.createElement('label');
            row.className = `pack-row ${item.is_packed ? 'is-checked' : ''}`;
            row.setAttribute('data-id', item.id);
            row.innerHTML = `
                <span class="drag-handle">⠿</span>
                <input type="checkbox" class="pack-check" ${item.is_packed ? 'checked' : ''}>
                <span>${item.item_name}</span>
            `;
            row.onclick = (e) => {
                if (e.target.classList.contains('drag-handle')) return;
                e.preventDefault();
                toggleStatus(e, item.id, 'leggo_packing_items', 'is_packed', item.is_packed);
            };
            container.appendChild(row);
        });
    });
    if (window.updatePackProgress) window.updatePackProgress();
    initSortable();
}

// 6. ➕ ADD NEW ITEM
async function addNewItem(event, category, table) {
    event.stopPropagation();
    if (!CURRENT_TRIP_ID) return;

    if (table === 'leggo_budget_items') {
        // Expand the category so the new row is visible
        const catEl = document.getElementById(`cat-${category}`);
        if (catEl && !catEl.classList.contains('is-open')) catEl.classList.add('is-open');

        const newItem = { trip_id: CURRENT_TRIP_ID, category: category, description: '', amount_text: '', amount_eur: 0 };
        const { data, error } = await window.leggoDB.from(table).insert([newItem]).select();
        if (!error) {
            await syncEverything();
            if (data && data[0]) {
                const newRow = document.querySelector(`[data-id="${data[0].id}"]`);
                if (newRow) {
                    const input = newRow.querySelector('.budget-desc-input');
                    if (input) input.focus();
                }
            }
        }
    } else {
        // Packing: keep prompt for now
        const name = prompt(`Enter name for new ${category} item:`);
        if (!name) return;
        const newItem = { trip_id: CURRENT_TRIP_ID, family_id: ERSALINA_FAMILY_ID, category_key: category, item_name: name };
        const { error } = await window.leggoDB.from(table).insert([newItem]);
        if (!error) syncEverything();
    }
}

// 6b. 🗑 DELETE ITEM
async function deleteItem(event, id) {
    event.stopPropagation();
    const row = event.currentTarget.closest('.budget-row');
    if (row) { row.style.opacity = '0.3'; row.style.pointerEvents = 'none'; }
    const { error } = await window.leggoDB.from('leggo_budget_items').delete().eq('id', id);
    if (!error) syncEverything();
    else if (row) { row.style.opacity = ''; row.style.pointerEvents = ''; }
}

// 7. ⚡ STATUS & VALUE UPDATES
async function toggleStatus(event, id, table, column, currentVal) {
    const el = event.currentTarget;
    const isNowChecked = !el.classList.contains('is-checked');
    el.classList.toggle('is-checked', isNowChecked);
    const parentRow = el.closest('.budget-row') || el.closest('.pack-row');
    if (parentRow) parentRow.classList.toggle('is-paid', isNowChecked);
    const checkbox = el.querySelector('input');
    if (checkbox) checkbox.checked = isNowChecked;

    if (window.calculateBudget) window.calculateBudget();
    if (window.updatePackProgress) window.updatePackProgress();

    await window.leggoDB.from(table).update({ [column]: isNowChecked }).eq('id', id);
}

async function updateBudgetValue(id, text) {
    if (!text) return;
    let val = text.toUpperCase().trim();
    const numericPart = parseFloat(val.replace(/[^\d.]/g, '')) || 0;
    let currencyPart = val.replace(/[\d.,\s]/g, '') || '€';
    if (currencyPart === 'GBP') currencyPart = '£';
    const formattedNum = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(numericPart);
    const beautifulText = `${currencyPart} ${formattedNum}`;

    let eurVal = numericPart;
    if (beautifulText.includes('NOK')) eurVal = numericPart * 0.089;
    if (beautifulText.includes('SEK')) eurVal = numericPart * 0.092;
    if (beautifulText.includes('£'))   eurVal = numericPart * 1.15;

    const { error } = await window.leggoDB.from('leggo_budget_items').update({ 
        amount_text: beautifulText, 
        amount_eur: eurVal 
    }).eq('id', id);
    
    if (!error) syncEverything();
}

async function updateBudgetDesc(id, value) {
    await window.leggoDB.from('leggo_budget_items').update({ description: value }).eq('id', id);
}

async function updateBudgetNotes(id, value) {
    await window.leggoDB.from('leggo_budget_items').update({ notes: value }).eq('id', id);
}

// 8. ⠿ SORTING
function initSortable() {
    const containers = document.querySelectorAll('.budget-rows, .pack-rows');
    containers.forEach(container => {
        if (container.classList.contains('sortable-ready')) return;
        container.classList.add('sortable-ready');
        new Sortable(container, {
            handle: '.drag-handle',
            animation: 150,
            onEnd: async () => {
                const table = container.classList.contains('budget-rows') ? 'leggo_budget_items' : 'leggo_packing_items';
                await updateSortOrder(container, table);
            }
        });
    });
}

async function updateSortOrder(container, table) {
    const rows = Array.from(container.children).filter(el => el.hasAttribute('data-id'));
    for (let i = 0; i < rows.length; i++) {
        const id = rows[i].getAttribute('data-id');
        await window.leggoDB.from(table).update({ sort_order: i + 1 }).eq('id', id);
    }
}

// 🚦 START — The Master Switchboard
document.addEventListener('DOMContentLoaded', () => {
    // Safely look for the config whether it's a const or window variable
    let pageId = null;
    if (typeof PAGE_SECURITY_CONFIG !== 'undefined') {
        pageId = PAGE_SECURITY_CONFIG.pageId;
    } else if (window.PAGE_SECURITY_CONFIG) {
        pageId = window.PAGE_SECURITY_CONFIG.pageId;
    }

    if (pageId && TRIP_MAP[pageId]) {
        CURRENT_TRIP_ID = TRIP_MAP[pageId];
        console.log(`🛰️ Page Detected: ${pageId}. Trip ID set to: ${CURRENT_TRIP_ID}`);
        syncEverything();
    } else {
        console.error(`🛡️ Security Error: Page ID '${pageId}' is not registered in the TRIP_MAP.`);
    }
});