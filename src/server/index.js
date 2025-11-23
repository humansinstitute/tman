// Load tman application configuration
require('dotenv').config();

const path = require('path');
const os = require('os');

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const pty = require('node-pty');

const WHITELIST = (process.env.WHITELIST_KEYS || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

class TmanServer {
  constructor(port = process.env.PORT || 3000) {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    this.port = port;

    this.setupMiddleware();
    this.setupRoutes();

    // Deep Dive terminal namespace
    this.terminalNamespace = this.io.of('/terminal');
    this.setupTerminalHandlers();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    // Serve static assets from project public/ regardless of file location
    this.app.use(express.static(path.join(process.cwd(), 'public')));
  }

  setupRoutes() {
    const deepDivePath = path.join(process.cwd(), 'public', 'deep-dive.html');
    const whitelistKeys = (process.env.WHITELIST_KEYS || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    this.app.get('/auth-config', (_req, res) => {
      res.json({ whitelistKeys });
    });

    // Serve Deep Dive directly for root or explicit path
    this.app.get(['/', '/deep-dive'], (req, res) => {
      res.sendFile(deepDivePath);
    });

    // Redirect legacy pages to Deep Dive
    ['recipes', 'projects', 'mcp-servers'].forEach((legacyRoute) => {
      this.app.get(`/${legacyRoute}`, (req, res) => {
        res.redirect('/deep-dive');
      });
    });
  }

  setupTerminalHandlers() {
    const terminalState = {
      lastAuthTime: null,
      authenticated: new Map(),
      pubkeys: new Map()
    };

    const PIN_TIMEOUT = parseInt(process.env.PIN_TIMEOUT, 10) || 45; // seconds

    this.terminalNamespace.on('connection', (socket) => {
      console.log('Terminal client connected');

      let ptyProcess = null;
      let authenticated = false;

      const now = Date.now();
      if (terminalState.lastAuthTime && (now - terminalState.lastAuthTime) < (PIN_TIMEOUT * 1000)) {
        authenticated = true;
        terminalState.authenticated.set(socket.id, now);
        socket.emit('auth-success');
        console.log('Authentication still valid, skipping PIN entry');
      } else {
        socket.emit('auth-required');
      }

      socket.on('register-pubkey', (pubkey) => {
        const ok = WHITELIST.length === 0 || (typeof pubkey === 'string' && WHITELIST.includes(pubkey));
        if (!ok) {
          socket.emit('auth-failed', 'Pubkey not allowed');
          return;
        }
        terminalState.pubkeys.set(socket.id, pubkey);
      });

      socket.on('authenticate', (payload) => {
        const correctPin = process.env.PIN || '1234';
        const { pin } = typeof payload === 'object' && payload ? payload : { pin: payload };
        const storedPubkey = terminalState.pubkeys.get(socket.id) || null;
        const whitelistOk = WHITELIST.length === 0 || (storedPubkey && WHITELIST.includes(storedPubkey));
        if (!whitelistOk) {
          socket.emit('auth-failed', 'Pubkey not allowed');
          return;
        }
        if (pin === correctPin) {
          authenticated = true;
          const authTime = Date.now();
          terminalState.lastAuthTime = authTime;
          terminalState.authenticated.set(socket.id, authTime);
          socket.emit('auth-success');
          console.log('Authentication successful', storedPubkey ? `for ${storedPubkey}` : '');
        } else {
          socket.emit('auth-failed', 'Invalid PIN');
        }
      });

      socket.on('start-terminal', (dimensions) => {
        if (!authenticated) {
          socket.emit('terminal-error', 'Not authenticated. Please enter PIN.');
          return;
        }

        try {
          if (ptyProcess) {
            try {
              ptyProcess.kill();
            } catch (_) {}
          }

          const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
          const cols = dimensions?.cols || 80;
          const rows = dimensions?.rows || 24;

          ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-256color',
            cols,
            rows,
            cwd: process.cwd(),
            env: process.env
          });

          console.log('Terminal process started with PID:', ptyProcess.pid);

          ptyProcess.onData((data) => {
            socket.emit('terminal-output', data);
          });

          ptyProcess.onExit(({ exitCode, signal } = {}) => {
            console.log('Terminal process exited', { exitCode, signal });
            const message = typeof exitCode === 'number'
              ? `Terminal process exited with code: ${exitCode}`
              : 'Terminal process exited';
            socket.emit('terminal-error', message);
          });

          const terminalCmd = process.env.TERMINALCMD || 'node tman-cli.js';
          console.log('Starting terminal session with tman command');
          ptyProcess.write(`${terminalCmd}\r`);
          socket.emit('session-fresh');
        } catch (error) {
          console.error('Error starting terminal:', error);
          socket.emit('terminal-error', error.message);
        }
      });

      socket.on('terminal-input', (data) => {
        if (ptyProcess) {
          ptyProcess.write(data);
        }
      });

      socket.on('terminal-resize', (dimensions) => {
        if (ptyProcess && dimensions?.cols && dimensions?.rows) {
          try {
            ptyProcess.resize(dimensions.cols, dimensions.rows);
          } catch (error) {
            console.warn('Failed to resize terminal:', error.message);
          }
        }
      });

      socket.on('disconnect', () => {
        console.log('Terminal client disconnected');
        terminalState.authenticated.delete(socket.id);
        terminalState.pubkeys.delete(socket.id);

        if (ptyProcess) {
          try {
            console.log('Killing terminal process with PID:', ptyProcess.pid);
            ptyProcess.kill();
          } catch (error) {
            console.warn('Failed to kill terminal process:', error.message);
          }
          ptyProcess = null;
        }
      });
    });
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`Server listening on port ${this.port}`);
    });
  }
}

async function startServer() {
  // Start the server
  const server = new TmanServer();
  server.start();
  return server;
}

module.exports = { TmanServer, startServer };

if (require.main === module) {
  startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
