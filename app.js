const COLUMNS = [
    { id: 'wishlist', title: 'Wishlist', color: 'var(--col-wishlist)' },
    { id: 'applied', title: 'Applied', color: 'var(--col-applied)' },
    { id: 'interviewing', title: 'Interviewing', color: 'var(--col-interviewing)' },
    { id: 'offer', title: 'Offer', color: 'var(--col-offer)' },
    { id: 'rejected', title: 'Rejected', color: 'var(--col-rejected)' }
];

// State
let terms = JSON.parse(localStorage.getItem('xy-intern-terms')) || [{ id: 'default', name: 'My Cycle' }];
let activeTermId = localStorage.getItem('xy-intern-active-term') || 'default';
let applications = JSON.parse(localStorage.getItem('xy-intern-apps')) || [];
let currentSort = localStorage.getItem('xy-intern-sort') || 'created-desc';

// Data Migration: Ensure all old apps have a termId
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
    sortSelect.value = currentSort; // Set validation
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
    const newTerm = {
        id: crypto.randomUUID(),
        name: name
    };
    terms.push(newTerm);
    activeTermId = newTerm.id; // Switch to new term

    // Persist
    localStorage.setItem('xy-intern-terms', JSON.stringify(terms));
    localStorage.setItem('xy-intern-active-term', activeTermId);

    renderTermSelector();
    renderBoard();
    renderTimeline();
    renderFloatingBackground();
}

function deleteCurrentTerm() {
    if (terms.length <= 1) {
        alert("You must have at least one term. Create another term before deleting this one.");
        return;
    }

    const termToDelete = terms.find(t => t.id === activeTermId);
    if (!termToDelete) return;

    if (confirm(`Are you sure you want to delete "${termToDelete.name}"? This will delete all applications in this term.`)) {
        // Remove term
        terms = terms.filter(t => t.id !== activeTermId);

        // Remove applications for this term
        applications = applications.filter(app => app.termId !== activeTermId);

        // Switch to first available term
        activeTermId = terms[0].id;

        // Persist all
        localStorage.setItem('xy-intern-terms', JSON.stringify(terms));
        localStorage.setItem('xy-intern-active-term', activeTermId);
        saveToStorage(); // Saves applications

        renderTermSelector();
        renderBoard();
        renderTimeline();
        renderFloatingBackground();
    }
}

// --- Rendering ---

function renderTimeline() {
    const timelineEl = document.getElementById('timeline');

    // items with dates only
    let datedApps = applications.filter(app => app.termId === activeTermId && app.date);

    // Sort based on global currentSort
    if (currentSort === 'created-asc') {
        datedApps.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    } else {
        // Default: created-desc (Newest First)
        datedApps.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    if (datedApps.length === 0) {
        timelineEl.innerHTML = '<div class="timeline-placeholder">Add applications with dates to see your timeline here...</div>';
        return;
    }

    timelineEl.innerHTML = datedApps.map(app => `
        <div class="timeline-item" data-status="${app.status}" onclick="openEditModalById('${app.id}')">
            <div class="timeline-date">${new Date(app.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
            <div class="timeline-dot"></div>
            <div class="timeline-card">
                <div class="timeline-company">${escapeHtml(app.company)}</div>
                <div class="timeline-role">${escapeHtml(app.position)}</div>
                ${app.status === 'offer' ? '<div class="timeline-offer-check">✓</div>' : ''}
            </div>
        </div>
    `).join('');
}

function renderFloatingBackground() {
    const container = document.getElementById('bg-animation-container');
    container.innerHTML = ''; // Clear existing

    // Filter apps by ACTIVE TERM only
    const termApps = applications.filter(app => app.termId === activeTermId);
    const companies = [...new Set(termApps.map(app => app.company).filter(c => c))];

    // If few companies, duplicate them to fill space
    let tagsToRender = [...companies];
    if (tagsToRender.length < 10) {
        // Add some defaults/placeholders if empty or generic repeats
        const defaults = ['Google', 'Meta', 'Amazon', 'Startups', 'Tech', 'Netflix', 'Microsoft', 'Apple'];
        tagsToRender = [...tagsToRender, ...defaults];
    }

    // Limit to avoid DOM overload
    if (tagsToRender.length > 20) tagsToRender = tagsToRender.slice(0, 20);

    tagsToRender.forEach(company => {
        const el = document.createElement('div');
        el.classList.add('bg-company-tag');
        el.textContent = company;

        // Random Position
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        el.style.left = `${left}vw`;
        el.style.top = `${top}vh`;

        // Random Size
        const size = 3 + Math.random() * 5; // 3rem to 8rem
        el.style.fontSize = `${size}rem`;

        // Random Animation Variant
        const variant = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3
        const duration = 15 + Math.random() * 20; // 15s - 35s (Much Faster)
        const delay = Math.random() * -15; // Start random

        el.style.animation = `float-drift-${variant} ${duration}s linear ${delay}s infinite alternate`;

        // Random Rotation initial
        const rot = Math.random() * 40 - 20;
        el.style.transform = `rotate(${rot}deg)`;

        container.appendChild(el);
    });
}

function renderBoard() {
    boardEl.innerHTML = ''; // Clear board

    // Helper: Sort function
    const sortApps = (a, b) => {
        if (currentSort === 'created-asc') {
            return (a.createdAt || 0) - (b.createdAt || 0);
        }
        // Default: created-desc (Newest First)
        return (b.createdAt || 0) - (a.createdAt || 0);
    };

    COLUMNS.forEach(col => {
        const columnEl = document.createElement('div');
        columnEl.classList.add('column');
        columnEl.dataset.status = col.id; // For styling hook

        // Filter apps for this column AND current term
        let columnApps = applications.filter(app => app.status === col.id && app.termId === activeTermId);

        // Sort them
        columnApps.sort(sortApps);

        columnEl.innerHTML = `
            <div class="column-header">
                <span class="column-title" style="color: ${col.color}">
                    ${col.title}
                </span>
                <span class="count-badge">${columnApps.length}</span>
            </div>
            <div class="card-list" data-status="${col.id}">
                <!-- Cards will be here -->
            </div>
        `;

        const cardListEl = columnEl.querySelector('.card-list');

        columnApps.forEach(app => {
            const card = createCardElement(app);
            cardListEl.appendChild(card);
        });

        // Dragover events for the list area
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
    const attachmentHtml = app.fileName ? `<span title="${app.fileName}">📎</span>` : '';

    el.innerHTML = `
        <div class="card-company">${escapeHtml(app.company)}</div>
        <div class="card-role">${escapeHtml(app.position)}</div>
        <div class="card-footer">
            <div class="card-date">📅 ${dateStr}</div>
            ${attachmentHtml}
        </div>
    `;

    el.addEventListener('dragstart', handleDragStart);
    el.addEventListener('dragend', handleDragEnd);
    el.addEventListener('click', () => openEditModal(app));

    return el;
}

// --- Drag and Drop Logic ---

function handleDragStart(e) {
    draggingCardId = e.target.dataset.id;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggingCardId = null;

    // Clean up any drag-over classes just in case
    document.querySelectorAll('.card-list').forEach(el => el.classList.remove('drag-over'));
}

function handleDragOver(e) {
    e.preventDefault(); // Necessary to allow dropping
    const list = e.currentTarget;
    list.classList.add('drag-over');
    e.dataTransfer.dropEffect = 'move';
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    const list = e.currentTarget;
    list.classList.remove('drag-over');

    const newStatus = list.dataset.status;

    if (draggingCardId && newStatus) {
        updateApplicationStatus(draggingCardId, newStatus);
    }
}

// --- Data Management ---

function saveToStorage() {
    localStorage.setItem('xy-intern-apps', JSON.stringify(applications));
    renderBoard(); // Re-render to show changes
    renderTimeline();
    renderFloatingBackground();
}

function addApplication(appData) {
    const newApp = {
        id: crypto.randomUUID(),
        termId: activeTermId,
        createdAt: Date.now(), // Timestamp for sorting
        ...appData
    };
    applications.push(newApp);
    saveToStorage();
}

function updateApplication(id, updatedData) {
    const index = applications.findIndex(app => app.id === id);
    if (index !== -1) {
        applications[index] = { ...applications[index], ...updatedData };
        saveToStorage();
    }
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

const appFile = document.getElementById('app-file');
const fileDisplay = document.getElementById('file-display');
const fileNameDisplay = document.getElementById('file-name-display');
const removeFileBtn = document.getElementById('remove-file-btn');

let currentFile = null; // Store temp file name during edit

// ... (Initialization) ...

// --- Modal Handling ---

function updateFileUI(fileName) {
    if (fileName) {
        appFile.classList.add('hidden');
        fileDisplay.classList.remove('hidden');
        fileNameDisplay.textContent = fileName;
        currentFile = fileName;
    } else {
        appFile.classList.remove('hidden');
        fileDisplay.classList.add('hidden');
        appFile.value = ''; // Reset input
        currentFile = null;
    }
}

function openAddModal() {
    modalTitle.textContent = 'Add Application';
    appForm.reset();
    document.getElementById('app-id').value = '';
    // Set default date to today
    document.getElementById('date').valueAsDate = new Date();
    deleteBtn.classList.add('hidden');

    updateFileUI(null);
    currentFile = null;

    // Default status applied
    statusSelect.value = 'applied';
    statusSelect.disabled = false;
    statusSelect.style.opacity = '1';
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

    // HM Info
    document.getElementById('hm-name').value = app.hmName || '';
    document.getElementById('hm-email').value = app.hmEmail || '';
    document.getElementById('hm-linkedin').value = app.hmLinkedin || '';

    document.getElementById('status').value = app.status;
    document.getElementById('date').value = app.date;
    document.getElementById('note').value = app.note || '';

    // File UI
    currentFile = app.fileName || null;
    updateFileUI(currentFile);

    // Sync Checkbox
    if (app.status === 'rejected') {
        rejectCheckbox.checked = true;
        statusSelect.value = 'applied'; // Default visual underlying value
        statusSelect.disabled = true;
        statusSelect.style.opacity = '0.5';
    } else {
        rejectCheckbox.checked = false;
        statusSelect.value = app.status;
        statusSelect.disabled = false;
        statusSelect.style.opacity = '1';
    }

    deleteBtn.classList.remove('hidden');
    deleteBtn.onclick = () => {
        if (confirm('Are you sure you want to delete this application?')) {
            deleteApplication(app.id);
            closeModal();
        }
    };

    modalOverlay.classList.remove('hidden');
}

function closeModal() {
    modalOverlay.classList.add('hidden');
    deleteBtn.onclick = null; // Cleanup
}

// --- Event Listeners ---

function setupEventListeners() {
    // Main App Listeners
    addBtn.addEventListener('click', openAddModal);
    cancelBtn.addEventListener('click', closeModal);

    // Sync Checkbox -> Status UI
    rejectCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            statusSelect.disabled = true;
            statusSelect.style.opacity = '0.5';
        } else {
            statusSelect.disabled = false;
            statusSelect.style.opacity = '1';
        }
    });

    // Sync Status -> Checkbox
    statusSelect.addEventListener('change', (e) => {
        rejectCheckbox.checked = (e.target.value === 'rejected');
    });

    // Term Listeners
    termSelect.addEventListener('change', handleTermChange);

    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        localStorage.setItem('xy-intern-sort', currentSort);
        renderBoard();
    });

    deleteTermBtn.addEventListener('click', deleteCurrentTerm);

    addTermBtn.addEventListener('click', () => {
        termForm.reset();
        termModalOverlay.classList.remove('hidden');
    });

    cancelTermBtn.addEventListener('click', () => {
        termModalOverlay.classList.add('hidden');
    });

    termForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = termNameInput.value.trim();
        if (name) {
            addNewTerm(name);
            termModalOverlay.classList.add('hidden');
        }
    });

    // Close Modals on click outside
    window.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
        if (e.target === termModalOverlay) termModalOverlay.classList.add('hidden');
    });

    // File Listeners
    removeFileBtn.addEventListener('click', () => {
        updateFileUI(null);
    });

    appForm.addEventListener('submit', (e) => {
        e.preventDefault();

        let fileName = currentFile;
        // Check if new file selected
        if (appFile.files.length > 0) {
            fileName = appFile.files[0].name;
        }

        const getValue = (id) => {
            const el = document.getElementById(id);
            return el ? el.value : '';
        };

        // Determine status: Checkbox overrides dropdown
        let finalStatus = getValue('status');
        if (rejectCheckbox.checked) {
            finalStatus = 'rejected';
        }

        const formData = {
            company: getValue('company'),
            position: getValue('position'),
            hmName: getValue('hm-name'),
            hmEmail: getValue('hm-email'),
            hmLinkedin: getValue('hm-linkedin'),
            status: finalStatus,
            date: getValue('date'),
            note: getValue('note'),
            fileName: fileName
        };

        const id = document.getElementById('app-id').value;

        if (id) {
            updateApplication(id, formData);
        } else {
            addApplication(formData);
        }

        closeModal();
    });

    // Delete Button Handler
    deleteBtn.addEventListener('click', () => {
        const id = document.getElementById('app-id').value;
        if (id && confirm('Are you sure you want to delete this application?')) {
            deleteApplication(id);
            closeModal();
            renderBoard();
            renderTimeline();
            renderFloatingBackground();
        }
    });
}

// Utility
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- AI Assistant Logic ---

const aiToggleBtn = document.getElementById('ai-toggle-btn');
const aiChatWindow = document.getElementById('ai-chat-window');
const aiCloseBtn = document.getElementById('ai-close-btn');
const aiForm = document.getElementById('ai-form');
const aiInput = document.getElementById('ai-input');
const aiMessages = document.getElementById('ai-messages');

let activePingPong = null;

function toggleAIChat() {
    aiChatWindow.classList.toggle('hidden');
    if (!aiChatWindow.classList.contains('hidden')) {
        aiInput.focus();
    }
}

function addMessage(text, sender = 'bot') {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('ai-message', sender);
    msgDiv.innerHTML = text; // Allow simple HTML
    aiMessages.appendChild(msgDiv);
    aiMessages.scrollTop = aiMessages.scrollHeight;
    return msgDiv; // Return for game attachment
}

class PingPongGame {
    constructor(container) {
        this.container = container;
        this.canvas = document.createElement('canvas');
        this.canvas.width = container.clientWidth - 20;
        this.canvas.height = 150;
        this.canvas.style.background = 'rgba(0, 0, 0, 0.3)';
        this.canvas.style.border = '1px solid var(--glass-border)';
        this.canvas.style.borderRadius = '8px';
        this.canvas.style.display = 'block';
        this.canvas.style.margin = '10px 0';
        this.ctx = this.canvas.getContext('2d');

        this.paddleHeight = 40;
        this.paddleWidth = 6;
        this.userPaddleY = (this.canvas.height - this.paddleHeight) / 2;
        this.aiPaddleY = (this.canvas.height - this.paddleHeight) / 2;

        this.balls = [{
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            dx: 3,
            dy: 2,
            radius: 4
        }];

        this.userScore = 0;
        this.aiScore = 0;
        this.animationId = null;
        this.paused = false;
        this.showIntro = true; // Start with intro screen

        // Start Button (for intro)
        this.startBtn = document.createElement('button');
        this.startBtn.textContent = 'Start Game';
        this.startBtn.classList.add('primary-btn');
        this.startBtn.style.marginTop = '10px';
        this.startBtn.style.fontSize = '1.2rem';
        this.startBtn.style.padding = '1rem 2rem';
        this.startBtn.onclick = () => this.startGame();

        // Pause Button
        this.pauseBtn = document.createElement('button');
        this.pauseBtn.textContent = 'Pause';
        this.pauseBtn.classList.add('secondary-btn');
        this.pauseBtn.style.marginTop = '10px';
        this.pauseBtn.style.width = '100px';
        this.pauseBtn.onclick = () => this.togglePause();

        // Ball Controls
        this.btnContainer = document.createElement('div');
        this.btnContainer.style.display = 'flex';
        this.btnContainer.style.flexWrap = 'wrap';
        this.btnContainer.style.gap = '8px';
        this.btnContainer.style.marginTop = '8px';

        this.addBtn = document.createElement('button');
        this.addBtn.textContent = 'Add Ball';
        this.addBtn.classList.add('secondary-btn');
        this.addBtn.style.flex = '1';
        this.addBtn.onclick = () => this.addBall();

        this.removeBtn = document.createElement('button');
        this.removeBtn.textContent = 'Remove Ball';
        this.removeBtn.classList.add('secondary-btn');
        this.removeBtn.style.flex = '1';
        this.removeBtn.onclick = () => this.removeBall();

        this.btnContainer.appendChild(this.pauseBtn);
        this.btnContainer.appendChild(this.addBtn);
        this.btnContainer.appendChild(this.removeBtn);
        this.mousemoveHandler = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            let y = e.clientY - rect.top - this.paddleHeight / 2;
            this.userPaddleY = Math.max(0, Math.min(this.canvas.height - this.paddleHeight, y));
        };
        this.canvas.addEventListener('mousemove', this.mousemoveHandler);

        this.canvas.addEventListener('mousemove', this.mousemoveHandler);

        this.container.appendChild(this.canvas);

        // Show intro screen initially
        this.container.appendChild(this.startBtn);
        this.drawIntro();
    }

    startGame() {
        this.showIntro = false;
        this.startBtn.remove();
        this.container.appendChild(this.btnContainer);
        this.start();
    }

    togglePause() {
        this.paused = !this.paused;
        this.pauseBtn.textContent = this.paused ? 'Resume' : 'Pause';
    }

    addBall() {
        this.balls.push({
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            dx: (Math.random() > 0.5 ? 3 : -3) * (0.8 + Math.random() * 0.4),
            dy: (Math.random() > 0.5 ? 2 : -2) * (0.8 + Math.random() * 0.4),
            radius: 4
        });
    }

    removeBall() {
        if (this.balls.length > 1) {
            this.balls.pop();
        }
    }

    start() {
        const loop = () => {
            if (!this.paused) {
                this.update();
            }
            this.draw();
            this.animationId = requestAnimationFrame(loop);
        };
        this.animationId = requestAnimationFrame(loop);
    }

    stop() {
        cancelAnimationFrame(this.animationId);
        this.canvas.removeEventListener('mousemove', this.mousemoveHandler);
    }

    update() {
        // AI follows the first ball that is moving towards it
        let targetBall = this.balls.find(b => b.dx > 0) || this.balls[0];
        const aiCenter = this.aiPaddleY + this.paddleHeight / 2;
        const aiSpeed = 2.2;
        if (aiCenter < targetBall.y - 5) this.aiPaddleY += aiSpeed;
        else if (aiCenter > targetBall.y + 5) this.aiPaddleY -= aiSpeed;
        this.aiPaddleY = Math.max(0, Math.min(this.canvas.height - this.paddleHeight, this.aiPaddleY));

        this.balls.forEach(ball => {
            ball.x += ball.dx;
            ball.y += ball.dy;

            // Top/Bottom bounce
            if (ball.y + ball.radius > this.canvas.height || ball.y - ball.radius < 0) {
                ball.dy *= -1;
            }

            // User Paddle Collision
            if (ball.x - ball.radius < this.paddleWidth) {
                if (ball.y > this.userPaddleY && ball.y < this.userPaddleY + this.paddleHeight) {
                    ball.dx = Math.abs(ball.dx) * 1.05;
                } else if (ball.x < 0) {
                    this.aiScore++;
                    this.resetBall(ball);
                }
            }

            // AI Paddle Collision
            if (ball.x + ball.radius > this.canvas.width - this.paddleWidth) {
                if (ball.y > this.aiPaddleY && ball.y < this.aiPaddleY + this.paddleHeight) {
                    ball.dx = -Math.abs(ball.dx) * 1.05;
                } else if (ball.x > this.canvas.width) {
                    this.userScore++;
                    this.resetBall(ball);
                }
            }
        });
    }

    resetBall(ball) {
        ball.x = this.canvas.width / 2;
        ball.y = this.canvas.height / 2;
        ball.dx = 3 * (Math.random() > 0.5 ? 1 : -1);
        ball.dy = 2 * (Math.random() > 0.5 ? 1 : -1);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Paddles
        this.ctx.fillStyle = '#00f2ff';
        this.ctx.fillRect(0, this.userPaddleY, this.paddleWidth, this.paddleHeight);
        this.ctx.fillStyle = '#ff007a';
        this.ctx.fillRect(this.canvas.width - this.paddleWidth, this.aiPaddleY, this.paddleWidth, this.paddleHeight);

        // Balls
        this.ctx.fillStyle = '#fff';
        this.balls.forEach(ball => {
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Score
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.font = '14px Outfit';
        this.ctx.fillText(this.userScore, 40, 25);
        this.ctx.fillText(this.aiScore, this.canvas.width - 50, 25);

        // Pause Overlay
        if (this.paused) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 20px Outfit';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2 + 7);
            this.ctx.textAlign = 'start'; // Reset
        }
    }

    drawIntro() {
        // Clear canvas
        this.ctx.fillStyle = '#0f172a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // XYPingPong Title
        this.ctx.fillStyle = '#38bdf8';
        this.ctx.font = 'bold 32px Outfit';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('XYPingPong', this.canvas.width / 2, this.canvas.height / 2 - 20);

        // Subtitle
        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = '14px Outfit';
        this.ctx.fillText('Click "Start Game" to begin!', this.canvas.width / 2, this.canvas.height / 2 + 20);
        this.ctx.textAlign = 'start'; // Reset
    }
}

function processAICommand(text) {
    const lowerText = text.toLowerCase();

    // Help / Features Advertisement
    if (lowerText === 'help' || lowerText === 'commands' || lowerText === 'features') {
        return `
            <b>Available Commands:</b><br>
            • <b>"Add [Role] at [Company]"</b>: Open the application form<br>
            • <b>"Count [Status]"</b>: Get stats for a status<br>
            • <b>"Search [Company]"</b>: Find specific applications<br><br>
            🎮 <b>PING PONG!</b><br>
            Try saying <i>"play"</i> or <i>"pong"</i> to start. Our game features:<br>
            • <b>Multi-ball Mode</b>: Add more balls for higher stakes!<br>
            • <b>Pause & Resume</b>: Take a break whenever you need.<br>
            • <b>Adaptive AI</b>: Can you beat our bot?
        `;
    }

    // Start Pong Game
    const gameTriggers = ['play', 'game', 'pong', 'pingpong', 'ping pong', 'arcade', 'bored', 'fun'];
    if (gameTriggers.includes(lowerText)) {
        if (activePingPong) activePingPong.stop();

        const botMsg = addMessage("Let's play Ping Pong! Move your mouse up and down to control the cyan paddle. Check out the Add/Remove ball buttons to dial up the intensity!", 'bot');
        activePingPong = new PingPongGame(botMsg);
        return ""; // Message handled by addMessage above
    }

    // 1. ADD: "Add [Role] at [Company]"
    const addMatch = text.match(/(?:add|create|new)\s+(.*?)\s+(?:at|for)\s+(.*)/i);
    if (addMatch) {
        const position = addMatch[1].trim();
        const company = addMatch[2].trim();

        openAddModal();
        document.getElementById('company').value = company;
        document.getElementById('position').value = position;

        return `I've opened the form for <b>${position}</b> at <b>${company}</b>. Please review and save.`;
    }

    // 2. COUNT: "How many [Status]?" or "Count apps"
    if (lowerText.includes('how many') || lowerText.includes('count')) {
        if (lowerText.includes('wishlist')) return `You have ${applications.filter(a => a.status === 'wishlist' && a.termId === activeTermId).length} apps in Wishlist.`;
        if (lowerText.includes('applied')) return `You have ${applications.filter(a => a.status === 'applied' && a.termId === activeTermId).length} apps Applied.`;
        if (lowerText.includes('interview')) return `You have ${applications.filter(a => a.status === 'interviewing' && a.termId === activeTermId).length} apps in Interviewing!`;
        if (lowerText.includes('offer')) return `You have ${applications.filter(a => a.status === 'offer' && a.termId === activeTermId).length} Offers! 🎉`;
        if (lowerText.includes('reject')) return `You have ${applications.filter(a => a.status === 'rejected' && a.termId === activeTermId).length} rejections.`;

        return `You have a total of ${applications.filter(a => a.termId === activeTermId).length} applications in this term.`;
    }

    // 3. SHOW/SEARCH: "Show [Company]"
    const showMatch = text.match(/(?:show|find|search)\s+(.*)/i);
    if (showMatch) {
        const query = showMatch[1].trim().toLowerCase();

        // Check for Status keywords
        const statusMap = { 'wishlist': 'wishlist', 'applied': 'applied', 'interview': 'interviewing', 'offer': 'offer', 'rejected': 'rejected' };
        for (const [key, val] of Object.entries(statusMap)) {
            if (query.includes(key)) {
                // Scroll to column? For now, just count.
                return `Found ${applications.filter(a => a.status === val && a.termId === activeTermId).length} applications in ${val}.`;
            }
        }

        // Search by Company
        const foundApps = applications.filter(a =>
            a.termId === activeTermId &&
            (a.company.toLowerCase().includes(query) || a.position.toLowerCase().includes(query))
        );

        if (foundApps.length > 0) {
            // Highlight them? For now, list them.
            const names = foundApps.map(a => `<b>${a.company}</b> (${a.position})`).join('<br>');
            return `I found these applications:<br>${names}`;
        } else {
            return `I couldn't find any applications matching "${query}".`;
        }
    }

    // 4. SWITCH TERM
    if (lowerText.includes('switch to')) {
        const termName = text.replace(/switch to/i, '').trim();
        const term = terms.find(t => t.name.toLowerCase().includes(termName.toLowerCase()));
        if (term) {
            activeTermId = term.id;
            document.getElementById('term-select').value = activeTermId;
            localStorage.setItem('xy-intern-active-term', activeTermId);
            renderTermSelector();
            renderBoard();
            return `Switched to term: <b>${term.name}</b>.`;
        } else {
            return `I couldn't find a term named "${termName}".`;
        }
    }

    // Default Fallback
    return "I didn't capture that. Try:<br>• <i>Add [Role] at [Company]</i><br>• <i>How many applications?</i><br>• <i>Find Google</i>";
}

// AI Listeners
aiToggleBtn.addEventListener('click', toggleAIChat);
aiCloseBtn.addEventListener('click', toggleAIChat);

aiForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = aiInput.value.trim();
    if (!text) return;

    // User Message
    addMessage(text, 'user');
    aiInput.value = '';

    // Simulate Bot Delay
    setTimeout(() => {
        const response = processAICommand(text);
        if (response) addMessage(response, 'bot');
    }, 400);
});

// Run!
init();
