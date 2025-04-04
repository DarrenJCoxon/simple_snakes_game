// Initialize Kaboom
kaboom({
    global: true,
    fullscreen: true,
    scale: 1,
    clearColor: [0.1, 0.1, 0.15, 1], // Dark background
});

// --- Game Constants ---
const GRID_SIZE = 20; // Size of each cell and snake segment
const GAME_SPEED = 0.15; // Seconds between snake moves (lower is faster)

let score = 0;
let currentDirection = vec2(1, 0); // Start moving right (x=1, y=0)
let nextDirection = vec2(1, 0);   // Buffer for next direction input
let snake = [];                   // Array to hold snake segment *references* (Kaboom objects)
let food = null;                  // Game object *reference* for the food
let gameOver = false;
let scoreLabel = null;            // Reference to score label object
let gameOverLabel = null;         // Reference to game over label object

// --- Helper Functions ---

/** Gets pixel coordinates from grid coordinates */
function toPixel(p) {
    if (!p || typeof p.x === 'undefined' || typeof p.y === 'undefined') {
        console.error("Invalid input to toPixel:", p);
        return vec2(0, 0);
    }
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

    // Get current snake grid positions into a Set for faster lookup
    const snakeGridPositions = new Set();
    for (const segment of snake) {
         const segGridPos = vec2(Math.floor(segment.pos.x / GRID_SIZE), Math.floor(segment.pos.y / GRID_SIZE));
         snakeGridPositions.add(`${segGridPos.x},${segGridPos.y}`); // Store as string "x,y"
    }


    while (newPosGrid === null) {
        const potentialX = randi(0, grid.x);
        const potentialY = randi(0, grid.y);
        const potentialPos = vec2(potentialX, potentialY);

        // Check if the potential position string is in the Set
        if (!snakeGridPositions.has(`${potentialPos.x},${potentialPos.y}`)) {
            newPosGrid = potentialPos;
        }
    }

    const pixelPos = toPixel(newPosGrid);
    if (food) {
        food.pos = pixelPos;
    } else {
        // Create the food object
        food = add([
            rect(GRID_SIZE, GRID_SIZE),
            pos(pixelPos),
            color(255, 0, 0), // Red
            area(),
            "food" // Tag
        ]);
    }
     console.log("Placed food at grid:", newPosGrid, "pixel:", pixelPos);
}

/** Resets the game state */
function resetGame() {
    console.log("Resetting game..."); // Add log for debugging

    // *** FIX HERE: Use get() and loop to destroy ***
    const existingSnake = get("snake");
    for (const segment of existingSnake) {
        destroy(segment);
    }

    const existingFood = get("food");
     for (const foodItem of existingFood) {
        destroy(foodItem);
    }
    // *** End of fix ***

    // Destroy labels if they exist
    if (scoreLabel) destroy(scoreLabel);
    if (gameOverLabel) destroy(gameOverLabel);

    // Clear internal references
    snake = [];
    food = null;
    scoreLabel = null;
    gameOverLabel = null;

    // Reset game variables
    score = 0;
    gameOver = false;
    currentDirection = vec2(1, 0);
    nextDirection = vec2(1, 0);

    // Create initial snake
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
        // Add the Kaboom game object reference to our snake array
        snake.unshift(segment); // Head is at snake[0]
    }
     console.log("Initial snake created, length:", snake.length);

    // Place initial food
    placeFood();

    // Create score label
    scoreLabel = add([
        text("Score: 0", { size: Math.floor(GRID_SIZE * 1.5) }),
        pos(GRID_SIZE, GRID_SIZE),
        z(100)
    ]);

    // Restart game loop if it was stopped
    startGameLoop();
     console.log("Game reset complete.");
}

/** Main game update loop */
function gameTick() {
    if (gameOver) return;

    // --- Update Direction ---
    if (!currentDirection.eq(nextDirection)) { // Only check if different
        if ((nextDirection.x !== 0 && nextDirection.x === -currentDirection.x) ||
            (nextDirection.y !== 0 && nextDirection.y === -currentDirection.y)) {
            // Ignore reversal attempt
        } else {
            currentDirection = nextDirection; // Commit the change
        }
    }


    // --- Calculate New Head Position ---
    if (!snake || snake.length === 0) {
         console.error("Snake array is empty or null in gameTick!");
         gameOver = true; // Treat as game over if snake disappears
         return;
    }
    const head = snake[0];
    const headGridPos = vec2(Math.floor(head.pos.x / GRID_SIZE), Math.floor(head.pos.y / GRID_SIZE));
    const nextHeadGridPos = headGridPos.add(currentDirection);

    // --- Collision Detection ---
    const grid = getGridDimensions();

    // 1. Wall Collision
    if (nextHeadGridPos.x < 0 || nextHeadGridPos.x >= grid.x ||
        nextHeadGridPos.y < 0 || nextHeadGridPos.y >= grid.y) {
        console.log("Wall collision detected at", nextHeadGridPos);
        gameOver = true;
    }

    // 2. Self Collision
    if (!gameOver) { // Only check if not already game over
        for (let i = 1; i < snake.length; i++) {
            const segGridPos = vec2(Math.floor(snake[i].pos.x / GRID_SIZE), Math.floor(snake[i].pos.y / GRID_SIZE));
            if (nextHeadGridPos.eq(segGridPos)) {
                 console.log("Self collision detected at", nextHeadGridPos);
                gameOver = true;
                break;
            }
        }
    }

    // --- Handle Game Over ---
    if (gameOver) {
        console.log("Setting Game Over state");
        gameOverLabel = add([
            text("Game Over!\nScore: " + score + "\n(Press SPACE to Restart)", {
                size: Math.floor(GRID_SIZE * 2),
                align: "center",
            }),
            pos(center()),
            anchor("center"),
            z(100)
        ]);
        stopGameLoop();
        return;
    }

    // --- Move Snake ---
    let ateFood = false;
    const nextHeadPixelPos = toPixel(nextHeadGridPos);

    // Check for food collision more reliably
     if (food) {
          const foodGridPos = vec2(Math.floor(food.pos.x / GRID_SIZE), Math.floor(food.pos.y / GRID_SIZE));
          if (nextHeadGridPos.eq(foodGridPos)) {
               console.log("Food eaten!");
               ateFood = true;
               score++;
               scoreLabel.text = "Score: " + score;
               placeFood(); // Place new food *before* potentially moving tail
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
    snake.unshift(newHead); // Add new head object reference

    // Remove tail if food wasn't eaten
    if (!ateFood) {
        const tail = snake.pop(); // Remove tail reference from our array
        if (tail) { // Make sure tail exists before destroying
             destroy(tail); // Remove the tail game object from Kaboom
        } else {
            console.warn("Attempted to pop tail, but snake array was empty?");
        }
    }
}

// --- Input Handling ---
onKeyPress("left", () => {
    if (currentDirection.x === 0) { nextDirection = vec2(-1, 0); }
});
onKeyPress("right", () => {
     if (currentDirection.x === 0) { nextDirection = vec2(1, 0); }
});
onKeyPress("up", () => {
     if (currentDirection.y === 0) { nextDirection = vec2(0, -1); }
});
onKeyPress("down", () => {
    if (currentDirection.y === 0) { nextDirection = vec2(0, 1); }
});

// Restart game on Space press after game over
onKeyPress("space", () => {
    if (gameOver) {
         console.log("Space pressed, restarting game...");
        resetGame();
    }
});


// --- Start Game ---
let gameLoopIntervalId = null;

function startGameLoop() {
    stopGameLoop(); // Ensure any previous loop is stopped first
    console.log("Starting game loop with speed:", GAME_SPEED);
    gameLoopIntervalId = loop(GAME_SPEED, gameTick);
}

function stopGameLoop() {
     if (gameLoopIntervalId) {
          console.log("Stopping game loop");
          gameLoopIntervalId.cancel();
          gameLoopIntervalId = null;
     }
}

// Initial game setup when scene loads
console.log("Initial scene load, calling resetGame...");
resetGame();