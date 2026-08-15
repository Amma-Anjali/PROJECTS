const Notification = require('../models/Notification');
const { getIO } = require('../config/socket');

/**
 * Creates a notification for one user, persists it, and pushes it live over
 * socket.io if they're connected. If they're not connected, it's still
 * waiting for them next time they call GET /api/notifications.
 */
async function notifyUser(userId, { type = 'general', message, link = '' }) {
  const notification = await Notification.create({ user: userId, type, message, link });

  const io = getIO();
  if (io) io.to(`user:${userId}`).emit('notification', notification);

  return notification;
}

/**
 * Broadcasts to every connected admin (does not persist per-admin rows -
 * admins see live operational events, not a personal inbox).
 */
function notifyAdmins(event, payload) {
  const io = getIO();
  if (io) io.to('admins').emit(event, payload);
}

module.exports = { notifyUser, notifyAdmins };
