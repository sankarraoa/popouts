// Notes tab module
import { addNote, getNotesByDate } from '../notes.js';
import { state } from './state.js';
import { isToday } from './utils.js';

// Placeholder for elements object, will be passed from main orchestrator
let elements = {};
// Placeholder for updateCounts callback
let updateCountsCallback = null;

export function setNotesDependencies(els, updateCountsCb) {
  elements = els;
  updateCountsCallback = updateCountsCb;
}

// Load notes grouped by date
export async function loadNotes() {
  try {
    console.log('=== loadNotes called ===');
    console.log('currentMeetingId:', state.currentMeetingId);
    
    if (!state.currentMeetingId) {
      console.log('No currentMeetingId, returning');
      return;
    }
    
    if (!elements.notesContainer) {
      console.error('notesContainer element not found!');
      return;
    }
    
    const notesByDate = await getNotesByDate(state.currentMeetingId);
    console.log('notesByDate:', notesByDate);
    console.log('notesByDate.length:', notesByDate.length);
    
    elements.notesContainer.innerHTML = '';
    
    const notesEmptyState = document.getElementById('notes-empty-state');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    
    // Check if we have a "Today" card in the existing notes
    const hasTodayCard = notesByDate.some(dateGroup => {
      const cardDate = new Date(dateGroup.date);
      cardDate.setHours(0, 0, 0, 0);
      return cardDate.toISOString() === todayISO;
    });
    
    if (notesByDate.length === 0) {
      // Show empty state and ensure input field is present and functional
      console.log('No notes found, showing empty state');
      // Hide notes container when showing empty state
      if (elements.notesContainer) {
        elements.notesContainer.style.display = 'none';
      }
      if (notesEmptyState) {
        notesEmptyState.style.display = 'flex';
        
        // Update the count to show "0 notes" when empty
        const countElement = notesEmptyState.querySelector('.notes-empty-card-count');
        if (countElement) {
          countElement.textContent = '0 notes';
        }
        
        // Find the input row
        const inputRow = notesEmptyState.querySelector('.notes-empty-input-row');
        if (inputRow) {
          // Get or create bullet
          let bullet = inputRow.querySelector('.notes-empty-bullet');
          if (!bullet) {
            bullet = document.createElement('span');
            bullet.className = 'notes-empty-bullet';
            bullet.textContent = '1.';
            inputRow.insertBefore(bullet, inputRow.firstChild);
          }
          
          // Remove any existing input or placeholder
          const existingInput = inputRow.querySelector('.notes-input');
          const existingPlaceholder = inputRow.querySelector('.notes-empty-placeholder');
          if (existingInput) {
            existingInput.remove();
          }
          if (existingPlaceholder) {
            existingPlaceholder.remove();
          }
          
          // Always create a fresh input field
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'notes-input';
          input.placeholder = 'Type a note, press Enter...';
          input.value = ''; // Ensure it's empty
          input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
              await addNote(state.currentMeetingId, e.target.value.trim());
              await loadNotes();
              if (updateCountsCallback) {
                await updateCountsCallback();
              }
            }
          });
          
          // Focus the input when empty state is shown
          setTimeout(() => {
            input.focus();
          }, 100);
          
          // Append input after bullet
          inputRow.appendChild(input);
        }
      }
      console.log('Notes loaded successfully (empty state)');
      return;
    }
    
    // Show notes container and hide empty state when we have notes
    if (elements.notesContainer) {
      elements.notesContainer.style.display = 'flex';
    }
    
    // Hide empty state since we have notes
    console.log('Notes found, hiding empty state');
    if (notesEmptyState) notesEmptyState.style.display = 'none';
    
    // Always create a "Today" card with input field if it doesn't exist (insert at the beginning)
    console.log('hasTodayCard:', hasTodayCard);
    if (!hasTodayCard) {
      console.log('Creating Today card with input field');
      const todayCard = createDateCard({
        date: today,
        instanceId: null,
        notes: []
      });
      // Insert at the beginning (top) so it appears first
      elements.notesContainer.insertBefore(todayCard, elements.notesContainer.firstChild);
    } else {
      console.log('Today card already exists, not creating duplicate');
    }
    
    // Render existing date cards (these will appear after the Today card if it was just created)
    console.log('Rendering', notesByDate.length, 'date cards');
    notesByDate.forEach((dateGroup, index) => {
      console.log(`Rendering card ${index + 1}:`, dateGroup.date, 'with', dateGroup.notes.length, 'notes');
      const card = createDateCard(dateGroup);
      elements.notesContainer.appendChild(card);
    });
    
    console.log('Notes loaded successfully');
  } catch (error) {
    console.error('Error loading notes:', error);
    console.error('Stack:', error.stack);
  }
}

// Create a date card element
function createDateCard(dateGroup) {
  const isTodayCard = isToday(dateGroup.date);
  const card = document.createElement('div');
  card.className = `notes-date-card ${isTodayCard ? 'notes-date-card-today' : ''}`;
  
  // Card header
  const header = document.createElement('div');
  header.className = 'notes-date-card-header';
  
  const calendarIcon = document.createElement('div');
  calendarIcon.className = 'notes-date-card-icon';
  if (isTodayCard) {
    calendarIcon.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 2.5H9C9.27614 2.5 9.5 2.72386 9.5 3V9.5C9.5 9.77614 9.27614 10 9 10H3C2.72386 10 2.5 9.77614 2.5 9.5V3C2.5 2.72386 2.72386 2.5 3 2.5Z" stroke="rgba(3, 2, 19, 0.2)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2.5 4.5H9.5" stroke="rgba(3, 2, 19, 0.2)" stroke-width="0.8" stroke-linecap="round"/>
        <path d="M4.5 2V3.5" stroke="rgba(3, 2, 19, 0.2)" stroke-width="0.8" stroke-linecap="round"/>
        <path d="M7.5 2V3.5" stroke="rgba(3, 2, 19, 0.2)" stroke-width="0.8" stroke-linecap="round"/>
      </svg>
    `;
  } else {
    calendarIcon.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 2.5H9C9.27614 2.5 9.5 2.72386 9.5 3V9.5C9.5 9.77614 9.27614 10 9 10H3C2.72386 10 2.5 9.77614 2.5 9.5V3C2.5 2.72386 2.72386 2.5 3 2.5Z" stroke="rgba(3, 2, 19, 0.2)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2.5 4.5H9.5" stroke="rgba(3, 2, 19, 0.2)" stroke-width="0.8" stroke-linecap="round"/>
        <path d="M4.5 2V3.5" stroke="rgba(3, 2, 19, 0.2)" stroke-width="0.8" stroke-linecap="round"/>
        <path d="M7.5 2V3.5" stroke="rgba(3, 2, 19, 0.2)" stroke-width="0.8" stroke-linecap="round"/>
      </svg>
    `;
  }
  
  const date = document.createElement('span');
  date.className = 'notes-date-card-date';
  const dateObj = typeof dateGroup.date === 'string' ? new Date(dateGroup.date) : dateGroup.date;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const cardDate = new Date(dateObj);
  cardDate.setHours(0, 0, 0, 0);
  
  if (cardDate.getTime() === now.getTime()) {
    date.textContent = 'Today';
  } else {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (cardDate.getTime() === yesterday.getTime()) {
      date.textContent = 'Yesterday';
    } else {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      date.textContent = `${days[cardDate.getDay()]}, ${months[cardDate.getMonth()]} ${cardDate.getDate()}, ${cardDate.getFullYear()}`;
    }
  }
  
  const count = document.createElement('span');
  count.className = 'notes-date-card-count';
  count.textContent = `${dateGroup.notes.length} ${dateGroup.notes.length === 1 ? 'note' : 'notes'}`;
  
  header.appendChild(calendarIcon);
  header.appendChild(date);
  header.appendChild(count);
  
  // Card content
  const content = document.createElement('div');
  content.className = 'notes-date-card-content';
  
  // Sort notes by creation time (oldest first)
  const sortedNotes = [...dateGroup.notes].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return timeA - timeB;
  });
  
  // Render existing notes
  sortedNotes.forEach((note, index) => {
    const noteRow = createNoteRow(note, index, index, dateGroup.date, isTodayCard);
    content.appendChild(noteRow);
  });
  
  // Add input row for today's card
  if (isTodayCard) {
    const nextNumber = sortedNotes.length + 1;
    const inputRow = createNoteInputRow(nextNumber);
    content.appendChild(inputRow);
  }
  
  card.appendChild(header);
  card.appendChild(content);
  
  return card;
}

// Create a note row element
function createNoteRow(note, displayIndex, originalIndex, date, isEditable) {
  const row = document.createElement('div');
  row.className = 'notes-note-row';
  
  const bullet = document.createElement('span');
  bullet.className = 'notes-note-bullet';
  bullet.textContent = `${displayIndex + 1}.`;
  
  const text = document.createElement('div');
  text.className = 'notes-note-text';
  text.textContent = note.text;
  
  if (isEditable) {
    text.contentEditable = true;
    text.addEventListener('blur', async () => {
      const newText = text.textContent.trim();
      if (newText !== note.text && newText) {
        // Update note
        const { updateNote } = await import('../notes.js');
        await updateNote(state.currentMeetingId, originalIndex, newText, date);
        await loadNotes();
        if (updateCountsCallback) {
          await updateCountsCallback();
        }
      } else if (!newText) {
        // Restore original text if empty
        text.textContent = note.text;
      }
    });
    
    text.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        text.blur();
      }
    });
  }
  
  row.appendChild(bullet);
  row.appendChild(text);
  
  return row;
}

// Create input row for adding new notes
function createNoteInputRow(nextNumber) {
  const row = document.createElement('div');
  row.className = 'notes-input-row';
  
  const bullet = document.createElement('span');
  bullet.className = 'notes-input-bullet';
  bullet.textContent = `${nextNumber}.`;
  
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'notes-input';
  input.placeholder = 'Type a note, press Enter...';
  
  input.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      const noteText = e.target.value.trim();
      e.target.value = '';
      await addNote(state.currentMeetingId, noteText);
      await loadNotes();
      if (updateCountsCallback) {
        await updateCountsCallback();
      }
    }
  });
  
  row.appendChild(bullet);
  row.appendChild(input);
  
  return row;
}
