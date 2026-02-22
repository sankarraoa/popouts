// Notes tab module
import { addNote, getNotesByDate } from '../notes.js';
import { state } from './state.js';
import { isToday } from './utils.js';
import { actionExtractionService } from './action-extraction.js';

// Placeholder for elements object, will be passed from main orchestrator
let elements = {};
// Placeholder for updateCounts callback
let updateCountsCallback = null;

// Helper function to safely set cursor position in contentEditable element
function setCursorToEnd(element) {
  if (!element || !element.isConnected) {
    return false;
  }
  try {
    element.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false); // Collapse to end
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  } catch (err) {
    console.warn('Error setting cursor position:', err);
    // Fallback: just focus
    try {
      element.focus();
    } catch (focusErr) {
      console.warn('Error focusing element:', focusErr);
    }
    return false;
  }
}

// Pagination state - based on date cards, not individual notes
const INITIAL_CARDS = 4; // Initial number of date cards to show
const CARDS_PER_PAGE = 2; // Additional cards per "Show More" click
let currentNotesPage = 1;
let allNotesByDate = [];

export function setNotesDependencies(els, updateCountsCb) {
  elements = els;
  updateCountsCallback = updateCountsCb;
}

// Load notes grouped by date
export async function loadNotes(resetPagination = true) {
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
    
    // Reset pagination when filter/search changes
    if (resetPagination) {
      currentNotesPage = 1;
    }
    
    const notesByDate = await getNotesByDate(state.currentMeetingId);
    console.log('notesByDate:', notesByDate);
    console.log('notesByDate.length:', notesByDate.length);
    
    // Store all notes for pagination
    allNotesByDate = notesByDate;
    
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
          
          // Always create a fresh input field (textarea for multi-line)
          const input = document.createElement('textarea');
          input.className = 'notes-input';
          input.placeholder = 'Type a note, press Enter...';
          input.value = ''; // Ensure it's empty
          input.rows = 1;
          
          // Auto-resize textarea
          const autoResize = (textarea) => {
            textarea.style.height = 'auto';
            const newHeight = Math.min(textarea.scrollHeight, 200); // Max height 200px
            textarea.style.height = newHeight + 'px';
          };
          
          input.addEventListener('input', () => {
            autoResize(input);
          });
          
          input.addEventListener('keydown', async (e) => {
            // Enter submits and moves to next note
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (e.target.value.trim()) {
              await addNote(state.currentMeetingId, e.target.value.trim());
                e.target.value = '';
                e.target.style.height = 'auto';
              await loadNotes();
              if (updateCountsCallback) {
                await updateCountsCallback();
              }
                // Focus the next input FIRST, before any async operations that might interfere
                // Use multiple timeouts to ensure DOM is fully updated and stable
                setTimeout(() => {
                  const focusNextInput = () => {
                    const todayCard = document.querySelector('.notes-date-card-today');
                    if (todayCard && todayCard.isConnected) {
                      // Get the last input row (which is the new one created after adding the note)
                      const allInputRows = todayCard.querySelectorAll('.notes-input-row');
                      if (allInputRows.length > 0) {
                        const lastInputRow = allInputRows[allInputRows.length - 1];
                        const nextInput = lastInputRow.querySelector('.notes-input');
                        if (nextInput && nextInput.isConnected) {
                          // Ensure the input is visible and scroll into view if needed
                          nextInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                          // Use requestAnimationFrame to ensure DOM is fully updated
                          requestAnimationFrame(() => {
                            // Double-check the input is still connected
                            if (nextInput.isConnected) {
                              // Focus and set cursor position
                              nextInput.focus();
                              // Set cursor to start of input - use setTimeout to ensure focus is complete
                              setTimeout(() => {
                                if (nextInput.isConnected && nextInput.setSelectionRange) {
                                  nextInput.setSelectionRange(0, 0);
                                }
                                // Force focus again to ensure cursor is visible
                                if (nextInput.isConnected) {
                                  nextInput.focus();
                                  autoResize(nextInput);
                                }
                              }, 10);
                            }
                          });
                          return true;
                        }
                      }
                    }
                    return false;
                  };
                  
                  // Try to focus immediately
                  if (!focusNextInput()) {
                    // If not found, try again after a short delay
                    setTimeout(() => {
                      focusNextInput();
                    }, 50);
                  }
                }, 150);
                
                // Schedule action extraction AFTER focusing (fire-and-forget, don't await)
                if (state.currentMeetingId) {
                  console.log(`[NotesTab] Scheduling extraction for meeting ${state.currentMeetingId} (empty state)`);
                  // Don't await - let it run in background
                  actionExtractionService.scheduleExtraction(state.currentMeetingId).catch(err => {
                    console.error('[NotesTab] Error scheduling extraction:', err);
                  });
                  
                  // Also check all meetings for unprocessed notes (fire-and-forget)
                  console.log(`[NotesTab] Checking all meetings for unprocessed notes...`);
                  actionExtractionService.checkAllMeetingsForExtraction().catch(err => {
                    console.error('[NotesTab] Error checking all meetings:', err);
                  });
                }
              }
            }
            // Shift+Enter creates new line within the same note (default textarea behavior)
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
    
    // Calculate pagination based on date cards
    const totalCards = notesByDate.length;
    const cardsToShow = INITIAL_CARDS + (currentNotesPage - 1) * CARDS_PER_PAGE;
    
    // Render date cards with pagination
    let cardsRendered = 0;
    
    console.log('Rendering notes with pagination. Total cards:', totalCards, 'Cards to show:', cardsToShow);
    
    // Get Show More container - try multiple ways to find it BEFORE removing
    let showMoreContainer = document.getElementById('notes-show-more');
    if (!showMoreContainer && elements.notesContainer) {
      // Try finding it relative to notes container
      const notesView = elements.notesContainer.closest('#notes-view');
      if (notesView) {
        showMoreContainer = notesView.querySelector('#notes-show-more');
      }
    }
    if (!showMoreContainer) {
      // Try finding it anywhere in the document
      showMoreContainer = document.querySelector('#notes-show-more');
    }
    
    // Remove existing "Show More" button from container if it's already there
    // But preserve the reference if we found it
    const existingShowMore = elements.notesContainer.querySelector('#notes-show-more');
    if (existingShowMore) {
      // If we already have a reference, use it; otherwise use the one we found
      if (!showMoreContainer) {
        showMoreContainer = existingShowMore;
      }
      existingShowMore.remove();
    }
    
    // If still not found, try one more time after removal
    if (!showMoreContainer) {
      showMoreContainer = document.getElementById('notes-show-more');
    }
    
    for (let i = 0; i < notesByDate.length && i < cardsToShow; i++) {
      const dateGroup = notesByDate[i];
      const cardNotesCount = dateGroup.notes.length;
      
      console.log(`Rendering card ${cardsRendered + 1}:`, dateGroup.date, 'with', cardNotesCount, 'notes');
      const card = createDateCard(dateGroup);
      elements.notesContainer.appendChild(card);
      cardsRendered++;
    }
    
    // Append "Show More" button right after the last card if there are more cards
    console.log('Show More check: cardsRendered =', cardsRendered, 'totalCards =', totalCards, 'showMoreContainer =', showMoreContainer);
    if (cardsRendered < totalCards) {
      if (!showMoreContainer && elements.notesContainer) {
        // Create the Show More container if it doesn't exist
        showMoreContainer = document.createElement('div');
        showMoreContainer.id = 'notes-show-more';
        showMoreContainer.className = 'notes-show-more';
        const button = document.createElement('button');
        button.className = 'notes-show-more-button';
        button.textContent = 'Show More';
        showMoreContainer.appendChild(button);
        console.log('Created Show More container dynamically');
      }
      
      if (showMoreContainer && elements.notesContainer) {
        console.log('Showing Show More button');
        showMoreContainer.style.display = 'flex';
        // Append to notes container so it scrolls with content and appears right after last card
        elements.notesContainer.appendChild(showMoreContainer);
      } else {
        console.warn('Show More container or notes container not found!', {
          showMoreContainer: !!showMoreContainer,
          notesContainer: !!elements.notesContainer
        });
      }
    } else {
      console.log('All cards rendered, hiding Show More button');
      if (showMoreContainer) {
        showMoreContainer.style.display = 'none';
      }
    }
    
    console.log('Notes loaded successfully. Rendered:', cardsRendered, 'of', totalCards, 'date cards');
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
      const { updateNote, deleteNote } = await import('../notes.js');
      
      if (!newText) {
        // Delete note if empty
        await deleteNote(state.currentMeetingId, originalIndex, date);
        await loadNotes();
        if (updateCountsCallback) {
          await updateCountsCallback();
        }
        // Schedule action extraction for this meeting AND check all meetings
        if (state.currentMeetingId) {
          console.log(`[NotesTab] Scheduling extraction for meeting ${state.currentMeetingId} (note deleted)`);
          actionExtractionService.scheduleExtraction(state.currentMeetingId).catch(err => {
            console.error('[NotesTab] Error scheduling extraction:', err);
          });
          actionExtractionService.checkAllMeetingsForExtraction().catch(err => {
            console.error('[NotesTab] Error checking all meetings:', err);
          });
        }
      } else if (newText !== note.text) {
        // Update note if text changed
        await updateNote(state.currentMeetingId, originalIndex, newText, date);
        await loadNotes();
        if (updateCountsCallback) {
          await updateCountsCallback();
        }
        // Schedule action extraction for this meeting AND check all meetings
        if (state.currentMeetingId) {
          console.log(`[NotesTab] Scheduling extraction for meeting ${state.currentMeetingId} (note updated)`);
          actionExtractionService.scheduleExtraction(state.currentMeetingId).catch(err => {
            console.error('[NotesTab] Error scheduling extraction:', err);
          });
          actionExtractionService.checkAllMeetingsForExtraction().catch(err => {
            console.error('[NotesTab] Error checking all meetings:', err);
          });
        }
      }
    });
    
    text.addEventListener('keydown', async (e) => {
      // Enter key - move to next note or input row
      if (e.key === 'Enter') {
        e.preventDefault();
        
        // Save current note first
        const currentText = text.textContent.trim();
        if (currentText !== note.text) {
          const { updateNote } = await import('../notes.js');
          await updateNote(state.currentMeetingId, originalIndex, currentText, date);
          await loadNotes();
          if (updateCountsCallback) {
            await updateCountsCallback();
          }
        }
        
        // Find next note or input row
        const todayCard = row.closest('.notes-date-card-today');
        if (todayCard) {
          const allRows = todayCard.querySelectorAll('.notes-note-row, .notes-input-row');
          let nextRow = null;
          
          for (let i = 0; i < allRows.length; i++) {
            if (allRows[i] === row && i < allRows.length - 1) {
              nextRow = allRows[i + 1];
              break;
            }
          }
          
          if (nextRow) {
            // Focus next note or input
            const nextNoteText = nextRow.querySelector('.notes-note-text');
            const nextInput = nextRow.querySelector('.notes-input');
            
            setTimeout(() => {
              if (nextNoteText && nextNoteText.isConnected) {
                try {
                  nextNoteText.focus();
                  const range = document.createRange();
                  const sel = window.getSelection();
                  range.selectNodeContents(nextNoteText);
                  range.collapse(false); // Collapse to end
                  sel.removeAllRanges();
                  sel.addRange(range);
                } catch (err) {
                  console.warn('Error setting cursor position:', err);
                  // Fallback: just focus
                  nextNoteText.focus();
                }
              } else if (nextInput && nextInput.isConnected) {
                nextInput.focus();
                if (nextInput.setSelectionRange) {
                  nextInput.setSelectionRange(0, 0);
                }
              }
            }, 50);
          }
        }
        return;
      }
      
      // Arrow Up - move to previous note
      if (e.key === 'ArrowUp') {
        const todayCard = row.closest('.notes-date-card-today');
        if (todayCard) {
          const allRows = todayCard.querySelectorAll('.notes-note-row, .notes-input-row');
          let prevRow = null;
          
          for (let i = 0; i < allRows.length; i++) {
            if (allRows[i] === row && i > 0) {
              prevRow = allRows[i - 1];
              break;
            }
          }
          
          if (prevRow) {
            e.preventDefault();
            const prevNoteText = prevRow.querySelector('.notes-note-text');
            const prevInput = prevRow.querySelector('.notes-input');
            
            setTimeout(() => {
              if (prevNoteText && prevNoteText.isConnected) {
                setCursorToEnd(prevNoteText);
              } else if (prevInput && prevInput.isConnected) {
                prevInput.focus();
                if (prevInput.setSelectionRange) {
                  const textLength = prevInput.value.length;
                  prevInput.setSelectionRange(textLength, textLength);
                }
              }
            }, 10);
          }
        }
        return;
      }
      
      // Arrow Down - move to next note
      if (e.key === 'ArrowDown') {
        const todayCard = row.closest('.notes-date-card-today');
        if (todayCard) {
          const allRows = todayCard.querySelectorAll('.notes-note-row, .notes-input-row');
          let nextRow = null;
          
          for (let i = 0; i < allRows.length; i++) {
            if (allRows[i] === row && i < allRows.length - 1) {
              nextRow = allRows[i + 1];
              break;
            }
          }
          
          if (nextRow) {
            e.preventDefault();
            const nextNoteText = nextRow.querySelector('.notes-note-text');
            const nextInput = nextRow.querySelector('.notes-input');
            
            setTimeout(() => {
              if (nextNoteText && nextNoteText.isConnected) {
                setCursorToEnd(nextNoteText);
              } else if (nextInput && nextInput.isConnected) {
                nextInput.focus();
                if (nextInput.setSelectionRange) {
                  nextInput.setSelectionRange(0, 0);
                }
              }
            }, 10);
          }
        }
        return;
      }
      
      // Backspace at start of empty note - delete the note
      if (e.key === 'Backspace') {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const isAtStart = range.startOffset === 0 && range.endOffset === 0;
          const isEmpty = text.textContent.trim() === '';
          
          if (isAtStart && isEmpty) {
            e.preventDefault();
            const { deleteNote } = await import('../notes.js');
            await deleteNote(state.currentMeetingId, originalIndex, date);
            await loadNotes();
            if (updateCountsCallback) {
              await updateCountsCallback();
            }
            
            // Focus previous note or input
            const todayCard = row.closest('.notes-date-card-today');
            if (todayCard) {
              const allRows = todayCard.querySelectorAll('.notes-note-row, .notes-input-row');
              let prevRow = null;
              
              for (let i = 0; i < allRows.length; i++) {
                if (allRows[i] === row && i > 0) {
                  prevRow = allRows[i - 1];
                  break;
                }
              }
              
              if (prevRow) {
                setTimeout(() => {
                  const prevNoteText = prevRow.querySelector('.notes-note-text');
                  const prevInput = prevRow.querySelector('.notes-input');
                  
                  if (prevNoteText && prevNoteText.isConnected) {
                    setCursorToEnd(prevNoteText);
                  } else if (prevInput && prevInput.isConnected) {
                    prevInput.focus();
                    if (prevInput.setSelectionRange) {
                      const textLength = prevInput.value.length;
                      prevInput.setSelectionRange(textLength, textLength);
                    }
                  }
                }, 50);
              }
            }
            
            // Schedule action extraction
            if (state.currentMeetingId) {
              actionExtractionService.scheduleExtraction(state.currentMeetingId).catch(err => {
                console.error('[NotesTab] Error scheduling extraction:', err);
              });
              actionExtractionService.checkAllMeetingsForExtraction().catch(err => {
                console.error('[NotesTab] Error checking all meetings:', err);
              });
            }
            return;
          }
        }
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
  
  const input = document.createElement('textarea');
  input.className = 'notes-input';
  input.placeholder = 'Type a note, press Enter...';
  input.rows = 1;
  
  // Auto-resize textarea
  const autoResize = (textarea) => {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 200); // Max height 200px
    textarea.style.height = newHeight + 'px';
  };
  
  input.addEventListener('input', () => {
    autoResize(input);
  });
  
  input.addEventListener('keydown', async (e) => {
    // Arrow Up - move to previous note
    if (e.key === 'ArrowUp') {
      const currentRow = e.target.closest('.notes-input-row');
      const todayCard = currentRow?.closest('.notes-date-card-today');
      if (todayCard) {
        const allRows = todayCard.querySelectorAll('.notes-note-row, .notes-input-row');
        let prevRow = null;
        
        for (let i = 0; i < allRows.length; i++) {
          if (allRows[i] === currentRow && i > 0) {
            prevRow = allRows[i - 1];
            break;
          }
        }
        
        if (prevRow) {
          e.preventDefault();
          const prevNoteText = prevRow.querySelector('.notes-note-text');
          const prevInput = prevRow.querySelector('.notes-input');
          
          setTimeout(() => {
            if (prevNoteText && prevNoteText.isConnected) {
              setCursorToEnd(prevNoteText);
            } else if (prevInput && prevInput.isConnected) {
              prevInput.focus();
              if (prevInput.setSelectionRange) {
                const textLength = prevInput.value.length;
                prevInput.setSelectionRange(textLength, textLength);
              }
            }
          }, 10);
        }
      }
      return;
    }
    
    // Arrow Down - move to next note (shouldn't happen in input row, but handle it)
    if (e.key === 'ArrowDown') {
      const currentRow = e.target.closest('.notes-input-row');
      const todayCard = currentRow?.closest('.notes-date-card-today');
      if (todayCard) {
        const allRows = todayCard.querySelectorAll('.notes-note-row, .notes-input-row');
        let nextRow = null;
        
        for (let i = 0; i < allRows.length; i++) {
          if (allRows[i] === currentRow && i < allRows.length - 1) {
            nextRow = allRows[i + 1];
            break;
          }
        }
        
        if (nextRow) {
          e.preventDefault();
          const nextNoteText = nextRow.querySelector('.notes-note-text');
          const nextInput = nextRow.querySelector('.notes-input');
          
          setTimeout(() => {
            if (nextNoteText && nextNoteText.isConnected) {
              setCursorToEnd(nextNoteText);
            } else if (nextInput && nextInput.isConnected) {
              nextInput.focus();
              if (nextInput.setSelectionRange) {
                nextInput.setSelectionRange(0, 0);
              }
            }
          }, 10);
        }
      }
      return;
    }
    
    // Backspace at start of empty input - delete this note row and move to previous note
    if (e.key === 'Backspace' && e.target.value === '' && e.target.selectionStart === 0 && e.target.selectionEnd === 0) {
      e.preventDefault();
      
      // Find the current input row
      const currentRow = e.target.closest('.notes-input-row');
      if (currentRow) {
        const currentBullet = currentRow.querySelector('.notes-input-bullet');
        const currentNumber = currentBullet ? parseInt(currentBullet.textContent.replace('.', '')) : null;
        
        // Find the previous note row (not input row)
        const todayCard = currentRow.closest('.notes-date-card-today');
        if (todayCard && currentNumber !== null && currentNumber > 1) {
          const allRows = todayCard.querySelectorAll('.notes-note-row, .notes-input-row');
          let previousNoteRow = null;
          
          // Find the note row that comes before this input row
          for (let i = 0; i < allRows.length; i++) {
            if (allRows[i] === currentRow && i > 0) {
              // Check if previous row is a note row
              const prevRow = allRows[i - 1];
              if (prevRow.classList.contains('notes-note-row')) {
                previousNoteRow = prevRow;
                break;
              }
            }
          }
          
          if (previousNoteRow) {
            // Get the note text element from previous row
            const previousNoteText = previousNoteRow.querySelector('.notes-note-text');
            if (previousNoteText) {
              // Remove the current input row
              currentRow.remove();
              
              // Focus the previous note and move cursor to end
              setTimeout(() => {
                if (previousNoteText && previousNoteText.isConnected) {
                  setCursorToEnd(previousNoteText);
                }
              }, 10);
            }
          }
        }
      }
      return;
    }
    
    // Enter submits and moves to next note
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (e.target.value.trim()) {
      const noteText = e.target.value.trim();
      e.target.value = '';
        e.target.style.height = 'auto';
      await addNote(state.currentMeetingId, noteText);
      await loadNotes();
      if (updateCountsCallback) {
        await updateCountsCallback();
      }
        
        // Focus the next input FIRST, before any async operations that might interfere
        // Use multiple timeouts to ensure DOM is fully updated and stable
        setTimeout(() => {
          const focusNextInput = () => {
            const todayCard = document.querySelector('.notes-date-card-today');
            if (todayCard && todayCard.isConnected) {
              // Get the last input row (which is the new one created after adding the note)
              const allInputRows = todayCard.querySelectorAll('.notes-input-row');
              if (allInputRows.length > 0) {
                const lastInputRow = allInputRows[allInputRows.length - 1];
                const nextInput = lastInputRow.querySelector('.notes-input');
                if (nextInput && nextInput.isConnected) {
                  // Ensure the input is visible and scroll into view if needed
                  nextInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  // Use requestAnimationFrame to ensure DOM is fully updated
                  requestAnimationFrame(() => {
                    // Double-check the input is still connected
                    if (nextInput.isConnected) {
                      // Focus and set cursor position
                      nextInput.focus();
                      // Set cursor to start of input - use setTimeout to ensure focus is complete
                      setTimeout(() => {
                        if (nextInput.isConnected && nextInput.setSelectionRange) {
                          nextInput.setSelectionRange(0, 0);
                        }
                        // Force focus again to ensure cursor is visible
                        if (nextInput.isConnected) {
                          nextInput.focus();
                          autoResize(nextInput);
                        }
                      }, 10);
                    }
                  });
                  return true;
                }
              }
            }
            return false;
          };
          
          // Try to focus immediately
          if (!focusNextInput()) {
            // If not found, try again after a short delay
            setTimeout(() => {
              focusNextInput();
            }, 50);
          }
        }, 150);
        
        // Schedule action extraction AFTER focusing (fire-and-forget, don't await)
        if (state.currentMeetingId) {
          console.log(`[NotesTab] Scheduling extraction for meeting ${state.currentMeetingId} (note edit)`);
          // Don't await - let it run in background
          actionExtractionService.scheduleExtraction(state.currentMeetingId).catch(err => {
            console.error('[NotesTab] Error scheduling extraction:', err);
          });
          
          // Also check all meetings for unprocessed notes (fire-and-forget)
          console.log(`[NotesTab] Checking all meetings for unprocessed notes...`);
          actionExtractionService.checkAllMeetingsForExtraction().catch(err => {
            console.error('[NotesTab] Error checking all meetings:', err);
          });
        }
      }
    }
    // Shift+Enter creates new line within the same note (default textarea behavior)
  });
  
  row.appendChild(bullet);
  row.appendChild(input);
  
  return row;
}

// Handle "Show More" button click
export async function handleShowMoreNotes() {
  currentNotesPage++;
  await loadNotes(false); // Don't reset pagination
}
