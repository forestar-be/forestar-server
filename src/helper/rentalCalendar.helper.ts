import { google } from 'googleapis';
import { getOAuth2Client, isAuthenticated } from './authGoogle';
import logger from '../config/logger';
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

const getEventDate = (date: Date, isFullDay?: boolean) => {
  if (isFullDay) {
    const dateSplit = date
      .toLocaleString('fr-FR', {
        timeZone: 'Europe/Paris',
      })
      .split(' ');

    const dateString = dateSplit[0];
    const dataFormated = dateString.split('/').reverse().join('-'); //
    return dataFormated;
  }
  return date.toISOString();
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
  isFullDay = true,
) {
  logger.info(
    `Creating event ${eventDetails.summary} on calendar ${calendarId}`,
  );
  const calendar = getGgCalendar();
  const insertData = {
    calendarId,
    requestBody: {
      attendees: attendeesEmails?.map((email) => ({ email })),
      summary: eventDetails.summary,
      description: eventDetails.description,
      start: {
        [isFullDay ? 'date' : 'dateTime']: getEventDate(
          eventDetails.start,
          isFullDay,
        ),
        timeZone: 'Europe/Paris',
      },
      end: {
        [isFullDay ? 'date' : 'dateTime']: getEventDate(
          eventDetails.end,
          isFullDay,
        ),
        timeZone: 'Europe/Paris',
      },
    },
  };
  logger.debug(`Event details: ${JSON.stringify(insertData, null, 2)}`);
  const response = await calendar.events.insert(insertData);
  logger.info(`Event created: ${response.data.id}`);
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
  isFullDay = true,
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
        [isFullDay ? 'date' : 'dateTime']: updates.start
          ? getEventDate(updates.start, isFullDay)
          : undefined,
      },
      end: {
        [isFullDay ? 'date' : 'dateTime']: updates.end
          ? getEventDate(updates.end, isFullDay)
          : undefined,
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
