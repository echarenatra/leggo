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

let CURRENT_TRIP_ID = null;
const _pendingDeletes = new Map(); // id -> { timer }

// 3. 🔄 THE MASTER SYNC
async function syncEverything() {
    if (!CURRENT_TRIP_ID) return;
    console.log(`🛰️ Fetching Trip Data: ${CURRENT_TRIP_ID}`);

    const { data: budgetData } = await window.leggoDB
        .from('leggo_budget_items')
        .select('*')
        .eq('trip_id', CURRENT_TRIP_ID)
        .order('sort_order', { ascending: true });

    const { data: packData, error: packErr } = await window.leggoDB
        .from('leggo_packing_items')
        .select('*')
        .eq('trip_id', CURRENT_TRIP_ID)
        .order('sort_order', { ascending: true });

    const { data: catData, error: catErr } = await window.leggoDB
        .from('leggo_packing_categories')
        .select('*')
        .eq('trip_id', CURRENT_TRIP_ID)
        .order('sort_order', { ascending: true });

    const { data: subCatData, error: subCatErr } = await window.leggoDB
        .from('leggo_packing_subcategories')
        .select('*')
        .eq('trip_id', CURRENT_TRIP_ID)
        .order('sort_order', { ascending: true });

    if (packErr) console.error('🚨 Packing items fetch error:', packErr);
    if (catErr) console.error('🚨 Packing categories fetch error:', catErr);
    if (subCatErr) console.error('🚨 Packing subcategories fetch error:', subCatErr);
    console.log(`📦 Packing: ${(catData||[]).length} categories, ${(subCatData||[]).length} subcategories, ${(packData||[]).length} items`);

    renderBudget(budgetData || []);
    renderPacking(packData || [], catData || [], subCatData || []);
}

// 4. 🎨 BUDGET RENDERER
function renderBudget(items) {
    const hasLedger = Array.isArray(window.LEDGER_FAMILIES) && window.LEDGER_FAMILIES.length > 0;

    document.querySelectorAll('.budget-category').forEach(catEl => {
        const cat = catEl.id.replace('cat-', '');
        const container = catEl.querySelector('.budget-rows');
        if (!container) return;

        container.innerHTML = `
            <div class="budget-col-header">
                <span></span><span></span><span>ITEM</span><span>AMOUNT</span><span>≈ EUR</span><span></span>
            </div>`;

        items.filter(i => i.category === cat && !_pendingDeletes.has(i.id)).forEach(item => {
            const row = document.createElement('div');
            row.className = `budget-row ${item.is_paid ? 'is-paid' : ''}`;
            row.setAttribute('data-id', item.id);

            const isShared = item.is_shared_expense !== false;
            const splitWith = Array.isArray(item.split_with) && item.split_with.length
                ? item.split_with
                : (window.LEDGER_FAMILIES || []);
            row.dataset.paidBy    = item.paid_by || '';
            row.dataset.splitWith = splitWith.join(',');
            row.dataset.isShared  = isShared ? 'true' : 'false';

            const badgesHTML = hasLedger ? (() => {
                const paidBy = item.paid_by || '';
                const famObj = (window.LEDGER_FAMILIES || []).find(f => f.name === paidBy);
                const payerStyle = famObj ? `style="background:${famObj.color};color:#fff;border:none"` : '';
                const payerClass = paidBy ? 'payer-badge' : 'payer-badge payer-badge--empty';
                const payerLabel = paidBy || '+ who paid?';
                const sharedClass = isShared ? 'is-shared' : '';
                const sharedLabel = isShared ? '÷ shared' : 'solo';
                return `<div class="budget-row__badges">
                    <button class="${payerClass}" ${payerStyle} onclick="cyclePaidBy(this,'${item.id}')">${payerLabel}</button>
                    <button class="shared-badge ${sharedClass}" onclick="toggleShared(this,'${item.id}')">${sharedLabel}</button>
                </div>`;
            })() : '';

            row.innerHTML = `
                <span class="drag-handle">⠿</span>
                <span class="check ${item.is_paid ? 'is-checked' : ''}"
                      onclick="toggleStatus(event, '${item.id}', 'leggo_budget_items', 'is_paid', ${item.is_paid})"></span>
                <div class="budget-row__desc">
                    <input class="budget-desc-input" placeholder="Item name…" onchange="updateBudgetDesc('${item.id}', this.value)">
                    <input class="budget-notes-input" placeholder="Details…" onchange="updateBudgetNotes('${item.id}', this.value)">
                    ${badgesHTML}
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

// 4b. 🏷 LEDGER BADGE INTERACTIONS
function cyclePaidBy(btn, itemId) {
    const famObjs = window.LEDGER_FAMILIES || [];
    const names   = [...famObjs.map(f => f.name), ''];
    const row     = btn.closest('.budget-row');
    const current = row.dataset.paidBy || '';
    const next    = names[(names.indexOf(current) + 1) % names.length];
    row.dataset.paidBy = next;
    if (next) {
        const famObj = famObjs.find(f => f.name === next);
        btn.textContent = next;
        btn.className   = 'payer-badge';
        btn.style.cssText = famObj ? `background:${famObj.color};color:#fff;border:none` : '';
    } else {
        btn.textContent   = '+ who paid?';
        btn.className     = 'payer-badge payer-badge--empty';
        btn.style.cssText = '';
    }
    updatePaidBy(itemId, next || null);
}

async function updatePaidBy(id, family) {
    await window.leggoDB.from('leggo_budget_items').update({ paid_by: family || null }).eq('id', id);
    if (window.calculateBudget) window.calculateBudget();
}

function toggleShared(btn, itemId) {
    const row = btn.closest('.budget-row');
    const isNowShared = row.dataset.isShared !== 'true';
    row.dataset.isShared = isNowShared ? 'true' : 'false';
    btn.textContent = isNowShared ? '÷ shared' : 'solo';
    btn.classList.toggle('is-shared', isNowShared);
    updateIsShared(itemId, isNowShared);
}

async function updateIsShared(id, value) {
    await window.leggoDB.from('leggo_budget_items').update({ is_shared_expense: value }).eq('id', id);
    if (window.calculateBudget) window.calculateBudget();
}

// 5. 🎨 PACKING RENDERER
function renderPacking(items, categories, subcategories) {
    const wrapper = document.getElementById('pack-wrapper');
    if (!wrapper) return;

    // Preserve open/closed state across re-renders
    const openCats = new Set();
    wrapper.querySelectorAll('.pack-category.is-open').forEach(el => openCats.add(el.id));

    wrapper.innerHTML = '';

    categories.forEach(cat => {
        const catDiv = document.createElement('div');
        catDiv.className = 'pack-category';
        catDiv.id = `pack-${cat.category_key}`;
        if (openCats.has(`pack-${cat.category_key}`)) catDiv.classList.add('is-open');

        catDiv.innerHTML = `
            <div class="pack-category__header" onclick="togglePack('pack-${cat.category_key}')">
                <span class="pack-category__label"
                      contenteditable="true"
                      onblur="updateCategoryLabel('${cat.id}', this.textContent.trim())"
                      onclick="event.stopPropagation()">${cat.label}</span>
                <button class="add-pack-btn" onclick="addNewPackItem(event, '${cat.category_key}')" title="Add item">+</button>
                <button class="add-subcat-btn" onclick="addNewSubcategory(event, '${cat.category_key}')" title="Add sub-group">+ subcategory</button>
                <button class="delete-cat-btn" onclick="deleteCategory(event, '${cat.id}', '${cat.category_key}')" title="Delete category">×</button>
                <span class="pack-category__count" id="pcount-${cat.category_key}"></span>
                <span class="pack-category__toggle">▾</span>
            </div>
            <div class="pack-rows"></div>
        `;

        const rowsContainer = catDiv.querySelector('.pack-rows');
        const catItems = items.filter(i => i.category_key === cat.category_key);
        const catSubcats = (subcategories || []).filter(s => s.category_key === cat.category_key);

        // Render ungrouped items first (no subcategory_key)
        const ungrouped = catItems.filter(i => !i.subcategory_key && !_pendingDeletes.has(i.id));
        ungrouped.forEach(item => rowsContainer.appendChild(buildPackRow(item)));

        // Render each subcategory with its items
        catSubcats.forEach(sub => {
            const subLabel = document.createElement('div');
            subLabel.className = 'pack-sub-label';
            subLabel.setAttribute('data-subcat-id', sub.id);
            subLabel.innerHTML = `
                <span class="pack-sub-label__text"
                      contenteditable="true"
                      onblur="updateSubcategoryLabel('${sub.id}', this.textContent.trim())"
                      onclick="event.stopPropagation()">${sub.label}</span>
                <button class="add-pack-btn" onclick="addNewPackItem(event, '${cat.category_key}', '${sub.subcategory_key}')" title="Add item to this group">+</button>
                <button class="delete-subcat-btn" onclick="deleteSubcategory(event, '${sub.id}', '${cat.category_key}', '${sub.subcategory_key}')" title="Remove group">×</button>
            `;
            rowsContainer.appendChild(subLabel);

            const subItems = catItems.filter(i => i.subcategory_key === sub.subcategory_key && !_pendingDeletes.has(i.id));
            subItems.forEach(item => rowsContainer.appendChild(buildPackRow(item)));
        });

        wrapper.appendChild(catDiv);
    });

    if (window.updatePackProgress) window.updatePackProgress();
    initSortable();
}

function buildPackRow(item) {
    const row = document.createElement('div');
    row.className = 'pack-row';
    row.setAttribute('data-id', item.id);
    row.innerHTML = `
        <span class="drag-handle">⠿</span>
        <span class="check ${item.is_packed ? 'is-checked' : ''}"
              onclick="togglePackStatus(event, '${item.id}')"></span>
        <input class="pack-name-input${item.is_packed ? ' is-packed' : ''}"
               placeholder="Item name…"
               onchange="updatePackItemName('${item.id}', this.value)"
               onclick="event.stopPropagation()">
        <button class="delete-item-btn" onclick="deletePackItem(event, '${item.id}')" title="Delete">×</button>
    `;
    const nameInput = row.querySelector('.pack-name-input');
    nameInput.value = item.item_name || '';
    nameInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addNewPackItem({ stopPropagation: () => {} }, item.category_key, item.subcategory_key || undefined);
        }
    });
    return row;
}

// 5b. ⚡ PACKING INTERACTIONS

async function togglePackStatus(event, id) {
    event.stopPropagation();
    const checkEl = event.currentTarget;
    const isNowChecked = !checkEl.classList.contains('is-checked');
    checkEl.classList.toggle('is-checked', isNowChecked);
    const input = checkEl.closest('.pack-row')?.querySelector('.pack-name-input');
    if (input) input.classList.toggle('is-packed', isNowChecked);
    if (window.updatePackProgress) window.updatePackProgress();
    await window.leggoDB.from('leggo_packing_items').update({ is_packed: isNowChecked }).eq('id', id);
}

async function addNewPackItem(event, categoryKey, subcategoryKey) {
    event.stopPropagation();
    if (!CURRENT_TRIP_ID) return;

    const catEl = document.getElementById(`pack-${categoryKey}`);
    if (catEl && !catEl.classList.contains('is-open')) catEl.classList.add('is-open');

    const newItem = { trip_id: CURRENT_TRIP_ID, category_key: categoryKey, item_name: '', sort_order: 9999 };
    if (subcategoryKey) newItem.subcategory_key = subcategoryKey;

    const { data, error } = await window.leggoDB
        .from('leggo_packing_items')
        .insert([newItem])
        .select();

    if (!error) {
        await syncEverything();
        if (data && data[0]) {
            const newRow = document.querySelector(`[data-id="${data[0].id}"]`);
            if (newRow) newRow.querySelector('.pack-name-input')?.focus();
        }
    }
}

function deletePackItem(event, id) {
    event.stopPropagation();
    scheduleDeleteWithUndo(id, 'Item deleted',
        () => window.leggoDB.from('leggo_packing_items').delete().eq('id', id)
    );
}

async function addNewCategory(event) {
    event.stopPropagation();
    if (!CURRENT_TRIP_ID) return;

    const key = 'cat-' + Date.now();
    const { data, error } = await window.leggoDB
        .from('leggo_packing_categories')
        .insert([{ trip_id: CURRENT_TRIP_ID, category_key: key, label: 'New Category', sort_order: 9999 }])
        .select();

    if (!error) {
        await syncEverything();
        const catEl = document.getElementById(`pack-${key}`);
        if (catEl) {
            const labelEl = catEl.querySelector('.pack-category__label');
            if (labelEl) {
                labelEl.focus();
                const range = document.createRange();
                range.selectNodeContents(labelEl);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    }
}

async function deleteCategory(event, catId, categoryKey) {
    event.stopPropagation();
    const catLabel = event.currentTarget.closest('.pack-category')
        ?.querySelector('.pack-category__label')?.textContent?.trim() || 'this category';
    const action = await showConfirmModal({
        title: `Delete "${catLabel}"?`,
        message: 'This will permanently delete the category and all its items.',
        buttons: [
            { label: 'Delete everything', action: 'confirm', variant: 'danger' },
            { label: 'Cancel', action: 'cancel', variant: 'cancel' }
        ]
    });
    if (action !== 'confirm') return;
    await window.leggoDB.from('leggo_packing_items').delete().eq('trip_id', CURRENT_TRIP_ID).eq('category_key', categoryKey);
    await window.leggoDB.from('leggo_packing_subcategories').delete().eq('trip_id', CURRENT_TRIP_ID).eq('category_key', categoryKey);
    await window.leggoDB.from('leggo_packing_categories').delete().eq('id', catId);
    syncEverything();
}

async function updatePackItemName(id, value) {
    await window.leggoDB.from('leggo_packing_items').update({ item_name: value }).eq('id', id);
}

async function updateCategoryLabel(id, value) {
    if (!value) return;
    await window.leggoDB.from('leggo_packing_categories').update({ label: value }).eq('id', id);
}

// 5c. 📂 SUBCATEGORY INTERACTIONS

async function addNewSubcategory(event, categoryKey) {
    event.stopPropagation();
    if (!CURRENT_TRIP_ID) return;

    const catEl = document.getElementById(`pack-${categoryKey}`);
    if (catEl && !catEl.classList.contains('is-open')) catEl.classList.add('is-open');

    const key = 'sub-' + Date.now();
    const { data, error } = await window.leggoDB
        .from('leggo_packing_subcategories')
        .insert([{ trip_id: CURRENT_TRIP_ID, category_key: categoryKey, subcategory_key: key, label: 'New group', sort_order: 9999 }])
        .select();

    if (!error) {
        await syncEverything();
        if (data && data[0]) {
            const subEl = document.querySelector(`[data-subcat-id="${data[0].id}"]`);
            if (subEl) {
                const labelEl = subEl.querySelector('.pack-sub-label__text');
                if (labelEl) {
                    labelEl.focus();
                    const range = document.createRange();
                    range.selectNodeContents(labelEl);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        }
    }
}

async function deleteSubcategory(event, subId, categoryKey, subcategoryKey) {
    event.stopPropagation();
    const subLabel = event.currentTarget.closest('.pack-sub-label')
        ?.querySelector('.pack-sub-label__text')?.textContent?.trim() || 'this sub-group';
    const action = await showConfirmModal({
        title: `Remove "${subLabel}"?`,
        message: null,
        buttons: [
            { label: 'Keep items — move to ungrouped', action: 'keep' },
            { label: 'Delete all items in this group', action: 'delete', variant: 'danger' },
            { label: 'Cancel', action: 'cancel', variant: 'cancel' }
        ]
    });
    if (action === 'cancel') return;
    if (action === 'delete') {
        await window.leggoDB.from('leggo_packing_items').delete()
            .eq('trip_id', CURRENT_TRIP_ID)
            .eq('category_key', categoryKey)
            .eq('subcategory_key', subcategoryKey);
    } else {
        await window.leggoDB.from('leggo_packing_items').update({ subcategory_key: null })
            .eq('trip_id', CURRENT_TRIP_ID)
            .eq('category_key', categoryKey)
            .eq('subcategory_key', subcategoryKey);
    }
    await window.leggoDB.from('leggo_packing_subcategories').delete().eq('id', subId);
    syncEverything();
}

async function updateSubcategoryLabel(id, value) {
    if (!value) return;
    await window.leggoDB.from('leggo_packing_subcategories').update({ label: value }).eq('id', id);
}

// 6. ➕ ADD NEW BUDGET ITEM
async function addNewItem(event, category, table) {
    event.stopPropagation();
    if (!CURRENT_TRIP_ID) return;

    const catEl = document.getElementById(`cat-${category}`);
    if (catEl && !catEl.classList.contains('is-open')) catEl.classList.add('is-open');

    const newItem = { trip_id: CURRENT_TRIP_ID, category: category, description: '', amount_text: '', amount_eur: 0 };
    if (Array.isArray(window.LEDGER_FAMILIES) && window.LEDGER_FAMILIES.length) {
        newItem.split_with = window.LEDGER_FAMILIES.map(f => f.name);
        newItem.is_shared_expense = true;
    }
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
}

// 6b. 🗑 DELETE BUDGET ITEM
function deleteItem(event, id) {
    event.stopPropagation();
    scheduleDeleteWithUndo(id, 'Item deleted',
        () => window.leggoDB.from('leggo_budget_items').delete().eq('id', id)
    );
}

// 7. ⚡ BUDGET STATUS & VALUE UPDATES
async function toggleStatus(event, id, table, column, currentVal) {
    const el = event.currentTarget;
    const isNowChecked = !el.classList.contains('is-checked');
    el.classList.toggle('is-checked', isNowChecked);
    const parentRow = el.closest('.budget-row');
    if (parentRow) parentRow.classList.toggle('is-paid', isNowChecked);
    const checkbox = el.querySelector('input');
    if (checkbox) checkbox.checked = isNowChecked;

    if (window.calculateBudget) window.calculateBudget();

    await window.leggoDB.from(table).update({ [column]: isNowChecked }).eq('id', id);
}

async function updateBudgetValue(id, text) {
    if (!text) return;
    let val = text.toUpperCase().trim();

    const numericPart = parseFloat(val.replace(/[^\d.]/g, '')) || 0;
    let inputCurrency = val.replace(/[\d.,\s]/g, '') || '€';

    const currencyMap = {
        '€':   { symbol: '€',  rate: 1 },
        'EUR': { symbol: '€',  rate: 1 },
        '£':   { symbol: '£',  rate: 1.20 },
        'GBP': { symbol: '£',  rate: 1.20 },
        'NOK': { symbol: 'NOK', rate: 0.089 },
        'SEK': { symbol: 'SEK', rate: 0.092 },
        'RP':  { symbol: 'Rp',  rate: 0.000051 },
        'IDR': { symbol: 'Rp',  rate: 0.000051 },
        '$':   { symbol: '$',   rate: 0.92 },
        'USD': { symbol: '$',   rate: 0.92 }
    };

    const currencyData = currencyMap[inputCurrency] || { symbol: inputCurrency, rate: 1 };

    const formattedNum = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(numericPart);
    const beautifulText = `${currencyData.symbol} ${formattedNum}`;
    const eurVal = numericPart * currencyData.rate;

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

// 9. 🗑 UNDO TOAST & CONFIRM MODAL

function scheduleDeleteWithUndo(id, message, deleteFn) {
    // Mark as pending — renderers will skip this id
    _pendingDeletes.set(id, null);
    syncEverything(); // re-render without the item immediately

    const timer = setTimeout(async () => {
        _pendingDeletes.delete(id);
        await deleteFn();
        syncEverything();
    }, 4000);

    _pendingDeletes.set(id, { timer });
    showUndoToast(message, id);
}

function showUndoToast(message, id) {
    let toast = document.getElementById('leggo-undo-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'leggo-undo-toast';
        document.body.appendChild(toast);
    }
    if (toast._hideTimer) clearTimeout(toast._hideTimer);

    toast.innerHTML = `<span>${message}</span><button class="toast-undo-btn" onclick="undoDelete('${id}')">Undo</button>`;
    toast.classList.add('is-visible');

    toast._hideTimer = setTimeout(() => toast.classList.remove('is-visible'), 4500);
}

function undoDelete(id) {
    const pending = _pendingDeletes.get(id);
    if (pending) {
        clearTimeout(pending.timer);
        _pendingDeletes.delete(id);
        syncEverything(); // re-render with item restored
    }
    const toast = document.getElementById('leggo-undo-toast');
    if (toast) {
        if (toast._hideTimer) clearTimeout(toast._hideTimer);
        toast.classList.remove('is-visible');
    }
}

function showConfirmModal({ title, message, buttons }) {
    let overlay = document.getElementById('leggo-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'leggo-modal-overlay';
        document.body.appendChild(overlay);
    }

    const btnsHtml = buttons.map(b =>
        `<button class="leggo-modal-btn ${b.variant || ''}" data-action="${b.action}">${b.label}</button>`
    ).join('');

    overlay.innerHTML = `
        <div class="leggo-modal">
            <div class="leggo-modal__title">${title}</div>
            ${message ? `<div class="leggo-modal__message">${message}</div>` : ''}
            <div class="leggo-modal__buttons">${btnsHtml}</div>
        </div>`;
    overlay.classList.add('is-visible');

    return new Promise(resolve => {
        overlay.querySelectorAll('.leggo-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                overlay.classList.remove('is-visible');
                resolve(btn.dataset.action);
            });
        });
        overlay.addEventListener('click', e => {
            if (e.target === overlay) {
                overlay.classList.remove('is-visible');
                resolve('cancel');
            }
        }, { once: true });
    });
}

// 🚦 START — The Master Switchboard
document.addEventListener('DOMContentLoaded', () => {
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
