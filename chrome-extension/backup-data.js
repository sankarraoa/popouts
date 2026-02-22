// Backup script to export all data from IndexedDB to JSON
// Run this in the browser console when the extension popup/sidepanel is open

(async function backupData() {
  try {
    // Import the database (assuming it's accessible)
    const { db } = await import('./js/db.js');
    
    // Wait for database to be ready
    await db.open();
    
    // Export all data
    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: {
        meetingSeries: await db.meetingSeries.toArray(),
        meetingInstances: await db.meetingInstances.toArray(),
        agendaItems: await db.agendaItems.toArray(),
        actionItems: await db.actionItems.toArray()
      }
    };
    
    // Convert to JSON string
    const jsonString = JSON.stringify(backup, null, 2);
    
    // Create download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-notes-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('✅ Backup completed! File downloaded.');
    console.log('Backup contains:');
    console.log(`- ${backup.data.meetingSeries.length} meeting series`);
    console.log(`- ${backup.data.meetingInstances.length} meeting instances`);
    console.log(`- ${backup.data.agendaItems.length} agenda items`);
    console.log(`- ${backup.data.actionItems.length} action items`);
    
    return backup;
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
})();
