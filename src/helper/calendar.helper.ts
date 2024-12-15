import { calendar_v3, google } from 'googleapis';
const calendarId = process.env.GOOGLE_CALENDAR_ID;

if (!calendarId) {
  throw new Error('GOOGLE_CALENDAR_ID environment variable is required');
}

if (!process.env.KEY_FILE) {
  throw new Error('KEY_FILE environment variable is required');
}

const calendar = google.calendar({
  version: 'v3',
  auth: new google.auth.GoogleAuth({
    keyFile: process.env.KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  }),
});

const getEventDate = (date: Date) =>
  date
    .toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris',
    })
    .split(' ')[0]
    .split('/')
    .reverse()
    .join('-');

export async function createEvent(eventDetails: {
  summary: string;
  description: string;
  start: Date;
  end: Date;
}) {
  const response = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: eventDetails.summary,
      description: eventDetails.description,
      start: {
        date: getEventDate(eventDetails.start),
      },
      end: {
        date: getEventDate(eventDetails.end),
      },
    },
  });
  return response.data.id; // Return the created event ID
}

export async function updateEvent(
  eventId: string,
  updates: Partial<{
    summary: string;
    description: string;
    start: Date;
    end: Date;
  }>,
) {
  await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: {
      summary: updates.summary,
      description: updates.description,
      start: {
        date: updates.start ? getEventDate(updates.start) : undefined,
      },
      end: {
        date: updates.end ? getEventDate(updates.end) : undefined,
      },
    },
  });
}

export async function deleteEvent(eventId: string) {
  await calendar.events.delete({
    calendarId,
    eventId,
  });
}
