const COLUMNS = [
    { id: 'wishlist', title: 'Wishlist', color: 'var(--col-wishlist)' },
    { id: 'applied', title: 'Applied', color: 'var(--col-applied)' },
    { id: 'interviewing', title: 'Interviewing', color: 'var(--col-interviewing)' },
    { id: 'offer', title: 'Offer', color: 'var(--col-offer)' },
    { id: 'rejected', title: 'Rejected', color: 'var(--col-rejected)' }
];

// State
let terms = JSON.parse(localStorage.getItem('internship-tracker-terms')) || [{ id: 'default', name: 'My Cycle' }];
let activeTermId = localStorage.getItem('internship-tracker-active-term') || 'default';
let applications = JSON.parse(localStorage.getItem('internship-tracker-apps')) || [];
let currentSort = localStorage.getItem('internship-tracker-sort') || 'created-desc';

// Data Migration
if (applications.length > 0 && !applications[0].termId) {
    applications = applications.map(app => ({ ...app, termId: 'default' }));
    localStorage.setItem('internship-tracker-apps', JSON.stringify(applications));
}

let draggingCardId = null;

// DOM Elements
const boardEl = document.getElementById('board');
const addBtn = document.getElementById('add-btn');
const termSelect = document.getElementById('term-select');
const sortSelect = document.getElementById('sort-select');
const addTermBtn = document.getElementById('add-term-btn');
const deleteTermBtn = document.getElementById('delete-term-btn');

// App Modal
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const appForm = document.getElementById('app-form');
const cancelBtn = document.getElementById('cancel-btn');
const deleteBtn = document.getElementById('delete-btn');
const rejectCheckbox = document.getElementById('reject-checkbox');
const statusSelect = document.getElementById('status');

// Term Modal
const termModalOverlay = document.getElementById('term-modal-overlay');
const termForm = document.getElementById('term-form');
const termNameInput = document.getElementById('term-name');
const cancelTermBtn = document.getElementById('cancel-term-btn');

// --- Initialization ---
function init() {
    renderTermSelector();
    sortSelect.value = currentSort;
    renderBoard();
    renderTimeline();
    renderFloatingBackground();
    setupEventListeners();
}

// --- Term Management ---
function renderTermSelector() {
    termSelect.innerHTML = terms.map(term => 
        `<option value="${term.id}" ${term.id === activeTermId ? 'selected' : ''}>${term.name}</option>`
    ).join('');
}

function handleTermChange(e) {
    activeTermId = e.target.value;
    localStorage.setItem('internship-tracker-active-term', activeTermId);
    renderBoard();
    renderTimeline();
    renderFloatingBackground();
}

function addNewTerm(name) {
    const newTerm = { id: crypto.randomUUID(), name: name };
    terms.push(newTerm);
    activeTermId = newTerm.id;
    localStorage.setItem('internship-tracker-terms', JSON.stringify(terms));
    localStorage.setItem('internship-tracker-active-term', activeTermId);
    renderTermSelector();
    renderBoard();
    renderTimeline();
    renderFloatingBackground();
}

function deleteCurrentTerm() {
    if (terms.length <= 1) {
        alert("You must have at least one term.");
        return;
    }
    const termToDelete = terms.find(t => t.id === activeTermId);
    if (!termToDelete) return;
    if (confirm(`Are you sure you want to delete "${termToDelete.name}"?`)) {
        terms = terms.filter(t => t.id !== activeTermId);
        applications = applications.filter(app => app.termId !== activeTermId);
        activeTermId = terms[0].id;
        localStorage.setItem('internship-tracker-terms', JSON.stringify(terms));
        localStorage.setItem('internship-tracker-active-term', activeTermId);
        saveToStorage();
        renderTermSelector();
        renderBoard();
        renderTimeline();
        renderFloatingBackground();
    }
}

// --- Rendering ---
function renderTimeline() {
    const timelineEl = document.getElementById('timeline');
    let datedApps = applications.filter(app => app.termId === activeTermId && app.date);
    if (currentSort === 'created-asc') {
        datedApps.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    } else {
        datedApps.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    if (datedApps.length === 0) {
        timelineEl.innerHTML = '<div class="timeline-placeholder">Add applications with dates to see your timeline...</div>';
        return;
    }
    timelineEl.innerHTML = datedApps.map(app => `
        <div class="timeline-item" data-status="${app.status}" onclick="openEditModalById('${app.id}')">
            <div class="timeline-date">${new Date(app.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
            <div class="timeline-dot"></div>
            <div class="timeline-card">
                <div class="timeline-company">${escapeHtml(app.company)}</div>
                <div class="timeline-role">${escapeHtml(app.position)}</div>
            </div>
        </div>
    `).join('');
}

function renderFloatingBackground() {
    const container = document.getElementById('bg-animation-container');
    container.innerHTML = '';
    const termApps = applications.filter(app => app.termId === activeTermId);
    const companies = [...new Set(termApps.map(app => app.company).filter(c => c))];
    let tagsToRender = [...companies];
    if (tagsToRender.length < 10) {
        const defaults = ['Google', 'Meta', 'Amazon', 'Startups', 'Tech', 'Netflix', 'Microsoft', 'Apple'];
        tagsToRender = [...tagsToRender, ...defaults];
    }
    if (tagsToRender.length > 20) tagsToRender = tagsToRender.slice(0, 20);
    tagsToRender.forEach(company => {
        const el = document.createElement('div');
        el.classList.add('bg-company-tag');
        el.textContent = company;
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        el.style.left = `${left}vw`;
        el.style.top = `${top}vh`;
        const size = 3 + Math.random() * 5;
        el.style.fontSize = `${size}rem`;
        const variant = Math.floor(Math.random() * 3) + 1;
        const duration = 15 + Math.random() * 20;
        const delay = Math.random() * -15;
        el.style.animation = `float-drift-${variant} ${duration}s linear ${delay}s infinite alternate`;
        const rot = Math.random() * 40 - 20;
        el.style.transform = `rotate(${rot}deg)`;
        container.appendChild(el);
    });
}

function renderBoard() {
    boardEl.innerHTML = '';
    const sortApps = (a, b) => {
        if (currentSort === 'created-asc') return (a.createdAt || 0) - (b.createdAt || 0);
        return (b.createdAt || 0) - (a.createdAt || 0);
    };
    COLUMNS.forEach(col => {
        const columnEl = document.createElement('div');
        columnEl.classList.add('column');
        columnEl.dataset.status = col.id;
        let columnApps = applications.filter(app => app.status === col.id && app.termId === activeTermId);
        columnApps.sort(sortApps);
        columnEl.innerHTML = `
            <div class="column-header">
                <span class="column-title" style="color: ${col.color}">${col.title}</span>
                <span class="count-badge">${columnApps.length}</span>
            </div>
            <div class="card-list" data-status="${col.id}"></div>
        `;
        const cardListEl = columnEl.querySelector('.card-list');
        columnApps.forEach(app => {
            const card = createCardElement(app);
            cardListEl.appendChild(card);
        });
        cardListEl.addEventListener('dragover', handleDragOver);
        cardListEl.addEventListener('dragleave', handleDragLeave);
        cardListEl.addEventListener('drop', handleDrop);
        boardEl.appendChild(columnEl);
    });
}

function createCardElement(app) {
    const el = document.createElement('div');
    el.classList.add('card');
    el.draggable = true;
    el.dataset.id = app.id;
    const dateStr = app.date ? new Date(app.date).toLocaleDateString() : 'No Date';
    el.innerHTML = `
        <div class="card-company">${escapeHtml(app.company)}</div>
        <div class="card-role">${escapeHtml(app.position)}</div>
        <div class="card-footer">
            <div class="card-date">📅 ${dateStr}</div>
        </div>
    `;
    el.addEventListener('dragstart', handleDragStart);
    el.addEventListener('dragend', handleDragEnd);
    el.addEventListener('click', () => openEditModal(app));
    return el;
}

function handleDragStart(e) { draggingCardId = e.target.dataset.id; e.target.classList.add('dragging'); }
function handleDragEnd(e) { e.target.classList.remove('dragging'); draggingCardId = null; }
function handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function handleDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function handleDrop(e) {
    e.preventDefault();
    const list = e.currentTarget;
    list.classList.remove('drag-over');
    const newStatus = list.dataset.status;
    if (draggingCardId && newStatus) updateApplicationStatus(draggingCardId, newStatus);
}

function saveToStorage() {
    localStorage.setItem('internship-tracker-apps', JSON.stringify(applications));
    renderBoard();
    renderTimeline();
    renderFloatingBackground();
}

function addApplication(appData) {
    const newApp = { id: crypto.randomUUID(), termId: activeTermId, createdAt: Date.now(), ...appData };
    applications.push(newApp);
    saveToStorage();
}

function updateApplication(id, updatedData) {
    const index = applications.findIndex(app => app.id === id);
    if (index !== -1) { applications[index] = { ...applications[index], ...updatedData }; saveToStorage(); }
}

function updateApplicationStatus(id, newStatus) {
    const index = applications.findIndex(app => app.id === id);
    if (index !== -1 && applications[index].status !== newStatus) {
        applications[index].status = newStatus;
        saveToStorage();
    }
}

function deleteApplication(id) {
    applications = applications.filter(app => app.id !== id);
    saveToStorage();
}

function openAddModal() {
    modalTitle.textContent = 'Add Application';
    appForm.reset();
    document.getElementById('app-id').value = '';
    document.getElementById('date').valueAsDate = new Date();
    deleteBtn.classList.add('hidden');
    statusSelect.value = 'applied';
    statusSelect.disabled = false;
    rejectCheckbox.checked = false;
    modalOverlay.classList.remove('hidden');
}

function openEditModalById(id) {
    const app = applications.find(a => a.id === id);
    if (app) openEditModal(app);
}

function openEditModal(app) {
    modalTitle.textContent = 'Edit Application';
    document.getElementById('app-id').value = app.id;
    document.getElementById('company').value = app.company;
    document.getElementById('position').value = app.position;
    document.getElementById('status').value = app.status;
    document.getElementById('date').value = app.date;
    document.getElementById('note').value = app.note || '';
    if (app.status === 'rejected') {
        rejectCheckbox.checked = true;
        statusSelect.disabled = true;
    } else {
        rejectCheckbox.checked = false;
        statusSelect.disabled = false;
    }
    deleteBtn.classList.remove('hidden');
    modalOverlay.classList.remove('hidden');
}

function closeModal() { modalOverlay.classList.add('hidden'); }

function setupEventListeners() {
    addBtn.addEventListener('click', openAddModal);
    cancelBtn.addEventListener('click', closeModal);
    rejectCheckbox.addEventListener('change', (e) => {
        statusSelect.disabled = e.target.checked;
    });
    termSelect.addEventListener('change', handleTermChange);
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        localStorage.setItem('internship-tracker-sort', currentSort);
        renderBoard();
    });
    addTermBtn.addEventListener('click', () => { termForm.reset(); termModalOverlay.classList.remove('hidden'); });
    cancelTermBtn.addEventListener('click', () => { termModalOverlay.classList.add('hidden'); });
    termForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = termNameInput.value.trim();
        if (name) { addNewTerm(name); termModalOverlay.classList.add('hidden'); }
    });
    appForm.addEventListener('submit', (e) => {
        e.preventDefault();
        let finalStatus = statusSelect.value;
        if (rejectCheckbox.checked) finalStatus = 'rejected';
        const formData = {
            company: document.getElementById('company').value,
            position: document.getElementById('position').value,
            status: finalStatus,
            date: document.getElementById('date').value,
            note: document.getElementById('note').value
        };
        const id = document.getElementById('app-id').value;
        if (id) updateApplication(id, formData);
        else addApplication(formData);
        closeModal();
    });
}

function escapeHtml(unsafe) {
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

init();
