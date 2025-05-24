import { google } from 'googleapis';
import { getOAuth2Client, isAuthenticated } from './authGoogle';
import logger from '../config/logger';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(timezone);
dayjs.extend(utc);

export const calendarEntretienId: string =
  process.env.GOOGLE_CALENDAR_ENTRETIEN_ID!;
export const calendarRentalId: string = process.env.GOOGLE_CALENDAR_RENTAL_ID!;

// Check if any required environment variables are missing
const requiredEnvVars = [
  'GOOGLE_CALENDAR_GENERAL_ID',
  'GOOGLE_CALENDAR_GENERAL_NAME',
  'GOOGLE_CALENDAR_ENTRETIEN_ID',
  'GOOGLE_CALENDAR_RENTAL_ID',
  'GOOGLE_CALENDAR_PURCHASE_ORDERS_ID',
  'CALENDAR_ID_PHONE_CALLBACKS',
  'KEY_FILE',
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});

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

// Available calendars with their metadata
export const AVAILABLE_CALENDARS = [
  {
    id: process.env.GOOGLE_CALENDAR_GENERAL_ID!,
    name: process.env.GOOGLE_CALENDAR_GENERAL_NAME!,
    color: '#000000',
  },
  {
    id: process.env.GOOGLE_CALENDAR_ENTRETIEN_ID!,
    name: 'Entretien',
    color: '#4285F4',
  },
  {
    id: process.env.GOOGLE_CALENDAR_RENTAL_ID!,
    name: 'Location',
    color: '#0F9D58',
  },
  {
    id: process.env.GOOGLE_CALENDAR_PURCHASE_ORDERS_ID!,
    name: 'Commandes',
    color: '#DB4437',
  },
  {
    id: process.env.CALENDAR_ID_PHONE_CALLBACKS!,
    name: 'Rappels téléphoniques',
    color: '#F4B400',
  },
];

// Get available calendars
export async function getCalendars() {
  try {
    // Return the predefined calendars
    return AVAILABLE_CALENDARS;
  } catch (error) {
    logger.error('Error fetching calendars:', error);
    throw error;
  }
}

// Get events for specific calendars on a specific date
export async function getCalendarEvents(calendarIds: string[], date: string) {
  const calendar = getGgCalendar();

  try {
    // Use dayjs for cleaner date handling
    const requestDate = dayjs(date).tz('Europe/Paris');
    const timeMin = requestDate.startOf('day').toISOString();
    const timeMax = requestDate.endOf('day').toISOString();

    // Get events from all requested calendars
    const eventPromises = calendarIds.map(async (calendarId) => {
      const response = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
        timeZone: 'Europe/Paris',
      });

      // Map Google Calendar events to our app format
      return (
        response.data.items?.map((event) => ({
          id: event.id,
          calendarId,
          title: event.summary || 'Sans titre',
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          location: event.location || '',
          description: event.description || '',
        })) || []
      );
    });

    // Flatten the array of arrays into a single array of events
    const events = (await Promise.all(eventPromises)).flat();

    return events;
  } catch (error) {
    logger.error('Error fetching calendar events:', error);
    throw error;
  }
}
