// Game client for Mini Multiplayer Online Role Playing Game
class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldMap = null;
        this.mapWidth = 2048;
        this.mapHeight = 2048;
        
        // Game state
        this.myPlayerId = null;
        this.players = {};
        this.avatars = {};
        this.viewport = { x: 0, y: 0 };
        this.avatarSize = 64; // Base size for avatars
        this.loadedAvatars = {}; // Cache for loaded avatar images
        
        // WebSocket
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // Input handling
        this.keysPressed = {};
        this.isMoving = false;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.setupInputHandling();
        this.connectToServer();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.updateViewport();
            this.draw();
        });
    }
    
    setupInputHandling() {
        // Handle keydown events
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        // Handle keyup events
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
    }
    
    handleKeyDown(event) {
        // Prevent default browser behavior for arrow keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
            event.preventDefault();
        }
        
        // Track which key was pressed
        this.keysPressed[event.code] = true;
        
        // Send movement command immediately
        this.sendMovementCommand();
    }
    
    handleKeyUp(event) {
        // Remove key from pressed keys
        delete this.keysPressed[event.code];
        
        // Check if we should stop moving
        this.sendMovementCommand();
    }
    
    sendMovementCommand() {
        // Determine which direction to move based on pressed keys
        const directions = [];
        
        if (this.keysPressed['ArrowUp']) directions.push('up');
        if (this.keysPressed['ArrowDown']) directions.push('down');
        if (this.keysPressed['ArrowLeft']) directions.push('left');
        if (this.keysPressed['ArrowRight']) directions.push('right');
        
        // If no keys are pressed, send stop command
        if (directions.length === 0) {
            if (this.isMoving) {
                this.sendMessage({ action: 'stop' });
                this.isMoving = false;
            }
            return;
        }
        
        // For multiple directions, prioritize the first one (simple approach)
        // In a more complex game, you might handle diagonal movement differently
        const direction = directions[0];
        
        // Send move command
        this.sendMessage({ 
            action: 'move', 
            direction: direction 
        });
        this.isMoving = true;
    }
    
    loadWorldMap() {
        const img = new Image();
        img.onload = () => {
            this.worldMap = img;
            this.draw();
        };
        img.onerror = () => {
            console.error('Failed to load world map image');
            // Create a placeholder if world.jpg is not found
            this.createPlaceholderMap();
        };
        img.src = 'world.jpg';
    }
    
    createPlaceholderMap() {
        // Create a placeholder canvas for the world map
        const placeholderCanvas = document.createElement('canvas');
        placeholderCanvas.width = this.mapWidth;
        placeholderCanvas.height = this.mapHeight;
        const placeholderCtx = placeholderCanvas.getContext('2d');
        
        // Create a simple grid pattern as placeholder
        placeholderCtx.fillStyle = '#2d5016';
        placeholderCtx.fillRect(0, 0, this.mapWidth, this.mapHeight);
        
        // Add grid lines
        placeholderCtx.strokeStyle = '#4a7c59';
        placeholderCtx.lineWidth = 2;
        
        for (let x = 0; x <= this.mapWidth; x += 64) {
            placeholderCtx.beginPath();
            placeholderCtx.moveTo(x, 0);
            placeholderCtx.lineTo(x, this.mapHeight);
            placeholderCtx.stroke();
        }
        
        for (let y = 0; y <= this.mapHeight; y += 64) {
            placeholderCtx.beginPath();
            placeholderCtx.moveTo(0, y);
            placeholderCtx.lineTo(this.mapWidth, y);
            placeholderCtx.stroke();
        }
        
        // Add some text
        placeholderCtx.fillStyle = '#ffffff';
        placeholderCtx.font = '48px Arial';
        placeholderCtx.textAlign = 'center';
        placeholderCtx.fillText('World Map Placeholder', this.mapWidth / 2, this.mapHeight / 2);
        placeholderCtx.fillText('(world.jpg not found)', this.mapWidth / 2, this.mapHeight / 2 + 60);
        
        this.worldMap = placeholderCanvas;
        this.draw();
    }
    
    connectToServer() {
        try {
            this.ws = new WebSocket('wss://codepath-mmorg.onrender.com');
            
            this.ws.onopen = () => {
                console.log('Connected to game server');
                this.reconnectAttempts = 0;
                this.joinGame();
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleServerMessage(message);
                } catch (error) {
                    console.error('Error parsing server message:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('Disconnected from game server');
                this.attemptReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to connect to server:', error);
            this.attemptReconnect();
        }
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => {
                this.connectToServer();
            }, 2000 * this.reconnectAttempts);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }
    
    joinGame() {
        const message = {
            action: 'join_game',
            username: 'Tim'
        };
        
        this.sendMessage(message);
    }
    
    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket not connected, cannot send message');
        }
    }
    
    handleServerMessage(message) {
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.myPlayerId = message.playerId;
                    this.players = message.players;
                    this.avatars = message.avatars;
                    console.log('Successfully joined game as', message.playerId);
                    console.log('Initial players:', Object.keys(this.players));
                    console.log('Available avatars:', Object.keys(this.avatars));
                    this.loadAvatarImages();
                    this.updateViewport();
                    this.draw();
                } else {
                    console.error('Failed to join game:', message.error);
                }
                break;
                
            case 'player_joined':
                this.players[message.player.id] = message.player;
                this.avatars[message.avatar.name] = message.avatar;
                this.loadAvatarImages();
                this.draw();
                break;
                
            case 'players_moved':
                console.log('Players moved:', message.players);
                Object.assign(this.players, message.players);
                this.updateViewport();
                this.draw();
                break;
                
            case 'player_left':
                delete this.players[message.playerId];
                this.draw();
                break;
                
            default:
                console.log('Unknown message type:', message.action);
        }
    }
    
    loadAvatarImages() {
        Object.keys(this.avatars).forEach(avatarName => {
            if (!this.loadedAvatars[avatarName]) {
                this.loadedAvatars[avatarName] = {};
                const avatar = this.avatars[avatarName];
                
                // Load each direction's frames
                ['north', 'south', 'east'].forEach(direction => {
                    this.loadedAvatars[avatarName][direction] = [];
                    avatar.frames[direction].forEach((frameData, index) => {
                        const img = new Image();
                        img.onload = () => {
                            this.loadedAvatars[avatarName][direction][index] = img;
                            this.draw();
                        };
                        img.src = frameData;
                    });
                });
            }
        });
    }
    
    updateViewport() {
        if (!this.myPlayerId || !this.players[this.myPlayerId]) return;
        
        const myPlayer = this.players[this.myPlayerId];
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Calculate viewport offset to center my avatar
        this.viewport.x = myPlayer.x - centerX;
        this.viewport.y = myPlayer.y - centerY;
        
        // Clamp viewport to map boundaries
        this.viewport.x = Math.max(0, Math.min(this.viewport.x, this.mapWidth - this.canvas.width));
        this.viewport.y = Math.max(0, Math.min(this.viewport.y, this.mapHeight - this.canvas.height));
    }
    
    draw() {
        if (!this.worldMap) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw the world map with viewport offset
        this.ctx.drawImage(
            this.worldMap,
            this.viewport.x, this.viewport.y, this.canvas.width, this.canvas.height,  // Source rectangle
            0, 0, this.canvas.width, this.canvas.height  // Destination rectangle
        );
        
        // Debug: Log player count and positions
        console.log(`Drawing ${Object.keys(this.players).length} players`);
        
        // Draw all players
        Object.values(this.players).forEach(player => {
            console.log(`Player ${player.username} at (${player.x}, ${player.y})`);
            this.drawPlayer(player);
        });
    }
    
    drawPlayer(player) {
        if (!this.avatars[player.avatar] || !this.loadedAvatars[player.avatar]) return;
        
        const avatar = this.loadedAvatars[player.avatar];
        const direction = player.facing;
        const frameIndex = player.animationFrame || 0;
        
        // Get the appropriate frame
        let frame = null;
        if (direction === 'west') {
            // Use east frames flipped horizontally
            frame = avatar.east[frameIndex];
        } else {
            frame = avatar[direction] && avatar[direction][frameIndex] ? avatar[direction][frameIndex] : null;
        }
        
        if (!frame) return;
        
        // Calculate screen position
        const screenX = player.x - this.viewport.x;
        const screenY = player.y - this.viewport.y;
        
        // Only draw if player is visible on screen
        if (screenX < -this.avatarSize || screenX > this.canvas.width + this.avatarSize ||
            screenY < -this.avatarSize || screenY > this.canvas.height + this.avatarSize) {
            return;
        }
        
        // Save context state
        this.ctx.save();
        
        // Draw avatar
        if (direction === 'west') {
            // Flip horizontally for west direction
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(frame, -screenX - this.avatarSize/2, screenY - this.avatarSize/2, this.avatarSize, this.avatarSize);
        } else {
            this.ctx.drawImage(frame, screenX - this.avatarSize/2, screenY - this.avatarSize/2, this.avatarSize, this.avatarSize);
        }
        
        // Restore context state
        this.ctx.restore();
        
        // Draw username label
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        
        const labelY = screenY - this.avatarSize/2 - 5;
        this.ctx.strokeText(player.username, screenX, labelY);
        this.ctx.fillText(player.username, screenX, labelY);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
