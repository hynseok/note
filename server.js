const { createServer } = require('http');
// const { parse } = require('url'); // Deprecated, using URL API instead
const next = require('next');
const { Server } = require('socket.io');
const { getSession } = require('next-auth/react');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error handling request:', err);
            res.statusCode = 500;
            res.end('Internal server error');
        }
    });

    // Initialize Socket.IO
    const io = new Server(server, {
        cors: {
            origin: dev ? 'http://localhost:3000' : process.env.NEXTAUTH_URL,
            credentials: true,
        },
        transports: ['websocket', 'polling'],
    });

    // Import socket handler
    require('./lib/socket-server')(io);

    server
        .once('error', (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
            console.log(`> WebSocket server running`);
            console.log(`> Socket.IO CORS Origin:`, dev ? 'http://localhost:3000' : process.env.NEXTAUTH_URL);
        });
});
