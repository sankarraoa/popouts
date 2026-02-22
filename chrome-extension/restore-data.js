// Restore script to import data from JSON backup into IndexedDB
// Run this in the browser console when the extension popup/sidepanel is open
// 
// Usage:
// 1. Open extension popup/sidepanel
// 2. Open browser console (F12)
// 3. Copy and paste this entire file OR use the file picker version below

// ============================================
// VERSION 1: File Picker (Recommended)
// ============================================

(function restoreFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      console.log('❌ No file selected');
      return;
    }
    
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      
      console.log('📥 Starting restore...');
      console.log(`Found ${backup.data.meetingSeries.length} meeting series`);
      console.log(`Found ${backup.data.meetingInstances.length} meeting instances`);
      console.log(`Found ${backup.data.agendaItems.length} agenda items`);
      console.log(`Found ${backup.data.actionItems.length} action items`);
      
      await restoreData(backup);
      
      document.body.removeChild(input);
    } catch (error) {
      console.error('❌ Restore failed:', error);
      document.body.removeChild(input);
    }
  };

  input.click();
})();

// ============================================
// VERSION 2: Paste JSON directly
// ============================================
// Uncomment and paste your backup JSON below:

/*
const backupJson = `PASTE_YOUR_BACKUP_JSON_HERE`;

(async function restoreFromClipboard() {
  try {
    const backup = JSON.parse(backupJson);
    await restoreData(backup);
  } catch (error) {
    console.error('❌ Restore failed:', error);
  }
})();
*/

// ============================================
// Core restore function
// ============================================

async function restoreData(backup) {
  const dbName = 'MeetingNotesDB';
  const dbVersion = 1;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    
    request.onsuccess = async (event) => {
      const db = event.target.result;
      
      try {
        // Clear existing data first
        console.log('🗑️ Clearing existing data...');
        await Promise.all([
          clearStore(db, 'meetingSeries'),
          clearStore(db, 'meetingInstances'),
          clearStore(db, 'agendaItems'),
          clearStore(db, 'actionItems')
        ]);
        
        // Import data
        console.log('📤 Importing data...');
        await Promise.all([
          importStore(db, 'meetingSeries', backup.data.meetingSeries),
          importStore(db, 'meetingInstances', backup.data.meetingInstances),
          importStore(db, 'agendaItems', backup.data.agendaItems),
          importStore(db, 'actionItems', backup.data.actionItems)
        ]);
        
        console.log('✅ Restore completed!');
        console.log(`- ${backup.data.meetingSeries.length} meeting series restored`);
        console.log(`- ${backup.data.meetingInstances.length} meeting instances restored`);
        console.log(`- ${backup.data.agendaItems.length} agenda items restored`);
        console.log(`- ${backup.data.actionItems.length} action items restored`);
        console.log('🔄 Please reload the extension to see your restored data.');
        
        resolve();
      } catch (error) {
        console.error('❌ Error during restore:', error);
        reject(error);
      }
    };
    
    request.onerror = () => {
      console.error('❌ Error opening database:', request.error);
      reject(request.error);
    };
  });
}

function clearStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function importStore(db, storeName, items) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    const promises = items.map(item => {
      return new Promise((resolveItem, rejectItem) => {
        const request = store.add(item);
        request.onsuccess = () => resolveItem();
        request.onerror = () => rejectItem(request.error);
      });
    });
    
    Promise.all(promises)
      .then(() => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      })
      .catch(reject);
  });
}
