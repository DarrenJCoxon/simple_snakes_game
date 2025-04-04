// Initialize Kaboom
kaboom({
    global: true,
    // Make canvas fill the screen, but keep aspect ratio, letterbox if needed
    // width: 640,
    // height: 480,
    // Use width/height or fullscreen, not both usually
    fullscreen: true,
    scale: 1, // Set scale to 1 initially, adjust if needed
    clearColor: [0.1, 0.1, 0.15, 1], // Dark background
});

// --- Game Constants ---
const GRID_SIZE = 20; // Size of each cell and snake segment
const GAME_SPEED = 0.15; // Seconds between snake moves (lower is faster)

let score = 0;
let currentDirection = vec2(1, 0); // Start moving right (x=1, y=0)
let nextDirection = vec2(1, 0);   // Buffer for next direction input
let snake = [];                   // Array to hold snake segment game objects
let food = null;                  // Game object for the food
let gameOver = false;
let scoreLabel = null;            // Label to display score
let gameOverLabel = null;         // Label for game over message

// --- Helper Functions ---

/** Gets grid coordinates from pixel coordinates */
// function toGrid(p) {
//     return vec2(Math.floor(p.x / GRID_SIZE), Math.floor(p.y / GRID_SIZE));
// }

/** Gets pixel coordinates from grid coordinates */
function toPixel(p) {
    // Ensure p is a Vec2 object before accessing x/y
    if (!p || typeof p.x === 'undefined' || typeof p.y === 'undefined') {
        console.error("Invalid input to toPixel:", p);
        return vec2(0, 0); // Return a default value
    }
     // Center the grid elements visually? Optional. Add GRID_SIZE / 2 to x and y?
    return vec2(p.x * GRID_SIZE, p.y * GRID_SIZE);
}

/** Calculates the number of grid cells */
function getGridDimensions() {
    return vec2(Math.floor(width() / GRID_SIZE), Math.floor(height() / GRID_SIZE));
}

/** Places food randomly on the grid, avoiding snake */
function placeFood() {
    const grid = getGridDimensions();
    let newPosGrid = null;

    // Keep trying until we find a spot not occupied by the snake
    while (newPosGrid === null) {
        const potentialX = randi(0, grid.x);
        const potentialY = randi(0, grid.y);
        const potentialPos = vec2(potentialX, potentialY);

        // Check against all snake segment grid positions
        let collision = false;
        for (const segment of snake) {
            // Calculate grid position of the segment
             const segGridPos = vec2(Math.floor(segment.pos.x / GRID_SIZE), Math.floor(segment.pos.y / GRID_SIZE));
            if (potentialPos.eq(segGridPos)) {
                collision = true;
                break;
            }
        }

        if (!collision) {
            newPosGrid = potentialPos;
        }
    }

    // If food already exists, update its position, otherwise create it
    const pixelPos = toPixel(newPosGrid);
    if (food) {
        food.pos = pixelPos;
    } else {
        food = add([
            rect(GRID_SIZE, GRID_SIZE),
            pos(pixelPos),
            color(255, 0, 0), // Red
            area(), // For collision detection
            "food" // Tag for identification
        ]);
    }
     console.log("Placed food at grid:", newPosGrid, "pixel:", pixelPos);
}

/** Resets the game state */
function resetGame() {
    // Clear existing game objects (snake, food, labels)
    every("snake", destroy);
    every("food", destroy); // Assumes only one food item
    if (scoreLabel) destroy(scoreLabel);
    if (gameOverLabel) destroy(gameOverLabel);

    snake = [];
    food = null;
    score = 0;
    gameOver = false;
    currentDirection = vec2(1, 0); // Reset direction
    nextDirection = vec2(1, 0);

    // Create initial snake (3 segments)
    const grid = getGridDimensions();
    const startX = Math.floor(grid.x / 4);
    const startY = Math.floor(grid.y / 2);

    for (let i = 0; i < 3; i++) {
        const segment = add([
            rect(GRID_SIZE - 1, GRID_SIZE - 1), // Slightly smaller for grid lines
            pos(toPixel(vec2(startX - i, startY))),
            color(0, 255, 0), // Green
            area(),
            "snake" // Tag
        ]);
        snake.unshift(segment); // Add to the front (head is snake[0])
    }

    // Place initial food
    placeFood();

    // Create score label
    scoreLabel = add([
        text("Score: 0", { size: Math.floor(GRID_SIZE * 1.5) }), // Dynamic text size
        pos(GRID_SIZE, GRID_SIZE),
        z(100) // Ensure score is drawn on top
    ]);

    // Restart game loop if it was stopped
    startGameLoop();
}

/** Main game update loop */
function gameTick() {
    if (gameOver) return; // Stop updates if game is over

    // --- Update Direction ---
    // Prevent reversing direction
    if ((nextDirection.x !== 0 && nextDirection.x === -currentDirection.x) ||
        (nextDirection.y !== 0 && nextDirection.y === -currentDirection.y)) {
        // Ignore reversal attempt, keep current direction
    } else {
        currentDirection = nextDirection;
    }

    // --- Calculate New Head Position ---
    const head = snake[0];
    const headGridPos = vec2(Math.floor(head.pos.x / GRID_SIZE), Math.floor(head.pos.y / GRID_SIZE));
    const nextHeadGridPos = headGridPos.add(currentDirection); // Add direction vector

    // --- Collision Detection ---
    const grid = getGridDimensions();

    // 1. Wall Collision
    if (nextHeadGridPos.x < 0 || nextHeadGridPos.x >= grid.x ||
        nextHeadGridPos.y < 0 || nextHeadGridPos.y >= grid.y) {
        gameOver = true;
    }

    // 2. Self Collision
    // Need slight delay or check against segments *before* moving tail
    for (let i = 1; i < snake.length; i++) { // Start from 1 (don't check head against itself)
         const segGridPos = vec2(Math.floor(snake[i].pos.x / GRID_SIZE), Math.floor(snake[i].pos.y / GRID_SIZE));
        if (nextHeadGridPos.eq(segGridPos)) {
            gameOver = true;
            break;
        }
    }

    // --- Handle Game Over ---
    if (gameOver) {
        // Display Game Over message
        gameOverLabel = add([
            text("Game Over!\nScore: " + score + "\n(Press SPACE to Restart)", {
                size: Math.floor(GRID_SIZE * 2), // Larger text
                align: "center",
            }),
            pos(center()), // Center of the screen
            anchor("center"), // Anchor text at its center
            z(100) // Ensure it's on top
        ]);
        stopGameLoop(); // Stop the interval timer
        return; // Exit the tick
    }

    // --- Move Snake ---
    let ateFood = false;
    const nextHeadPixelPos = toPixel(nextHeadGridPos);

    // Check for food collision using pixel positions and area component
    if (food && head.pos.dist(food.pos) < GRID_SIZE) { // Simple distance check, or use overlaps()
    // Alternative using overlaps: Check if *next* position overlaps food
    // Need a temporary object or prediction, simpler to check current head vs food pos
    // Let's refine: check if the nextHeadPixelPos is where the food is
       const foodGridPos = vec2(Math.floor(food.pos.x / GRID_SIZE), Math.floor(food.pos.y / GRID_SIZE));
       if (nextHeadGridPos.eq(foodGridPos)) {
            ateFood = true;
            score++;
            scoreLabel.text = "Score: " + score;
            // Don't remove tail, place new food
            placeFood();
       }
    }


    // Create the new head segment
     const newHead = add([
        rect(GRID_SIZE - 1, GRID_SIZE - 1),
        pos(nextHeadPixelPos),
        color(0, 255, 0),
        area(),
        "snake"
    ]);
    snake.unshift(newHead); // Add new head to the beginning of the array

    // Remove tail if food wasn't eaten
    if (!ateFood) {
        const tail = snake.pop(); // Remove last element from array
        destroy(tail); // Remove the tail game object from the screen
    }
}

// --- Input Handling ---
onKeyPress("left", () => {
    if (currentDirection.x === 0) { // Can only turn left if moving vertically
       nextDirection = vec2(-1, 0);
    }
});
onKeyPress("right", () => {
     if (currentDirection.x === 0) { // Can only turn right if moving vertically
       nextDirection = vec2(1, 0);
     }
});
onKeyPress("up", () => {
     if (currentDirection.y === 0) { // Can only turn up if moving horizontally
        nextDirection = vec2(0, -1);
     }
});
onKeyPress("down", () => {
    if (currentDirection.y === 0) { // Can only turn down if moving horizontally
        nextDirection = vec2(0, 1);
    }
});

// Restart game on Space press after game over
onKeyPress("space", () => {
    if (gameOver) {
        resetGame();
    }
});


// --- Start Game ---
let gameLoopIntervalId = null;

function startGameLoop() {
    if (gameLoopIntervalId) clearInterval(gameLoopIntervalId); // Clear previous loop if any
    gameLoopIntervalId = loop(GAME_SPEED, gameTick); // Kaboom's loop function
}

function stopGameLoop() {
     if (gameLoopIntervalId) {
          gameLoopIntervalId.cancel(); // Use cancel() for Kaboom loops
          gameLoopIntervalId = null;
     }
}

// Initial game setup when scene loads
resetGame();