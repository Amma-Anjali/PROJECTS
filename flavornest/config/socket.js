const { Server } = require('socket.io');
const sessionMiddleware = require('../middleware/session');
const User = require('../models/User');

let io = null;

/**
 * Initializes Socket.io on top of the existing HTTP server.
 * Reuses the same session middleware as the Express app, so a socket
 * connection is authenticated by the browser's session cookie - no
 * separate token to manage on the client. Each socket joins a personal
 * room ("user:<id>") plus "admins" if applicable, so the rest of the app
 * can emit targeted events with getIO().to(`user:${id}`).emit(...).
 */
function initSocket(server) {
  io = new Server(server, {
    cors: { origin: process.env.CLIENT_ORIGIN || '*', credentials: true },
  });

  // Run the same session middleware on each socket's underlying HTTP request
  // so socket.request.session is populated from the browser's cookie.
  io.use((socket, next) => sessionMiddleware(socket.request, {}, next));

  io.use(async (socket, next) => {
    try {
      const userId = socket.request.session?.userId;
      if (userId) {
        const user = await User.findById(userId);
        if (user) socket.user = { id: String(user._id), role: user.role };
      }
      next();
    } catch (err) {
      next(); // treat auth lookup failures as anonymous rather than hard-failing
    }
  });

  io.on('connection', (socket) => {
    if (socket.user) {
      socket.join(`user:${socket.user.id}`);
      if (socket.user.role === 'admin') socket.join('admins');
    }
  });

  console.log('🔌 Socket.io initialized');
  return io;
}

function getIO() {
  return io; // may be null if called before initSocket() - callers should guard
}

module.exports = { initSocket, getIO };
