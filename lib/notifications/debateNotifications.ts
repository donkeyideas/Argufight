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

    // Create notifications for all watchers except the one who triggered it
    const notifications = watchers
      .filter((w) => w.userId !== excludeUserId)
      .map((watcher) => ({
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

    const notifications = participants
      .filter((userId) => userId !== excludeUserId)
      .map((userId) => ({
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
    }
  } catch (error) {
    console.error('Failed to notify participants:', error);
  }
}


