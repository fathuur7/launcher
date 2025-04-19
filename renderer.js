// renderer.js
document.addEventListener('DOMContentLoaded', () => {
  console.log("API available:", window.api);
  if (!window.api) {
    console.error("API not available. Check preload script configuration.");
    return;
  }
  
  // DOM Elements
  const searchInput = document.getElementById('search-input');
  const resultsList = document.getElementById('results-list');
  const addButton = document.getElementById('add-button');
  const addForm = document.getElementById('add-form');
  const cancelButton = document.getElementById('cancel-button');
  const saveButton = document.getElementById('save-button');
  
  // Application state
  let shortcuts = [];
  let selectedIndex = -1;
  
  // Load shortcuts
  loadShortcuts();
  
  // Search input event
  searchInput.addEventListener('input', () => {
    filterShortcuts();
  });
  
  // Handle keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectNextItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectPreviousItem();
    } else if (e.key === 'Enter' && !e.ctrlKey) {
      e.preventDefault();
      executeSelectedShortcut();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      const query = searchInput.value;
      if (query) {
        window.api.queryGoogle(query);
        searchInput.value = '';  // Clear the input after search
      }
    } else if (e.key === 'Escape') {
      searchInput.value = '';
      filterShortcuts();
      window.api.hideWindow();
    }
  });
  
  // Add shortcut button
  addButton.addEventListener('click', () => {
    addForm.style.display = 'block';
    document.getElementById('shortcut-name').focus();
  });
  
  // Cancel button
  cancelButton.addEventListener('click', () => {
    addForm.style.display = 'none';
    clearForm();
  });
  
  // Save button
  saveButton.addEventListener('click', async () => {
    const name = document.getElementById('shortcut-name').value.trim();
    const type = document.getElementById('shortcut-type').value;
    const path = document.getElementById('shortcut-path').value.trim();
    
    if (!name || !path) {
      alert('Please fill all fields');
      return;
    }
    
    const newShortcut = { name, type, path };
    shortcuts = await window.api.addShortcut(newShortcut);
    
    addForm.style.display = 'none';
    clearForm();
    renderShortcuts();
  });
  
  async function loadShortcuts() {
    try {
      shortcuts = await window.api.getShortcuts();
      console.log("Shortcuts loaded:", shortcuts);
      renderShortcuts();
    } catch (error) {
      console.error("Error loading shortcuts:", error);
    }
  }
  
  function renderShortcuts() {
    resultsList.innerHTML = '';
    
    shortcuts.forEach((shortcut, index) => {
      const item = document.createElement('div');
      item.className = 'shortcut-item';
      item.dataset.index = index;
      
      const iconChar = shortcut.icon || shortcut.name.charAt(0).toUpperCase();
      
      item.innerHTML = `
        <div class="shortcut-icon">${iconChar}</div>
        <div class="shortcut-details">
          <div class="shortcut-name">${shortcut.name}</div>
          <div class="shortcut-path">${shortcut.path}</div>
          <div class="shortcut-type">${getTypeLabel(shortcut.type)}</div>
          <div class="shortcut-actions">
            <button class="delete-button" data-index="${index}">Delete</button>
          </div>
        </div>
      `;
      
      item.addEventListener('click', () => {
        executeShortcut(shortcut);
      });
      
      resultsList.appendChild(item);
    });
  }
  
  // for deleting shortcuts
  resultsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-button')) {
      const index = parseInt(e.target.dataset.index);
      window.api.deleteShortcut(index);
      shortcuts.splice(index, 1);
      renderShortcuts();
      // Update the selected index if the deleted item was selected
      if (selectedIndex === index) {
        selectedIndex = -1;
        updateSelectedItem();
      }
    }
  });


  function getTypeLabel(type) {
    const types = {
      'app': 'Application',
      'url': 'Website',
      'command': 'Command',
      'folder': 'Folder'
    };
    return types[type] || type;
  }
  
  function filterShortcuts() {
    const query = searchInput.value.toLowerCase();
    
    if (!query) {
      // Show all shortcuts when search is empty
      renderShortcuts();
      selectedIndex = -1;
      updateSelectedItem();
      return;
    }
    
    const filteredItems = document.querySelectorAll('.shortcut-item');
    let visibleCount = 0;
    
    filteredItems.forEach((item) => {
      const index = parseInt(item.dataset.index);
      const shortcut = shortcuts[index];
      const matches = shortcut.name.toLowerCase().includes(query) || 
                      shortcut.path.toLowerCase().includes(query);
      
      item.style.display = matches ? 'flex' : 'none';
      if (matches) visibleCount++;
    });
    
    // Reset selection
    selectedIndex = visibleCount > 0 ? 0 : -1;
    updateSelectedItem();
  }
  
  function selectNextItem() {
    const visibleItems = Array.from(resultsList.querySelectorAll('.shortcut-item'))
      .filter(item => item.style.display !== 'none');
      
    if (visibleItems.length === 0) return;
    
    selectedIndex = (selectedIndex + 1) % visibleItems.length;
    updateSelectedItem();
  }
  
  function selectPreviousItem() {
    const visibleItems = Array.from(resultsList.querySelectorAll('.shortcut-item'))
      .filter(item => item.style.display !== 'none');
      
    if (visibleItems.length === 0) return;
    
    selectedIndex = selectedIndex <= 0 ? visibleItems.length - 1 : selectedIndex - 1;
    updateSelectedItem();
  }
  
  function updateSelectedItem() {
    const items = resultsList.querySelectorAll('.shortcut-item');
    items.forEach(item => item.classList.remove('selected'));
    
    const visibleItems = Array.from(items).filter(item => item.style.display !== 'none');
    if (selectedIndex >= 0 && selectedIndex < visibleItems.length) {
      visibleItems[selectedIndex].classList.add('selected');
      visibleItems[selectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
  
  function executeSelectedShortcut() {
    const visibleItems = Array.from(resultsList.querySelectorAll('.shortcut-item'))
      .filter(item => item.style.display !== 'none');
      
    if (selectedIndex >= 0 && selectedIndex < visibleItems.length) {
      const index = parseInt(visibleItems[selectedIndex].dataset.index);
      executeShortcut(shortcuts[index]);
    } else if (searchInput.value.trim()) {
      // If no item is selected but there's a search query, perform a Google search
      window.api.queryGoogle(searchInput.value);
      searchInput.value = '';
    }
  }
  
  async function executeShortcut(shortcut) {
    try {
      await window.api.executeShortcut(shortcut);
      searchInput.value = '';
      filterShortcuts();
    } catch (error) {
      console.error("Error executing shortcut:", error);
    }
  }
  
  function clearForm() {
    document.getElementById('shortcut-name').value = '';
    document.getElementById('shortcut-type').value = 'app';
    document.getElementById('shortcut-path').value = '';
  }
  
  // Initialize add form as hidden
  addForm.style.display = 'none';
  
  // Focus input on load
  searchInput.focus();
});