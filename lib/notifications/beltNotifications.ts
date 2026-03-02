import { prisma } from '@/lib/db/prisma'
import crypto from 'crypto'
import { sendPushNotificationForNotification } from './push-notifications'

/**
 * Create a notification for belt challenges
 */
export async function createBeltChallengeNotification(
  challengeId: string,
  beltHolderId: string,
  challengerUsername: string,
  beltName: string
) {
  try {
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: beltHolderId,
        type: 'BELT_CHALLENGE',
        title: 'Belt Challenge Received',
        message: `${challengerUsername} has challenged you for the ${beltName}`,
        read: false,
      },
    })

    // Send push notification
    sendPushNotificationForNotification(
      beltHolderId,
      'BELT_CHALLENGE',
      'Belt Challenge Received',
      `${challengerUsername} has challenged you for the ${beltName}`
    ).catch((error) => {
      console.error('Failed to send push notification:', error)
    })
  } catch (error) {
    console.error('Failed to create belt challenge notification:', error)
  }
}

/**
 * Create a notification when a challenge is accepted
 */
export async function createBeltChallengeAcceptedNotification(
  challengeId: string,
  challengerId: string,
  beltHolderUsername: string,
  beltName: string
) {
  try {
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: challengerId,
        type: 'BELT_CHALLENGE_ACCEPTED',
        title: 'Challenge Accepted',
        message: `${beltHolderUsername} has accepted your challenge for the ${beltName}. A debate has been created!`,
        read: false,
      },
    })

    // Send push notification
    sendPushNotificationForNotification(
      challengerId,
      'BELT_CHALLENGE_ACCEPTED',
      'Challenge Accepted',
      `${beltHolderUsername} has accepted your challenge for the ${beltName}`
    ).catch((error) => {
      console.error('Failed to send push notification:', error)
    })
  } catch (error) {
    console.error('Failed to create challenge accepted notification:', error)
  }
}

/**
 * Create a notification when a belt becomes mandatory defense
 */
export async function createMandatoryDefenseNotification(
  beltId: string,
  beltHolderId: string,
  beltName: string
) {
  try {
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: beltHolderId,
        type: 'BELT_MANDATORY_DEFENSE',
        title: 'Mandatory Defense Required',
        message: `Your ${beltName} requires a mandatory defense. You must accept the next challenge.`,
        read: false,
      },
    })

    // Send push notification
    sendPushNotificationForNotification(
      beltHolderId,
      'BELT_MANDATORY_DEFENSE',
      'Mandatory Defense Required',
      `Your ${beltName} requires a mandatory defense`
    ).catch((error) => {
      console.error('Failed to send push notification:', error)
    })
  } catch (error) {
    console.error('Failed to create mandatory defense notification:', error)
  }
}

/**
 * Create a notification when a belt becomes inactive
 */
export async function createBeltInactiveNotification(
  beltId: string,
  beltHolderId: string,
  beltName: string
) {
  try {
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: beltHolderId,
        type: 'BELT_INACTIVE',
        title: 'Belt Became Inactive',
        message: `Your ${beltName} has become inactive due to lack of defense. Top competitors can now challenge for it.`,
        read: false,
      },
    })

    // Send push notification
    sendPushNotificationForNotification(
      beltHolderId,
      'BELT_INACTIVE',
      'Belt Became Inactive',
      `Your ${beltName} has become inactive`
    ).catch((error) => {
      console.error('Failed to send push notification:', error)
    })
  } catch (error) {
    console.error('Failed to create belt inactive notification:', error)
  }
}

/**
 * Create a notification when a belt is transferred
 */
export async function createBeltTransferNotification(
  beltId: string,
  newHolderId: string,
  beltName: string,
  reason: string
) {
  try {
    const reasonMessages: Record<string, string> = {
      DEBATE_WIN: `You won the ${beltName} in a debate!`,
      TOURNAMENT_WIN: `You won the ${beltName} in a tournament!`,
      CHALLENGE_WIN: `You won the ${beltName} in a challenge!`,
      MANDATORY_LOSS: `You lost the ${beltName} in a mandatory defense.`,
      INACTIVITY: `You lost the ${beltName} due to inactivity.`,
      ADMIN_TRANSFER: `You received the ${beltName} via admin transfer.`,
    }

    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: newHolderId,
        type: 'BELT_TRANSFER',
        title: 'Belt Transferred',
        message: reasonMessages[reason] || `You received the ${beltName}`,
        read: false,
      },
    })

    // Send push notification
    sendPushNotificationForNotification(
      newHolderId,
      'BELT_TRANSFER',
      'Belt Transferred',
      reasonMessages[reason] || `You received the ${beltName}`
    ).catch((error) => {
      console.error('Failed to send push notification:', error)
    })
  } catch (error) {
    console.error('Failed to create belt transfer notification:', error)
  }
}
