// Build meeting_details JSON for LLM APIs (same shape as action extraction).

import { db } from '../db.js';
import { getNotesByDate } from '../notes.js';
import { getAgendaItems } from '../agenda.js';
import { getActionItems } from '../actions.js';
import { coerceMeetingId } from '../meetings.js';

/**
 * Full meeting payload including every note in the series (for interview summary, etc.).
 * @param {number|string} meetingId
 * @returns {Promise<object|null>}
 */
export async function getMeetingDetailsAllNotes(meetingId) {
  meetingId = coerceMeetingId(meetingId);
  const meeting = await db.meetingSeries.get(meetingId);
  if (!meeting) return null;

  const agendaItems = await getAgendaItems(meetingId);
  const existingActions = await getActionItems(meetingId);
  const notesByDate = await getNotesByDate(meetingId);

  const notesPayload = [];
  notesByDate.forEach((dateGroup) => {
    dateGroup.notes.forEach((note) => {
      notesPayload.push({
        text: note.text,
        created_at: note.createdAt ? new Date(note.createdAt).toISOString() : null,
        updated_at: note.updatedAt ? new Date(note.updatedAt).toISOString() : null
      });
    });
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const instances = await db.meetingInstances.where('seriesId').equals(meetingId).toArray();

  let instance = instances.find((inst) => {
    const instDate = new Date(inst.date);
    instDate.setHours(0, 0, 0, 0);
    return instDate.getTime() === today.getTime();
  });

  if (!instance && instances.length > 0) {
    const sorted = [...instances].sort((a, b) => new Date(b.date) - new Date(a.date));
    instance = sorted[0];
  }

  if (!instance) {
    instance = {
      id: `instance-${Date.now()}`,
      seriesId: meetingId,
      date: today,
      notes: []
    };
  }

  return {
    meeting_series: {
      id: meeting.id.toString(),
      name: meeting.name,
      type: meeting.type,
      created_at: meeting.createdAt ? new Date(meeting.createdAt).toISOString() : null
    },
    meeting_instance: {
      id: instance.id.toString(),
      series_id: meetingId.toString(),
      date: instance.date ? new Date(instance.date).toISOString() : null,
      notes: notesPayload,
      created_at: instance.createdAt ? new Date(instance.createdAt).toISOString() : null
    },
    agenda_items: agendaItems.map((item) => ({
      id: item.id.toString(),
      series_id: meetingId.toString(),
      text: item.text,
      status: item.status,
      created_at: item.createdAt ? new Date(item.createdAt).toISOString() : null,
      closed_at: item.closedAt ? new Date(item.closedAt).toISOString() : null
    })),
    existing_actions: existingActions.map((action) => ({
      text: action.text
    }))
  };
}
