// AI Talent Lab Prototype JS

const state = {
  currentPage: 'dashboard',
  currentDataId: null
};

// Navigation Flow
function navigateTo(pageId, dataId = null) {
  state.currentPage = pageId;
  state.currentDataId = dataId;

  // 1. Update active states on sidebar nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelectorAll('.session-item').forEach(item => {
    item.classList.remove('active');
  });

  // Activate the clicked item if it maps directly to nav
  const directNav = document.querySelector(`.nav-item[data-nav="${pageId}"]`);
  if (directNav) {
    directNav.classList.add('active');
  } else if (pageId === 'chat' && dataId) {
    const sessionNav = document.querySelector(`.session-item[data-id="${dataId}"]`);
    if (sessionNav) {
      sessionNav.classList.add('active');
    }
  }

  // 2. Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  // 3. Show target page
  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) {
    targetPage.classList.add('active');
    
    // Optional callbacks per page
    if (pageId === 'chat' && typeof initChat === 'function') {
      initChat(dataId);
    }
  } else {
    console.error(`Page ${pageId} not found`);
  }
}

// Modal handling
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

// Close modals on clicking overlay outside
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// Initialize app with correct starting state (e.g., from URL hash)
window.addEventListener('DOMContentLoaded', () => {
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const parts = hash.split('/');
    navigateTo(parts[0], parts[1]);
  } else {
    navigateTo('dashboard');
  }
});

// Generic Tab Switcher
function switchTab(containerId, tabId, tabPrefix) {
  // Update tab UI
  const container = document.getElementById(containerId);
  if (container) {
    container.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    // Find the clicked tab (assuming it has onclick handler containing the tabId)
    const activeTab = Array.from(container.querySelectorAll('.tab')).find(t => t.getAttribute('onclick').includes(`'${tabId}'`));
    if (activeTab) activeTab.classList.add('active');
  }

  // Update content
  document.querySelectorAll(`[id^="${tabPrefix}"]`).forEach(content => content.classList.remove('active'));
  const targetContent = document.getElementById(`${tabPrefix}${tabId}`);
  if (targetContent) targetContent.classList.add('active');
}

function switchPositionTab(tabId) {
  switchTab('positionTabs', tabId, 'pos-tab-');
}

function switchCandidateTab(tabId) {
  switchTab('candidateTabs', tabId, 'cand-tab-');
}

function switchSettingsTab(tabId) {
  switchTab('settingsTabs', tabId, 'sett-tab-');
}

// Simple debouncer for inputs
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
