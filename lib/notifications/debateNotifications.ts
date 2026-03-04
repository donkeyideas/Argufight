import { prisma } from '@/lib/db/prisma';
import crypto from 'crypto';
import { sendPushNotificationForNotification } from './push-notifications';

export async function createDebateNotification(
  debateId: string,
  userId: string,
  type: string,
  title: string,
  message: string
) {
  try {
    // Create in-app notification (existing system)
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        type: type as any,
        title,
        message,
        debateId,
        read: false,
      },
    });

    // Send push notification (Firebase) - non-blocking
    sendPushNotificationForNotification(userId, type, title, message, debateId).catch(
      (error) => {
        console.error('Failed to send push notification:', error);
        // Don't throw - push notifications are optional
      }
    );
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

export async function notifyDebateWatchers(
  debateId: string,
  type: string,
  title: string,
  message: string,
  excludeUserId?: string
) {
  try {
    // Get all users watching this debate (via saves)
    const watchers = await prisma.debateSave.findMany({
      where: { debateId },
      select: { userId: true },
    });

    const filteredWatchers = watchers.filter((w) => w.userId !== excludeUserId);

    // Create notifications for all watchers except the one who triggered it
    const notifications = filteredWatchers.map((watcher) => ({
      id: crypto.randomUUID(),
      userId: watcher.userId,
      type: type as any,
      title,
      message,
      debateId,
      read: false,
      createdAt: new Date(),
    }));

    if (notifications.length > 0) {
      await prisma.notification.createMany({
        data: notifications,
      });

      // Send push notifications to all watchers (non-blocking)
      for (const watcher of filteredWatchers) {
        sendPushNotificationForNotification(watcher.userId, type, title, message, debateId).catch(
          (error) => {
            console.error('Failed to send push to watcher:', error);
          }
        );
      }
    }
  } catch (error) {
    console.error('Failed to notify watchers:', error);
  }
}

export async function notifyDebateParticipants(
  debateId: string,
  type: string,
  title: string,
  message: string,
  excludeUserId?: string
) {
  try {
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      select: { challengerId: true, opponentId: true },
    });

    if (!debate) return;

    const participants = [debate.challengerId];
    if (debate.opponentId) {
      participants.push(debate.opponentId);
    }

    const filteredParticipants = participants.filter((userId) => userId !== excludeUserId);

    const notifications = filteredParticipants.map((userId) => ({
      id: crypto.randomUUID(),
      userId,
      type: type as any,
      title,
      message,
      debateId,
      read: false,
      createdAt: new Date(),
    }));

    if (notifications.length > 0) {
      await prisma.notification.createMany({
        data: notifications,
      });

      // Send push notifications to all participants (non-blocking)
      for (const userId of filteredParticipants) {
        sendPushNotificationForNotification(userId, type, title, message, debateId).catch(
          (error) => {
            console.error('Failed to send push to participant:', error);
          }
        );
      }
    }
  } catch (error) {
    console.error('Failed to notify participants:', error);
  }
}


