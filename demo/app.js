// AI Talent Lab — Demo App JS v2

const App = {
  currentPage: 'dashboard',
  currentPositionTab: 'pipeline',
  currentCandidateTab: 'skills',
  currentSettingsTab: 'profile',
  chatStage: 0,

  init() {
    this.navigate('dashboard');
    this.initChatInput();
    this.initModalClose();
    this.initPeriodTabs();
    this.initFunnelBars();
    this.initStarRatings();
  },

  navigate(page, opts = {}) {
    this.currentPage = page;

    // Hide all pages
    document.querySelectorAll('.page, .page-chat-full').forEach(p => {
      p.classList.remove('active');
    });

    // Show topbar for non-chat pages
    const topbar = document.getElementById('topbar');
    const pageContent = document.getElementById('pageContent');

    if (page === 'chat') {
      if (topbar) topbar.style.display = 'none';
      if (pageContent) pageContent.style.display = 'none';
      const chatPage = document.getElementById('page-chat');
      if (chatPage) chatPage.classList.add('active');
    } else {
      if (topbar) topbar.style.display = 'flex';
      if (pageContent) pageContent.style.display = 'block';
      const target = document.getElementById(`page-${page}`);
      if (target) target.classList.add('active');
    }

    // Update sidebar nav active state
    document.querySelectorAll('.nav-item[data-nav]').forEach(item => {
      item.classList.toggle('active', item.dataset.nav === page);
    });
    document.querySelectorAll('.session-item').forEach(item => {
      item.classList.remove('active');
    });
    if (page === 'chat') {
      const si = document.querySelector('.session-item');
      if (si) si.classList.add('active');
    }

    // Handle subtabs
    if (page === 'position') {
      this.switchPositionTab(opts.tab || 'pipeline');
    }
    if (page === 'candidate') {
      this.switchCandidateTab(opts.tab || 'skills');
    }
    if (page === 'settings') {
      this.switchSettingsTab(opts.tab || 'profile');
    }

    window.scrollTo(0, 0);
  },

  switchPositionTab(tab) {
    this.currentPositionTab = tab;
    document.querySelectorAll('#positionTabs .tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('[id^="pos-tab-"]').forEach(c => {
      c.classList.remove('active');
    });
    const target = document.getElementById(`pos-tab-${tab}`);
    if (target) target.classList.add('active');
  },

  switchCandidateTab(tab) {
    this.currentCandidateTab = tab;
    document.querySelectorAll('#candidateTabs .tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('[id^="cand-tab-"]').forEach(c => {
      c.classList.remove('active');
    });
    const target = document.getElementById(`cand-tab-${tab}`);
    if (target) target.classList.add('active');
  },

  switchSettingsTab(tab) {
    this.currentSettingsTab = tab;
    document.querySelectorAll('#settingsTabs .settings-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('[id^="sett-tab-"]').forEach(c => {
      c.classList.remove('active');
    });
    const target = document.getElementById(`sett-tab-${tab}`);
    if (target) target.classList.add('active');
  },

  openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('open');
  },

  closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('open');
  },

  initModalClose() {
    document.addEventListener('click', e => {
      if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('open');
      }
    });
  },

  // Chat stages
  chatMessages: [],
  chatStages: [
    { stage: 'intake', label: 'Gathering Requirements', cls: 'stage-intake' },
    { stage: 'internal', label: 'Internal Skills Check', cls: 'stage-internal' },
    { stage: 'market', label: 'Market Research', cls: 'stage-market' },
    { stage: 'variants', label: 'Choose JD Style', cls: 'stage-variants' },
    { stage: 'final', label: 'Generating JD', cls: 'stage-final' },
    { stage: 'complete', label: 'Complete', cls: 'stage-complete' },
  ],

  updateStageIndicator(stageIdx) {
    const pill = document.getElementById('stagePill');
    if (!pill) return;
    const s = this.chatStages[stageIdx];
    pill.className = `stage-pill ${s.cls}`;
    pill.innerHTML = `<span class="dot"></span>${s.label}`;
  },

  addChatMessage(role, content, type = 'text') {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    if (type === 'text') {
      const isAI = role === 'ai';
      const div = document.createElement('div');
      div.className = `msg ${isAI ? 'msg-ai' : 'msg-user'}`;
      div.innerHTML = `
        <div class="msg-avatar ${isAI ? 'ai' : 'user'}">${isAI ? '🤖' : 'SR'}</div>
        <div class="msg-bubble">${content}</div>
      `;
      container.appendChild(div);
    } else if (type === 'card') {
      const div = document.createElement('div');
      div.innerHTML = content;
      container.appendChild(div.firstElementChild);
    }

    container.scrollTop = container.scrollHeight;
  },

  initChatInput() {
    const textarea = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSend');
    if (!textarea || !sendBtn) return;

    textarea.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChatMessage();
      }
    });
    sendBtn.addEventListener('click', () => this.sendChatMessage());

    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 96) + 'px';
    });
  },

  chatStep: 0,
  sendChatMessage() {
    const textarea = document.getElementById('chatInput');
    if (!textarea) return;
    const val = textarea.value.trim();
    if (!val) return;

    this.addChatMessage('user', val);
    textarea.value = '';
    textarea.style.height = 'auto';

    // Simulate AI response based on step
    setTimeout(() => this.handleChatStep(val), 600);
  },

  handleChatStep(userMsg) {
    this.chatStep++;

    if (this.chatStep === 1) {
      // After role input — ask clarifying questions
      this.updateStageIndicator(0);
      this.addChatMessage('ai', `Got it! A few quick details:<br>
1. What's the experience range? (e.g., 3–5 years, 5–8 years)<br>
2. What are the must-have technical skills?`);
    } else if (this.chatStep === 2) {
      // After skills — ask work arrangement
      this.addChatMessage('ai', `Noted. Two more:<br>
1. Work arrangement: remote / hybrid / onsite?<br>
2. Full-time, contract, or internship?`);
    } else if (this.chatStep === 3) {
      // Confirmation summary
      this.addChatMessage('ai', `Here's what I've gathered:<br><br>
<strong>Role:</strong> Senior Python Developer<br>
<strong>Experience:</strong> 5–8 years<br>
<strong>Skills:</strong> Python, FastAPI, PostgreSQL, AWS, Docker<br>
<strong>Work type:</strong> Hybrid · Bangalore<br>
<strong>Employment:</strong> Full-time<br><br>
Does this look right?`);
    } else if (this.chatStep === 4) {
      // Show internal check card
      this.updateStageIndicator(1);
      this.addChatMessage('ai', 'Checking past roles in your organization...');
      setTimeout(() => this.showInternalCheckCard(), 800);
    } else if (this.chatStep >= 5) {
      // For demo — trigger next stage
      this.showSaveCTA();
    }
  },

  showInternalCheckCard() {
    const cardHtml = `
<div class="chat-card" style="margin-left: 40px;">
  <div class="chat-card-header">
    <span class="icon">📊</span>
    <span class="chat-card-title">Internal Skills Check</span>
  </div>
  <p class="chat-card-sub">Found in similar past Engineering roles:</p>
  <div class="card-chips" id="internalChips">
    <span class="chip chip-selectable selected" onclick="App.toggleChip(this)">Redis <small style="margin-left:2px;opacity:.6">2024</small></span>
    <span class="chip chip-selectable selected" onclick="App.toggleChip(this)">Docker <small style="margin-left:2px;opacity:.6">2024</small></span>
    <span class="chip chip-selectable" onclick="App.toggleChip(this)">MongoDB <small style="margin-left:2px;opacity:.6">2023</small></span>
    <span class="chip chip-selectable" onclick="App.toggleChip(this)">Kafka <small style="margin-left:2px;opacity:.6">2024</small></span>
  </div>
  <div class="card-actions">
    <button class="btn btn-primary btn-sm" onclick="App.acceptInternalCheck()">Accept Selected (2)</button>
    <button class="btn btn-ghost btn-sm" onclick="App.skipInternalCheck()">Skip →</button>
  </div>
</div>`;
    this.addChatMessage('', cardHtml, 'card');
  },

  toggleChip(el) {
    el.classList.toggle('selected');
  },

  acceptInternalCheck() {
    this.addChatMessage('ai', 'Added <strong>Redis, Docker</strong> to requirements. Good — these appeared in your past similar hires.');
    this.updateStageIndicator(2);
    setTimeout(() => this.showMarketResearchCard(), 700);
  },

  skipInternalCheck() {
    this.addChatMessage('ai', 'Moving to market research...');
    this.updateStageIndicator(2);
    setTimeout(() => this.showMarketResearchCard(), 700);
  },

  showMarketResearchCard() {
    const cardHtml = `
<div class="chat-card" style="margin-left: 40px;">
  <div class="chat-card-header">
    <span class="icon">🌐</span>
    <span class="chat-card-title">Market Research</span>
  </div>
  <p class="chat-card-sub">Analyzed: Google · Flipkart · Razorpay — skills they emphasize that aren't in your JD:</p>
  <div class="card-chips">
    <span class="chip chip-selectable selected" onclick="App.toggleChip(this)">GraphQL <small style="opacity:.6">2/3 companies</small></span>
    <span class="chip chip-selectable selected" onclick="App.toggleChip(this)">gRPC <small style="opacity:.6">2/3 companies</small></span>
    <span class="chip chip-selectable" onclick="App.toggleChip(this)">Terraform <small style="opacity:.6">1/3</small></span>
    <span class="chip chip-selectable" onclick="App.toggleChip(this)">K8s <small style="opacity:.6">1/3</small></span>
  </div>
  <div class="card-actions">
    <button class="btn btn-primary btn-sm" onclick="App.acceptMarketCheck()">Accept Selected (2)</button>
    <button class="btn btn-ghost btn-sm" onclick="App.acceptMarketCheck()">Skip →</button>
  </div>
</div>`;
    this.addChatMessage('', cardHtml, 'card');
  },

  acceptMarketCheck() {
    this.addChatMessage('ai', 'Added <strong>GraphQL, gRPC</strong>. These help position the role competitively.<br><br>Here are 3 JD styles based on everything we\'ve gathered:');
    this.updateStageIndicator(3);
    setTimeout(() => this.showJDVariants(), 600);
  },

  showJDVariants() {
    const cardHtml = `
<div class="jd-variants-container" style="margin-left: 40px;">
  <div class="jd-variant-card">
    <div class="jvc-label">Skill-Focused</div>
    <div class="jvc-title">Technical & Precise</div>
    <div class="jvc-desc">Leads with the technical stack, certifications, and hard requirements. Attracts specialist engineers.</div>
    <div class="jvc-meta">12 skills listed · Formal tone</div>
    <button class="jvc-select btn btn-sm" onclick="App.selectVariant(this, 'skill-focused')">Select This →</button>
  </div>
  <div class="jd-variant-card">
    <div class="jvc-label">Outcome-Focused</div>
    <div class="jvc-title">Impact & Growth</div>
    <div class="jvc-desc">Leads with what the person will build and achieve. Attracts ambitious, mission-driven candidates.</div>
    <div class="jvc-meta">8 skills listed · Inspiring tone</div>
    <button class="jvc-select btn btn-sm" onclick="App.selectVariant(this, 'outcome-focused')">Select This →</button>
  </div>
  <div class="jd-variant-card">
    <div class="jvc-label">Hybrid</div>
    <div class="jvc-title">Balanced & Modern</div>
    <div class="jvc-desc">Balanced mix of skills, outcomes, and culture. Widest candidate appeal. Recommended for senior roles.</div>
    <div class="jvc-meta">10 skills listed · Modern tone</div>
    <button class="jvc-select btn btn-sm" onclick="App.selectVariant(this, 'hybrid')">Select This →</button>
  </div>
</div>`;
    this.addChatMessage('', cardHtml, 'card');
  },

  selectVariant(btn, type) {
    // Highlight selected
    btn.closest('.jd-variants-container').querySelectorAll('.jd-variant-card').forEach(c => c.classList.remove('selected'));
    btn.closest('.jd-variant-card').classList.add('selected');

    this.updateStageIndicator(4);
    this.addChatMessage('ai', `Great choice! Using the <strong>${type.replace('-', ' ')}</strong> style. Generating your JD...`);
    setTimeout(() => this.showFinalJD(), 900);
  },

  showBiasCheck() {
    const cardHtml = `
<div class="chat-card bias-card" style="margin-left: 40px;">
  <div class="chat-card-header">
    <span class="icon">🔍</span>
    <span class="chat-card-title">Bias Check — 2 suggestions</span>
  </div>
  <p class="chat-card-sub">AI found potentially exclusionary phrases in your JD:</p>
  <div style="display:flex;flex-direction:column;gap:8px;margin:12px 0;">
    <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-md);padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
      <div>
        <span style="font-size:12.5px;color:var(--danger);">"rockstar developer"</span>
        <span style="color:var(--text-tertiary);font-size:12px;margin:0 6px;">→</span>
        <span style="font-size:12.5px;color:var(--success);">"exceptional developer"</span>
      </div>
      <button class="btn btn-sm" style="background:var(--success-dim);color:var(--success);border:1px solid var(--success);border-radius:var(--radius-sm);padding:3px 10px;font-size:11.5px;font-weight:700;" onclick="this.textContent='✅ Fixed'">Fix</button>
    </div>
    <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-md);padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
      <div>
        <span style="font-size:12.5px;color:var(--danger);">"fast-paced environment"</span>
        <span style="color:var(--text-tertiary);font-size:12px;margin:0 6px;">→</span>
        <span style="font-size:12.5px;color:var(--success);">"iterative delivery"</span>
      </div>
      <button class="btn btn-sm" style="background:var(--success-dim);color:var(--success);border:1px solid var(--success);border-radius:var(--radius-sm);padding:3px 10px;font-size:11.5px;font-weight:700;" onclick="this.textContent='✅ Fixed'">Fix</button>
    </div>
  </div>
  <div class="card-actions">
    <button class="btn btn-ghost btn-sm" onclick="this.closest('.chat-card').style.opacity='.5';this.closest('.chat-card').style.pointerEvents='none';">Dismiss</button>
  </div>
</div>`;
    this.addChatMessage('', cardHtml, 'card');
  },

  showFinalJD() {
    const cardHtml = `
<div class="jd-final-card" style="margin-left: 40px;">
  <div class="jd-final-header">
    <span>📄 Your Job Description</span>
    <button class="btn btn-ghost btn-sm" style="color:var(--accent-light);">Edit ✏️</button>
  </div>
  <div class="jd-final-body">
    <h3># Senior Python Developer</h3>
    <h3>## About TechCorp</h3>
    <p>We are a fast-growing technology company building next-generation AI tools, empowering businesses through intelligent automation.</p>
    <h3>## Role Overview</h3>
    <p>We're looking for a Senior Python Developer to join our Engineering team. You'll architect and build our core backend services, drive technical decisions, and mentor junior engineers.</p>
    <h3>## Requirements</h3>
    <ul>
      <li>5–8 years of Python engineering experience</li>
      <li>Deep expertise in FastAPI and async programming</li>
      <li>PostgreSQL, Redis, Docker proficiency</li>
      <li>AWS infrastructure experience</li>
      <li>GraphQL and gRPC exposure preferred</li>
    </ul>
  </div>
  <div class="jd-final-actions">
    <button class="btn btn-ghost btn-sm">📋 Copy</button>
    <button class="btn btn-ghost btn-sm">📥 PDF</button>
    <button class="btn btn-primary btn-sm" onclick="App.openModal('setupModal')">💾 Save & Find Candidates</button>
  </div>
</div>`;
    this.addChatMessage('', cardHtml, 'card');
    this.updateStageIndicator(5);
    setTimeout(() => this.showBiasCheck(), 800);
    const saveBtn = document.getElementById('chatSaveBtn');
    if (saveBtn) saveBtn.disabled = false;
  },

  showSaveCTA() {
    this.addChatMessage('ai', 'Your JD is ready. Click <strong>Save & Find Candidates</strong> to create the position and start the background search.');
  },

  saveChatPosition() {
    this.openModal('setupModal');
  },

  confirmSetup() {
    this.closeModal('setupModal');
    this.showToast('Position created! Candidate search running in background.', '✅');
    setTimeout(() => this.navigate('position'), 1200);
  },

  // Period tabs
  initPeriodTabs() {
    document.querySelectorAll('.period-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        tab.closest('.period-tabs').querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      });
    });
  },

  // Funnel bars — animate on load
  initFunnelBars() {
    const bars = document.querySelectorAll('.funnel-bar');
    bars.forEach(bar => {
      const target = bar.dataset.width || '0%';
      setTimeout(() => { bar.style.width = target; }, 300);
    });
  },

  // Star ratings for panel page
  initStarRatings() {
    document.querySelectorAll('.stars').forEach(group => {
      const stars = group.querySelectorAll('.star');
      stars.forEach((star, idx) => {
        star.addEventListener('click', () => {
          stars.forEach((s, i) => s.classList.toggle('active', i <= idx));
        });
        star.addEventListener('mouseover', () => {
          stars.forEach((s, i) => s.style.opacity = i <= idx ? '1' : '0.3');
        });
        star.addEventListener('mouseout', () => {
          stars.forEach(s => s.style.opacity = '');
        });
      });
    });
  },

  showToast(msg, icon = 'ℹ️') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.querySelector('.toast-msg').textContent = msg;
    toast.querySelector('.toast-icon').textContent = icon;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
