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
            const url = new URL(req.url, `http://${req.headers.host}`);
            const parsedUrl = {
                pathname: url.pathname,
                query: Object.fromEntries(url.searchParams),
            };
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error handling request:', err);
            res.statusCode = 500;
            res.end('Internal server error');
        }
    });

    // Initialize Socket.IO with robust CORS
    const io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                const allowedOrigins = [
                    'http://localhost:3000',
                    process.env.NEXTAUTH_URL,
                    'https://note.cbum.org' // Explicitly add production domain
                ];

                // Allow requests with no origin (like mobile apps or curl requests)
                if (!origin) return callback(null, true);

                if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('note.cbum.org')) {
                    callback(null, true);
                } else {
                    console.log('[Socket.IO] Blocked CORS from:', origin);
                    callback(new Error('Not allowed by CORS'));
                }
            },
            credentials: true,
            methods: ["GET", "POST"]
        },
        transports: ['websocket', 'polling'],
    });

    io.engine.on("connection_error", (err) => {
        console.log("[Socket.IO] Connection error:", err.code, err.message, err.context);
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
