document.addEventListener("DOMContentLoaded", () => {
  const GRID_SIZE = 4;
  const MAX_STARS = 5; // Max stars to display

  let grid = [];
  let score = 0;
  let bestScore = localStorage.getItem("2048-bestScore") || 0;
  let timeElapsed = 0;
  let timerInterval;
  let currentLevel = 1;
  let hasWon = false; // To track if 2048 tile was achieved

  const gameBoardContainer = document.querySelector(".game-board-container");
  const tileContainer = document.querySelector(".tile-container");
  const gridBackground = document.querySelector(".grid-background");
  const scoreDisplay = document.getElementById("score");
  const bestScoreDisplay = document.getElementById("best-score");
  const timeDisplay = document.getElementById("time");
  const levelDisplay = document.getElementById("level");
  const starsDisplay = document.getElementById("stars-display");
  const newGameButton = document.getElementById("new-game-button");
  const gameMessageOverlay = document.getElementById("game-message-overlay");
  const gameMessageText = document.getElementById("game-message-text");
  const tryAgainButton = document.getElementById("try-again-button");
  const keepPlayingButton = document.getElementById("keep-playing-button");

  // --- Game Setup ---
  function setupGridBackground() {
    gridBackground.innerHTML = ""; // Clear previous
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const cell = document.createElement("div");
      cell.classList.add("grid-cell");
      gridBackground.appendChild(cell);
    }
  }

  function initializeGrid() {
    grid = Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill(0));
  }

  function startGame() {
    initializeGrid();
    score = 0;
    timeElapsed = 0;
    currentLevel = 1;
    hasWon = false;
    updateScoreDisplay();
    updateBestScoreDisplay();
    updateLevelAndStars();
    startTimer();

    addRandomTile();
    addRandomTile();
    renderBoard();
    gameMessageOverlay.classList.remove("active");
    keepPlayingButton.style.display = "none";
    tryAgainButton.textContent = "Try Again";
  }

  // --- Rendering ---
  function renderBoard() {
    tileContainer.innerHTML = ""; // Clear previous tiles

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] !== 0) {
          createTileElement(grid[r][c], r, c);
        }
      }
    }
    updateLevelAndStars(); // Update based on max tile
  }

  function createTileElement(value, row, col, isNew = false, isMerged = false) {
    const tile = document.createElement("div");
    tile.classList.add("tile", `tile-${value > 2048 ? "super" : value}`);
    tile.textContent = value;

    // Calculate position based on CSS variables for dynamic sizing
    const tileGap = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--tile-gap"),
    );
    const tileSize = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--tile-size",
      ),
    );

    tile.style.top = `${row * (tileSize + tileGap) + tileGap}px`;
    tile.style.left = `${col * (tileSize + tileGap) + tileGap}px`;

    if (isNew) {
      tile.classList.add("tile-new");
    }
    if (isMerged) {
      tile.classList.add("tile-merged");
      // Ensure merged animation plays after potential move animation
      setTimeout(() => tile.classList.remove("tile-merged"), 200);
    }

    tileContainer.appendChild(tile);
    return tile;
  }

  async function animateMove(tileElement, newRow, newCol) {
    return new Promise((resolve) => {
      const tileGap = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--tile-gap",
        ),
      );
      const tileSize = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--tile-size",
        ),
      );

      tileElement.style.transform = `translate(
                ${(newCol - parseInt(tileElement.dataset.col)) * (tileSize + tileGap)}px,
                ${(newRow - parseInt(tileElement.dataset.row)) * (tileSize + tileGap)}px
            )`;

      // Wait for CSS transition to finish
      tileElement.addEventListener(
        "transitionend",
        function onEnd() {
          tileElement.removeEventListener("transitionend", onEnd);
          resolve();
        },
        { once: true },
      );
    });
  }

  async function updateBoardAfterMove(operations) {
    // Operations: [{ fromRow, fromCol, toRow, toCol, value, isNew, isMerged, mergedFromValue }]
    const movingTiles = [];
    const newTiles = [];
    const mergedInfos = [];

    // 1. Create visual representations of tiles that will move/merge
    operations.forEach((op) => {
      if (!op.isNew && op.originalValue !== 0) {
        // Only create if it was an existing tile
        const existingTileElement = findTileElement(
          op.fromRow,
          op.fromCol,
          op.originalValue,
        );
        if (existingTileElement) {
          existingTileElement.dataset.row = op.fromRow; // Store original position
          existingTileElement.dataset.col = op.fromCol;
          movingTiles.push({
            element: existingTileElement,
            toRow: op.toRow,
            toCol: op.toCol,
            finalValue: op.value,
            isMerged: op.isMerged,
          });
        }
      } else if (op.isNew) {
        newTiles.push(op);
      }
      if (op.isMerged) {
        mergedInfos.push(op);
      }
    });

    // 2. Animate movements
    const movePromises = movingTiles.map((mt) =>
      animateMove(mt.element, mt.toRow, mt.toCol),
    );
    await Promise.all(movePromises);

    // 3. Clear old tile elements and render the new grid state
    tileContainer.innerHTML = ""; // Clear all tiles
    renderBoard(); // Render based on the final grid state

    // 4. Highlight new and merged tiles (re-find them in the newly rendered board)
    newTiles.forEach((op) => {
      const tileEl = findTileElement(op.toRow, op.toCol, op.value);
      if (tileEl) tileEl.classList.add("tile-new");
    });

    mergedInfos.forEach((op) => {
      const tileEl = findTileElement(op.toRow, op.toCol, op.value);
      if (tileEl) {
        tileEl.classList.add("tile-merged");
        // Ensure merged animation plays
        setTimeout(() => tileEl.classList.remove("tile-merged"), 200);
      }
    });
  }

  function findTileElement(row, col, value) {
    // This is a bit naive if multiple tiles have same value.
    // A better way would be to assign unique IDs to tile elements.
    // For now, this works if renderBoard() correctly places them.
    const tileGap = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--tile-gap"),
    );
    const tileSize = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--tile-size",
      ),
    );
    const expectedTop = `${row * (tileSize + tileGap) + tileGap}px`;
    const expectedLeft = `${col * (tileSize + tileGap) + tileGap}px`;

    for (let tile of tileContainer.children) {
      if (
        tile.style.top === expectedTop &&
        tile.style.left === expectedLeft &&
        parseInt(tile.textContent) === value
      ) {
        return tile;
      }
    }
    return null;
  }

  // --- Game Logic ---
  function addRandomTile() {
    let emptyCells = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] === 0) {
          emptyCells.push({ r, c });
        }
      }
    }

    if (emptyCells.length > 0) {
      const { r, c } =
        emptyCells[Math.floor(Math.random() * emptyCells.length)];
      grid[r][c] = Math.random() < 0.9 ? 2 : 4;
      return { r, c, value: grid[r][c] }; // Return info about the new tile
    }
    return null; // No space left
  }

  function slide(row) {
    // Slide tiles in a row to the left
    let arr = row.filter((val) => val); // Get non-zero tiles
    let missing = GRID_SIZE - arr.length;
    let zeros = Array(missing).fill(0);
    arr = arr.concat(zeros); // Add zeros to the end
    return arr;
  }

  function combine(row) {
    // Combine adjacent identical tiles in a row (after sliding)
    let newScore = 0;
    let arr = row;
    for (let i = 0; i < GRID_SIZE - 1; i++) {
      if (arr[i] !== 0 && arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        newScore += arr[i];
        arr[i + 1] = 0;
        if (arr[i] === 2048 && !hasWon) {
          winGame();
        }
      }
    }
    score += newScore;
    return { combinedRow: arr, points: newScore };
  }

  // Helper function to process a single row/column
  function processLine(line) {
    let originalLine = [...line];
    let operations = []; // To track changes for animation

    // 1. Slide (remove zeros)
    let filteredLine = line.filter((val) => val !== 0);
    let newLine = Array(GRID_SIZE).fill(0);
    for (let i = 0; i < filteredLine.length; i++) {
      newLine[i] = filteredLine[i];
    }

    // Track slides
    let currentIdx = 0;
    for (let i = 0; i < GRID_SIZE; i++) {
      if (originalLine[i] !== 0) {
        if (originalLine[i] !== newLine[currentIdx] || i !== currentIdx) {
          // A tile moved or will be part of a merge that moves it
        }
        if (newLine[currentIdx] === originalLine[i]) currentIdx++; // Only advance if it wasn't part of a merge yet
      }
    }

    // 2. Combine
    let linePoints = 0;
    for (let i = 0; i < GRID_SIZE - 1; i++) {
      if (newLine[i] !== 0 && newLine[i] === newLine[i + 1]) {
        newLine[i] *= 2;
        linePoints += newLine[i];
        newLine[i + 1] = 0;
        // Record merge operation for animation
        // The `operations` array needs more sophisticated tracking if we want perfect animation
      }
    }

    // 3. Slide again after combining
    filteredLine = newLine.filter((val) => val !== 0);
    let finalLine = Array(GRID_SIZE).fill(0);
    for (let i = 0; i < filteredLine.length; i++) {
      finalLine[i] = filteredLine[i];
    }

    return { processedLine: finalLine, points: linePoints };
  }

  function move(direction) {
    let moved = false;
    let totalPointsThisMove = 0;
    const preMoveGrid = JSON.parse(JSON.stringify(grid)); // Deep copy for comparison
    let animationOperations = [];

    if (direction === "left" || direction === "right") {
      for (let r = 0; r < GRID_SIZE; r++) {
        let row = grid[r];
        let originalRow = [...row];
        if (direction === "right") row.reverse();

        let tempRow = slide([...row]); // Slide
        let combinedResult = combine([...tempRow]); // Combine
        tempRow = combinedResult.combinedRow;
        totalPointsThisMove += combinedResult.points;
        tempRow = slide(tempRow); // Slide again

        if (direction === "right") tempRow.reverse();

        for (let c = 0; c < GRID_SIZE; c++) {
          if (grid[r][c] !== tempRow[c]) moved = true;
          grid[r][c] = tempRow[c];
        }
      }
    } else if (direction === "up" || direction === "down") {
      for (let c = 0; c < GRID_SIZE; c++) {
        let col = [];
        for (let r = 0; r < GRID_SIZE; r++) col.push(grid[r][c]);
        let originalCol = [...col];

        if (direction === "down") col.reverse();

        let tempCol = slide([...col]);
        let combinedResult = combine([...tempCol]);
        tempCol = combinedResult.combinedRow;
        totalPointsThisMove += combinedResult.points;
        tempCol = slide(tempCol);

        if (direction === "down") tempCol.reverse();

        for (let r = 0; r < GRID_SIZE; r++) {
          if (grid[r][c] !== tempCol[r]) moved = true;
          grid[r][c] = tempCol[r];
        }
      }
    }

    score += totalPointsThisMove; // Update score based on actual merges
    updateScoreDisplay();

    if (moved) {
      // The animation part here is simplified. A full animation system
      // would track each tile's journey. For now, we'll re-render
      // and add a new tile, with basic new/merge highlights.
      const newTileInfo = addRandomTile();
      renderBoard(); // Render immediately for now

      // Highlight the new tile if one was added
      if (newTileInfo) {
        const tileEl = findTileElement(
          newTileInfo.r,
          newTileInfo.c,
          newTileInfo.value,
        );
        if (tileEl) {
          tileEl.classList.add("tile-new");
          setTimeout(() => tileEl.classList.remove("tile-new"), 200);
        }
      }
      // For merged tiles, the `tile-merged` class is added directly in `createTileElement`
      // if we enhance `combine` to return merge locations.
      // For now, the `combine` function itself updates `score` and `grid`.
      // A more robust animation would involve:
      // 1. Calculate final grid positions WITHOUT updating `grid` array yet.
      // 2. Identify which tiles moved, merged, or are new.
      // 3. Create temporary tile elements or use existing ones and animate them to new positions.
      // 4. After animations, update the `grid` array and do a final `renderBoard`.
      // The current `updateBoardAfterMove` is a step towards this but needs `operations` populated correctly.

      if (isGameOver()) {
        gameOver();
      }
    }
    return moved;
  }

  // --- Game State ---
  function isGameOver() {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] === 0) return false; // Empty cell exists
        if (c < GRID_SIZE - 1 && grid[r][c] === grid[r][c + 1]) return false; // Horizontal merge possible
        if (r < GRID_SIZE - 1 && grid[r][c] === grid[r + 1][c]) return false; // Vertical merge possible
      }
    }
    return true; // No empty cells and no possible merges
  }

  function winGame() {
    hasWon = true;
    stopTimer();
    gameMessageText.textContent = "You Win! (2048)";
    tryAgainButton.textContent = "New Game";
    keepPlayingButton.style.display = "inline-block";
    gameMessageOverlay.classList.add("active");
    // Player can choose to continue
  }

  function gameOver() {
    stopTimer();
    gameMessageText.textContent = "Game Over!";
    tryAgainButton.textContent = "Try Again";
    keepPlayingButton.style.display = "none";
    gameMessageOverlay.classList.add("active");
  }

  // --- UI Updates ---
  function updateScoreDisplay() {
    scoreDisplay.textContent = score;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem("2048-bestScore", bestScore);
      updateBestScoreDisplay();
    }
  }

  function updateBestScoreDisplay() {
    bestScoreDisplay.textContent = bestScore;
  }

  function startTimer() {
    stopTimer(); // Clear any existing timer
    let startTime = Date.now() - timeElapsed * 1000; // Resume from previous time if any
    timerInterval = setInterval(() => {
      timeElapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(timeElapsed / 60);
      const seconds = timeElapsed % 60;
      timeDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  function getMaxTileValue() {
    let max = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] > max) {
          max = grid[r][c];
        }
      }
    }
    return max;
  }

  function updateLevelAndStars() {
    const maxTile = getMaxTileValue();
    let newLevel = 1;
    // Define level thresholds based on max tile value
    if (maxTile >= 32) newLevel = 2;
    if (maxTile >= 64) newLevel = 2; // Example star thresholds
    if (maxTile >= 128) newLevel = 3;
    if (maxTile >= 256) newLevel = 3;
    if (maxTile >= 512) newLevel = 4;
    if (maxTile >= 1024) newLevel = 4;
    if (maxTile >= 2048) newLevel = 5;
    if (maxTile >= 4096) newLevel = MAX_STARS + 1; // Super level

    if (newLevel !== currentLevel) {
      currentLevel = newLevel;
    }
    levelDisplay.textContent = Math.min(
      currentLevel,
      MAX_STARS + (currentLevel > MAX_STARS ? 1 : 0),
    ); // Show "Level 6" for >2048

    starsDisplay.innerHTML = "";
    for (let i = 1; i <= MAX_STARS; i++) {
      const starIcon = document.createElement("i");
      starIcon.classList.add("fas", "fa-star");
      if (i < currentLevel || (i === MAX_STARS && currentLevel >= MAX_STARS)) {
        // Award star if currentLevel is this star's number or higher
        // Add a slight delay for the "earned" effect if level just changed
        setTimeout(() => starIcon.classList.add("earned"), i * 50);
      }
      starsDisplay.appendChild(starIcon);
    }
  }

  // --- Event Listeners ---
  newGameButton.addEventListener("click", startGame);
  tryAgainButton.addEventListener("click", startGame);
  keepPlayingButton.addEventListener("click", () => {
    gameMessageOverlay.classList.remove("active");
    startTimer(); // Resume timer if it was stopped by win
  });

  document.addEventListener("keydown", handleKeyPress);

  // Touch controls
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  gameBoardContainer.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault(); // Disables scrolling and zooming
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    },
    { passive: false },
  );

  gameBoardContainer.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      // Your touch move logic here
    },
    { passive: false },
  );

  gameBoardContainer.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault(); // Disables scrolling and zooming
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      handleSwipe();
    },
    { passive: false },
  );

  function handleKeyPress(e) {
    if (
      gameMessageOverlay.classList.contains("active") &&
      !keepPlayingButton.style.display !== "none"
    )
      return; // Don't move if game over/win message is up (unless keep playing)

    let moved = false;
    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        moved = move("up");
        e.preventDefault();
        break;
      case "ArrowDown":
      case "s":
      case "S":
        moved = move("down");
        e.preventDefault();
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        moved = move("left");
        e.preventDefault();
        break;
      case "ArrowRight":
      case "d":
      case "D":
        moved = move("right");
        e.preventDefault();
        break;
    }
  }

  function handleSwipe() {
    if (
      gameMessageOverlay.classList.contains("active") &&
      !keepPlayingButton.style.display !== "none"
    )
      return;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const swipeThreshold = 30; // Minimum distance for a swipe

    if (Math.max(absDeltaX, absDeltaY) < swipeThreshold) return; // Not a swipe

    let moved = false;
    if (absDeltaX > absDeltaY) {
      // Horizontal swipe
      moved = deltaX > 0 ? move("right") : move("left");
    } else {
      // Vertical swipe
      moved = deltaY > 0 ? move("down") : move("up");
    }
  }

  // --- Initial Load ---
  setupGridBackground();
  startGame();
});
