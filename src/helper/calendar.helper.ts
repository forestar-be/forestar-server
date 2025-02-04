import { google } from 'googleapis';
import { getOAuth2Client, isAuthenticated } from './authGoogle';
export const calendarEntretienId: string =
  process.env.GOOGLE_CALENDAR_ENTRETIEN_ID!;
export const calendarRentalId: string = process.env.GOOGLE_CALENDAR_RENTAL_ID!;

if (!calendarEntretienId) {
  throw new Error(
    'GOOGLE_CALENDAR_ENTRETIEN_ID environment variable is required',
  );
}

if (!calendarRentalId) {
  throw new Error('GOOGLE_CALENDAR_RENTAL_ID environment variable is required');
}

if (!process.env.KEY_FILE) {
  throw new Error('KEY_FILE environment variable is required');
}

// we use calendar api authenticated with google oauth2 instead of service account
// because only google workspace accounts are allowed to add attendees to events with service account
const getGgCalendar = () => {
  if (!isAuthenticated()) {
    throw new Error('Google Calendar is not authenticated');
  }

  return google.calendar({
    version: 'v3',
    auth: getOAuth2Client(),
  });
};

const getEventDate = (date: Date) => {
  return date
    .toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris',
    })
    .split(' ')[0]
    .split('/')
    .reverse()
    .join('-');
};

export async function createEvent(
  eventDetails: {
    summary: string;
    description: string;
    start: Date;
    end: Date;
  },
  calendarId: string,
  attendeesEmails?: string[],
) {
  const calendar = getGgCalendar();
  const response = await calendar.events.insert({
    calendarId,
    requestBody: {
      attendees: attendeesEmails?.map((email) => ({ email })),
      summary: eventDetails.summary,
      description: eventDetails.description,
      start: {
        date: getEventDate(eventDetails.start),
        timeZone: 'Europe/Paris',
      },
      end: {
        date: getEventDate(eventDetails.end),
        timeZone: 'Europe/Paris',
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
  calendarId: string,
  attendeesEmails?: string[],
) {
  const calendar = getGgCalendar();
  await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: {
      attendees: attendeesEmails?.map((email) => ({ email })),
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

export async function deleteEvent(eventId: string, calendarId: string) {
  const calendar = getGgCalendar();
  await calendar.events.delete({
    calendarId,
    eventId,
  });
}

export const getEvent = async (eventId: string, calendarId: string) => {
  const calendar = getGgCalendar();
  const response = await calendar.events.get({
    calendarId,
    eventId,
  });
  return response.data;
};

export const getEventsFromIdList = async (
  eventIdList: string[],
  calendarId: string,
) => {
  const calendar = getGgCalendar();
  const promises = eventIdList.map((eventId) =>
    calendar.events.get({
      calendarId,
      eventId,
    }),
  );
  return await Promise.all(promises);
};
