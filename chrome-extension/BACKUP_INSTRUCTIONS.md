# How to Backup Your Meeting Notes Data

Your extension stores data in **IndexedDB** (a browser database). Here are several ways to backup your data:

## Method 1: Using the Backup Script (Recommended)

1. Open the extension popup or sidepanel
2. Open the browser console:
   - **Chrome**: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows/Linux)
   - Go to the **Console** tab
3. Copy and paste the following code:

```javascript
(async function backupData() {
  try {
    // Access the database directly
    const dbName = 'MeetingNotesDB';
    const dbVersion = 1;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      
      request.onsuccess = async (event) => {
        const db = event.target.result;
        
        const backup = {
          timestamp: new Date().toISOString(),
          version: '1.0',
          data: {
            meetingSeries: [],
            meetingInstances: [],
            agendaItems: [],
            actionItems: []
          }
        };
        
        // Export meetingSeries
        const seriesStore = db.transaction('meetingSeries', 'readonly').objectStore('meetingSeries');
        const seriesRequest = seriesStore.getAll();
        seriesRequest.onsuccess = () => {
          backup.data.meetingSeries = seriesRequest.result;
          
          // Export meetingInstances
          const instancesStore = db.transaction('meetingInstances', 'readonly').objectStore('meetingInstances');
          const instancesRequest = instancesStore.getAll();
          instancesRequest.onsuccess = () => {
            backup.data.meetingInstances = instancesRequest.result;
            
            // Export agendaItems
            const agendaStore = db.transaction('agendaItems', 'readonly').objectStore('agendaItems');
            const agendaRequest = agendaStore.getAll();
            agendaRequest.onsuccess = () => {
              backup.data.agendaItems = agendaRequest.result;
              
              // Export actionItems
              const actionsStore = db.transaction('actionItems', 'readonly').objectStore('actionItems');
              const actionsRequest = actionsStore.getAll();
              actionsRequest.onsuccess = () => {
                backup.data.actionItems = actionsRequest.result;
                
                // Create download
                const jsonString = JSON.stringify(backup, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `meeting-notes-backup-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                console.log('✅ Backup completed!');
                console.log(`- ${backup.data.meetingSeries.length} meeting series`);
                console.log(`- ${backup.data.meetingInstances.length} meeting instances`);
                console.log(`- ${backup.data.agendaItems.length} agenda items`);
                console.log(`- ${backup.data.actionItems.length} action items`);
                
                resolve(backup);
              };
              actionsRequest.onerror = () => reject(actionsRequest.error);
            };
            agendaRequest.onerror = () => reject(agendaRequest.error);
          };
          instancesRequest.onerror = () => reject(instancesRequest.error);
        };
        seriesRequest.onerror = () => reject(seriesRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
})();
```

4. Press Enter to run the script
5. A JSON file will be automatically downloaded with all your data

## Method 2: Manual File System Backup

Chrome stores IndexedDB data in a specific folder. The location depends on your operating system:

### macOS
```
~/Library/Application Support/Google/Chrome/Default/IndexedDB/
```

### Windows
```
%LOCALAPPDATA%\Google\Chrome\User Data\Default\IndexedDB\
```
Or:
```
C:\Users\<YourUsername>\AppData\Local\Google\Chrome\User Data\Default\IndexedDB\
```

### Linux
```
~/.config/google-chrome/Default/IndexedDB/
```

**To find your extension's database:**
1. Look for a folder starting with `chrome-extension_` followed by your extension ID
2. Inside, look for `MeetingNotesDB` folder
3. Copy the entire `MeetingNotesDB` folder

**Note:** Extension IDs change when you reload an unpacked extension, so this method is less reliable.

## Method 3: Using Chrome DevTools

1. Open Chrome DevTools (`F12`)
2. Go to **Application** tab (or **Storage** in older Chrome)
3. In the left sidebar, expand **IndexedDB**
4. Click on `MeetingNotesDB`
5. You can view and export data from each table manually

## Restoring Data

To restore from a JSON backup file:

### Step 1: Prepare the Backup File

1. Make sure you have your backup JSON file (e.g., `meeting-notes-backup-2026-02-22.json`)
2. Open the file and copy its entire contents

### Step 2: Run the Restore Script

1. Open your extension popup or sidepanel
2. Press `F12` (or `Cmd+Option+I` on Mac) to open DevTools
3. Go to the **Console** tab
4. First, paste this code to create a file input:

```javascript
// Create file input for selecting backup file
const input = document.createElement('input');
input.type = 'file';
input.accept = '.json';
input.style.display = 'none';
document.body.appendChild(input);

input.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const text = await file.text();
  const backup = JSON.parse(text);
  
  console.log('📥 Starting restore...');
  console.log(`Found ${backup.data.meetingSeries.length} meeting series`);
  console.log(`Found ${backup.data.meetingInstances.length} meeting instances`);
  console.log(`Found ${backup.data.agendaItems.length} agenda items`);
  console.log(`Found ${backup.data.actionItems.length} action items`);
  
  const dbName = 'MeetingNotesDB';
  const dbVersion = 1;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      
      // Clear existing data first (optional - comment out if you want to merge instead)
      const clearPromises = [
        db.transaction('meetingSeries', 'readwrite').objectStore('meetingSeries').clear(),
        db.transaction('meetingInstances', 'readwrite').objectStore('meetingInstances').clear(),
        db.transaction('agendaItems', 'readwrite').objectStore('agendaItems').clear(),
        db.transaction('actionItems', 'readwrite').objectStore('actionItems').clear()
      ];
      
      Promise.all(clearPromises).then(() => {
        console.log('🗑️ Cleared existing data');
        
        // Import meetingSeries
        const seriesStore = db.transaction('meetingSeries', 'readwrite').objectStore('meetingSeries');
        const seriesPromises = backup.data.meetingSeries.map(item => seriesStore.add(item));
        Promise.all(seriesPromises).then(() => {
          console.log(`✅ Imported ${backup.data.meetingSeries.length} meeting series`);
          
          // Import meetingInstances
          const instancesStore = db.transaction('meetingInstances', 'readwrite').objectStore('meetingInstances');
          const instancesPromises = backup.data.meetingInstances.map(item => instancesStore.add(item));
          Promise.all(instancesPromises).then(() => {
            console.log(`✅ Imported ${backup.data.meetingInstances.length} meeting instances`);
            
            // Import agendaItems
            const agendaStore = db.transaction('agendaItems', 'readwrite').objectStore('agendaItems');
            const agendaPromises = backup.data.agendaItems.map(item => agendaStore.add(item));
            Promise.all(agendaPromises).then(() => {
              console.log(`✅ Imported ${backup.data.agendaItems.length} agenda items`);
              
              // Import actionItems
              const actionsStore = db.transaction('actionItems', 'readwrite').objectStore('actionItems');
              const actionsPromises = backup.data.actionItems.map(item => actionsStore.add(item));
              Promise.all(actionsPromises).then(() => {
                console.log(`✅ Imported ${backup.data.actionItems.length} action items`);
                console.log('🎉 Restore completed! Please reload the extension to see your data.');
                
                document.body.removeChild(input);
                resolve();
              }).catch(err => {
                console.error('❌ Error importing action items:', err);
                reject(err);
              });
            }).catch(err => {
              console.error('❌ Error importing agenda items:', err);
              reject(err);
            });
          }).catch(err => {
            console.error('❌ Error importing meeting instances:', err);
            reject(err);
          });
        }).catch(err => {
          console.error('❌ Error importing meeting series:', err);
          reject(err);
        });
      }).catch(err => {
        console.error('❌ Error clearing existing data:', err);
        reject(err);
      });
    };
    
    request.onerror = () => {
      console.error('❌ Error opening database:', request.error);
      reject(request.error);
    };
  });
};

input.click();
```

5. Press Enter
6. Select your backup JSON file from the file picker
7. Wait for the restore to complete
8. **Reload the extension** (click the refresh icon in `chrome://extensions/`) to see your restored data

### Alternative: Restore from Clipboard

If you prefer to paste the JSON directly instead of selecting a file:

```javascript
// Paste your backup JSON string here
const backupJson = `PASTE_YOUR_BACKUP_JSON_HERE`;

(async function restoreFromClipboard() {
  const backup = JSON.parse(backupJson);
  
  console.log('📥 Starting restore...');
  console.log(`Found ${backup.data.meetingSeries.length} meeting series`);
  
  const dbName = 'MeetingNotesDB';
  const dbVersion = 1;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      
      // Clear existing data
      Promise.all([
        db.transaction('meetingSeries', 'readwrite').objectStore('meetingSeries').clear(),
        db.transaction('meetingInstances', 'readwrite').objectStore('meetingInstances').clear(),
        db.transaction('agendaItems', 'readwrite').objectStore('agendaItems').clear(),
        db.transaction('actionItems', 'readwrite').objectStore('actionItems').clear()
      ]).then(() => {
        // Import all data
        Promise.all([
          Promise.all(backup.data.meetingSeries.map(item => 
            db.transaction('meetingSeries', 'readwrite').objectStore('meetingSeries').add(item)
          )),
          Promise.all(backup.data.meetingInstances.map(item => 
            db.transaction('meetingInstances', 'readwrite').objectStore('meetingInstances').add(item)
          )),
          Promise.all(backup.data.agendaItems.map(item => 
            db.transaction('agendaItems', 'readwrite').objectStore('agendaItems').add(item)
          )),
          Promise.all(backup.data.actionItems.map(item => 
            db.transaction('actionItems', 'readwrite').objectStore('actionItems').add(item)
          ))
        ]).then(() => {
          console.log('🎉 Restore completed! Please reload the extension.');
          resolve();
        }).catch(reject);
      }).catch(reject);
    };
    request.onerror = () => reject(request.error);
  });
})();
```

**Important Notes:**
- ⚠️ **Warning**: The restore script will **clear all existing data** before importing. Make sure you have a backup if you want to keep current data!
- The backup JSON file contains all your meeting notes, agenda items, and action items
- Keep backups in a safe place
- The backup file is human-readable JSON, so you can also inspect/edit it if needed
- For unpacked extensions, the extension ID changes on reload, so Method 1 (script) is most reliable
- After restoring, **reload the extension** to see your data
