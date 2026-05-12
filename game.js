const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const bangersFont = new FontFace('Bangers', 'url(font/Bangers/Bangers-Regular.ttf)');
bangersFont.load().then(function (font) {
    document.fonts.add(font);
});

// Use a fixed internal resolution for consistent positioning
// 1920x1080 is standard 16:9
const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

const spriteImage = new Image();
spriteImage.src = 'RezzySpriteSheet/Idle_Rezzy.png';

const grabImage = new Image();
grabImage.src = 'RezzySpriteSheet/Grab_Rezzy.png';

const fairyImage = new Image();
fairyImage.src = 'Items/FairyInBottle.png';

const thoughtBubbleImage = new Image();
thoughtBubbleImage.src = 'Items/thoughtbubble.png';

const customersImage = new Image();
customersImage.src = 'Customers/customers.png';

const fairySpriteImage = new Image();
fairySpriteImage.src = 'Items/FairyInBottleSprite.png';

const lightningImage = new Image();
lightningImage.src = 'Items/BlueLightning.png';

const lightningSpriteImage = new Image();
lightningSpriteImage.src = 'Items/BlueLightningSprite.png';

const lagoonSpriteImage = new Image();
lagoonSpriteImage.src = 'Items/MermaidLagoonSprite.png';

const boomImage = new Image();
boomImage.src = 'Items/RedWhiteBoom.png';

const boomSpriteImage = new Image();
boomSpriteImage.src = 'Items/RedWhiteBoomSprite.png';

const lagoonImage = new Image();
lagoonImage.src = 'Items/MermaidLagoon.png';

const progressBarImage = new Image();
progressBarImage.src = 'Items/progressbar.png';

const progressBarFilledImage = new Image();
progressBarFilledImage.src = 'Items/progressbarfilled.png';

const arrowImage = new Image();
arrowImage.src = 'Items/arrow.png';

let currentProgressBarFill = 0; // Current visual fill level (0 to 1)
let totalCorrectOrders = 0; // Track total correct orders
let currentLevel = 1;
let maxOrdersForLevel = 10; // 10 for level 1, 15 for level 2+
let isVictoryState = false; // Set to true when level is won


// Variables for the fairy bottle position and scale
// (Approximate position for the leftmost box on the wagon)
let fairyX = GAME_WIDTH * 0.25;
let fairyY = GAME_HEIGHT * 0.85;
let fairyScale = 0.08; // Scaled down since original is 3046x3046

// Variables for the blue lightning position and scale (second box)
let lightningX = GAME_WIDTH * 0.40; // Shifted right from the first box
let lightningY = GAME_HEIGHT * 0.85; // Same height
let lightningScale = 0.08;

// Variables for the red white and boom position and scale (third box)
let boomX = GAME_WIDTH * 0.55; // Shifted right from the second box
let boomY = GAME_HEIGHT * 0.85; // Same height
let boomScale = 0.08;

// Variables for the mermaid lagoon position and scale (fourth box)
let lagoonX = GAME_WIDTH * 0.70; // Shifted right from the third box
let lagoonY = GAME_HEIGHT * 0.85; // Same height
let lagoonScale = 0.08;

const slotPositions = [
    GAME_WIDTH * 0.25, // Fairy
    GAME_WIDTH * 0.40, // Lightning
    GAME_WIDTH * 0.55, // Boom
    GAME_WIDTH * 0.70  // Lagoon
];

let currentSlot = 0;
let characterX = slotPositions[currentSlot];
let targetX = characterX;

// Active Orders State
let activeOrders = [
    { customerIndex: 0, itemIndex: Math.floor(Math.random() * 4), revealProgress: 0 }
];
let nextCustomerIndex = 1;

let currentStreak = 0;

// Fine-tuning Y position slightly lower
let characterY = GAME_HEIGHT * 0.58;
let speed = 12; // Moderate slowdown for transitioning between slots
let freezeTimer = 0; // Timer to freeze input

// Animation variables for the 5x11 sprite sheet (Idle)
const FRAME_WIDTH = 800; // 4000 / 5
const FRAME_HEIGHT = 444; // 4884 / 11
const COLS = 5;
const TOTAL_FRAMES = 52;

// Animation variables for the 5x9 sprite sheet (Grab)
const GRAB_COLS = 5;
const GRAB_TOTAL_FRAMES = 43; // Based on 9 rows, stopping before the empty frames at the end
let isGrabbing = false;
let currentGrabFrame = 0;
let grabFrameTimer = 0;
const grabFrameDelay = 4; // Faster grab animation
// Offsets to fine-tune the alignment between Grab and Idle if needed
let grabOffsetX = 0;
let grabOffsetY = 0;

// Fairy Sprite animation variables
const FAIRY_SPRITE_WIDTH = 400;
const FAIRY_SPRITE_HEIGHT = 400;
const FAIRY_SPRITE_COLS = 5;
const FAIRY_SPRITE_TOTAL_FRAMES = 81;
let isPlayingFairy = false;
let currentFairyFrame = 0;
let fairyFrameTimer = 0;
const fairySpriteDelay = 4;
let fairySpriteOffsetY = 250;

// Lightning Sprite animation variables
const LIGHTNING_SPRITE_WIDTH = 400;
const LIGHTNING_SPRITE_HEIGHT = 400;
const LIGHTNING_SPRITE_COLS = 5;
const LIGHTNING_SPRITE_TOTAL_FRAMES = 51;
let isPlayingLightning = false;
let currentLightningFrame = 0;
let lightningFrameTimer = 0;
const lightningSpriteDelay = 4;
let lightningSpriteOffsetY = 250; // Increased to lower it closer to the player's head

// Boom Sprite animation variables
const BOOM_SPRITE_WIDTH = 400;
const BOOM_SPRITE_HEIGHT = 400;
const BOOM_SPRITE_COLS = 5;
const BOOM_SPRITE_TOTAL_FRAMES = 81;
let isPlayingBoom = false;
let currentBoomFrame = 0;
let boomFrameTimer = 0;
const boomSpriteDelay = 4;
let boomSpriteOffsetY = 250;

// Lagoon Sprite animation variables
const LAGOON_SPRITE_WIDTH = 400;
const LAGOON_SPRITE_HEIGHT = 400;
const LAGOON_SPRITE_COLS = 5;
const LAGOON_SPRITE_TOTAL_FRAMES = 66;
let isPlayingLagoon = false;
let currentLagoonFrame = 0;
let lagoonFrameTimer = 0;
const lagoonSpriteDelay = 4;
let lagoonSpriteOffsetY = 250;

let currentFrame = 0;
let frameTimer = 0;
const frameDelay = 8; // Adjust for animation speed


function executeGrabAction() {
    if (isGrabbing) return;
    freezeTimer = 60; // Reduced freeze input to 1 second (60 frames at 60fps) for snappier gameplay
                isGrabbing = true;
                currentGrabFrame = 0; // Start grab animation from beginning
                grabFrameTimer = 0; // Reset frame timer

                // Check if we are in front of the fairy bottle item (slot 0)
                if (currentSlot === 0) {
                    isPlayingFairy = true;
                    currentFairyFrame = 0;
                    fairyFrameTimer = 0;
                }

                // Check if we are in front of the blue lightning item (slot 1)
                if (currentSlot === 1) {
                    isPlayingLightning = true;
                    currentLightningFrame = 0;
                    lightningFrameTimer = 0;
                }

                // Check if we are in front of the red white boom item (slot 2)
                if (currentSlot === 2) {
                    isPlayingBoom = true;
                    currentBoomFrame = 0;
                    boomFrameTimer = 0;
                }

                // Check if we are in front of the mermaid lagoon item (slot 3)
                if (currentSlot === 3) {
                    isPlayingLagoon = true;
                    currentLagoonFrame = 0;
                    lagoonFrameTimer = 0;
                }

                // ORDER FULFILLMENT LOGIC
                if (activeOrders.length > 0) {
                    // Check if the grabbed item matches the oldest order
                    if (currentSlot === activeOrders[0].itemIndex) {
                        // Order fulfilled!
                        currentStreak++;
                        totalCorrectOrders++;
                        activeOrders.shift(); // Remove oldest order

                        // Check for victory condition
                        if (totalCorrectOrders >= maxOrdersForLevel) {
                            isVictoryState = true;

                            // Pause for 3 seconds then start the next level
                            setTimeout(() => {
                                currentLevel++;
                                maxOrdersForLevel = currentLevel === 1 ? 10 : 15;
                                totalCorrectOrders = 0;
                                currentProgressBarFill = 0; // Reset visual gauge instantly
                                isVictoryState = false;

                                // Generate the first order for the new level
                                let newItemIndex = Math.floor(Math.random() * 4);
                                activeOrders.push({
                                    customerIndex: nextCustomerIndex,
                                    itemIndex: newItemIndex,
                                    revealProgress: 0
                                });
                                nextCustomerIndex = (nextCustomerIndex + 1) % 5;
                            }, 3000);

                            // We don't push a new order when in victory state immediately
                        } else {
                            // Generate a new random order that is guaranteed to be different from the one just fulfilled
                            // Constraint: The Elf (customerIndex 2) can never pick the Mermaid Lagoon (itemIndex 3)
                            let newItemIndex = Math.floor(Math.random() * 4);
                            while (newItemIndex === currentSlot || (nextCustomerIndex === 2 && newItemIndex === 3)) {
                                newItemIndex = Math.floor(Math.random() * 4);
                            }

                            activeOrders.push({
                                customerIndex: nextCustomerIndex,
                                itemIndex: newItemIndex,
                                revealProgress: 0
                            });

                            // Increment and wrap customer index
                            nextCustomerIndex = (nextCustomerIndex + 1) % 5;
                        }
                    } else {
                        // Wrong item! Break the streak.
                        currentStreak = 0;
                    }
                }
}

window.addEventListener('keydown', (e) => {
    // Prevent any input if the player is currently frozen or in victory state
    if (freezeTimer > 0 || isVictoryState) return;

    // Only allow input if not already moving
    if (characterX === targetX) {
        // Prevent holding the key from skipping multiple slots instantly
        if (e.repeat) return;

        if (e.code === 'Space' || e.key === ' ') {
            executeGrabAction();
        } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
            if (currentSlot > 0) {
                currentSlot--;
                targetX = slotPositions[currentSlot];
            }
        } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
            if (currentSlot < 3) {
                currentSlot++;
                targetX = slotPositions[currentSlot];
            }
        }
    }
});

// Mobile support: listen to pointerdown events (mouse or touch)
window.addEventListener('pointerdown', (e) => {
    // If the game hasn't started yet, tapping the screen handles start logic, not gameplay
    if (freezeTimer > 0 || isVictoryState) return;
    
    if (characterX !== targetX) return; // Only allow input if not already moving

    const rect = canvas.getBoundingClientRect();
    
    // Ignore clicks outside the main game area bounding box
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        return;
    }

    // Map screen coordinates to internal 1920x1080 GAME_WIDTH/GAME_HEIGHT coordinates
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Hitbox for Left Arrow (bottom left, roughly left 25%)
    if (x < GAME_WIDTH * 0.25 && y > GAME_HEIGHT * 0.70) {
        if (currentSlot > 0) {
            currentSlot--;
            targetX = slotPositions[currentSlot];
        }
    }
    // Hitbox for Right Arrow (bottom right, roughly right 25%)
    else if (x > GAME_WIDTH * 0.75 && y > GAME_HEIGHT * 0.70) {
        if (currentSlot < 3) {
            currentSlot++;
            targetX = slotPositions[currentSlot];
        }
    }
    // Hitbox for the Green Rotating Portal (center of the screen, middle section)
    else if (x > GAME_WIDTH * 0.25 && x < GAME_WIDTH * 0.75 && y > GAME_HEIGHT * 0.40) {
        executeGrabAction();
    }
});

function update() {
    if (freezeTimer > 0) {
        freezeTimer--;
    }

    // Smoothly move the character towards the target X position
    if (characterX < targetX) {
        characterX += speed;
        if (characterX > targetX) characterX = targetX; // Snap to target
    } else if (characterX > targetX) {
        characterX -= speed;
        if (characterX < targetX) characterX = targetX; // Snap to target
    }

    // Update progress bar fill animation to smoothly approach target
    const targetFill = Math.min(totalCorrectOrders / maxOrdersForLevel, 1.0);
    // Easing effect (moves 5% of the distance to target every frame)
    currentProgressBarFill += (targetFill - currentProgressBarFill) * 0.05;

    // Update order reveal progress (slower reveal: ~5 seconds at 60fps)
    activeOrders.forEach(order => {
        if (order.revealProgress < 1) {
            order.revealProgress += 1 / 300;
            if (order.revealProgress > 1) order.revealProgress = 1;
        }
    });

    // Update animations
    if (!isGrabbing) {
        // Loop the idle animation constantly
        frameTimer++;
        if (frameTimer >= frameDelay) {
            frameTimer = 0;
            currentFrame = (currentFrame + 1) % TOTAL_FRAMES;
        }
    } else {
        // Update grab animation faster
        grabFrameTimer++;
        if (grabFrameTimer >= grabFrameDelay) {
            grabFrameTimer = 0;
            currentGrabFrame++;
            // When grab animation finishes, revert to idle
            if (currentGrabFrame >= GRAB_TOTAL_FRAMES) {
                isGrabbing = false;
                currentGrabFrame = 0;
            }
        }
    }

    // Update fairy sprite animation independently
    if (isPlayingFairy) {
        fairyFrameTimer += 1.25; // Increased speed by 25%
        if (fairyFrameTimer >= fairySpriteDelay) {
            fairyFrameTimer -= fairySpriteDelay; // Subtract delay to keep remainder for smooth sub-frame timing
            currentFairyFrame++;
            if (currentFairyFrame >= FAIRY_SPRITE_TOTAL_FRAMES) {
                isPlayingFairy = false;
                currentFairyFrame = 0;
            }
        }
    }

    // Update lightning sprite animation independently
    if (isPlayingLightning) {
        lightningFrameTimer += 1.25; // Increased speed by 25%
        if (lightningFrameTimer >= lightningSpriteDelay) {
            lightningFrameTimer -= lightningSpriteDelay;
            currentLightningFrame++;
            if (currentLightningFrame >= LIGHTNING_SPRITE_TOTAL_FRAMES) {
                isPlayingLightning = false;
                currentLightningFrame = 0;
            }
        }
    }

    // Update boom sprite animation independently
    if (isPlayingBoom) {
        boomFrameTimer += 1.25; // Increased speed by 25%
        if (boomFrameTimer >= boomSpriteDelay) {
            boomFrameTimer -= boomSpriteDelay;
            currentBoomFrame++;
            if (currentBoomFrame >= BOOM_SPRITE_TOTAL_FRAMES) {
                isPlayingBoom = false;
                currentBoomFrame = 0;
            }
        }
    }

    // Update lagoon sprite animation independently
    if (isPlayingLagoon) {
        lagoonFrameTimer += 1.25; // Increased speed by 25%
        if (lagoonFrameTimer >= lagoonSpriteDelay) {
            lagoonFrameTimer -= lagoonSpriteDelay;
            currentLagoonFrame++;
            if (currentLagoonFrame >= LAGOON_SPRITE_TOTAL_FRAMES) {
                isPlayingLagoon = false;
                currentLagoonFrame = 0;
            }
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw background video directly on canvas (works on all mobile browsers)
    const bgVid = document.getElementById('bg-video');
    if (bgVid && bgVid.readyState >= 2) {
        ctx.drawImage(bgVid, 0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    // Draw the customers layer first so it is behind Rezzy and the items
    if (customersImage.complete && customersImage.width > 0) {
        const custScale = (GAME_HEIGHT * 1.0) / FRAME_HEIGHT;
        const scaledWidth = FRAME_WIDTH * custScale;
        const scaledHeight = FRAME_HEIGHT * custScale;

        // Animate the customers sprite sheet exactly like Rezzy's idle animation
        const col = currentFrame % COLS;
        const row = Math.floor(currentFrame / COLS);

        const custX = GAME_WIDTH / 2;
        const custY = GAME_HEIGHT * 0.515;

        ctx.drawImage(
            customersImage,
            col * FRAME_WIDTH, row * FRAME_HEIGHT,
            FRAME_WIDTH, FRAME_HEIGHT,
            Math.floor(custX - scaledWidth / 2),
            Math.floor(custY - scaledHeight / 2),
            scaledWidth,
            scaledHeight
        );

        // Draw active thought bubbles
        if (!isVictoryState && thoughtBubbleImage.complete && thoughtBubbleImage.width > 0) {
            // Manually tuned horizontal offsets for each specific customer: Witch, Knight, Elf, Dwarf, Lizardman
            const customerOffsets = [0.35, 0.47, 0.58, 0.70, 0.82];

            // Map item indices to images
            const itemImages = [fairyImage, lightningImage, boomImage, lagoonImage];

            activeOrders.forEach((order, index) => {
                const offset = customerOffsets[order.customerIndex];
                const charX = (custX - scaledWidth / 2) + (scaledWidth * offset);

                // Set scale for the thought bubble
                const bubbleScale = (GAME_HEIGHT * 0.22) / thoughtBubbleImage.height;
                const bubbleWidth = thoughtBubbleImage.width * bubbleScale;
                const bubbleHeight = thoughtBubbleImage.height * bubbleScale;

                // Position above the head
                const bubbleY = custY - 220;

                ctx.drawImage(
                    thoughtBubbleImage,
                    Math.floor(charX - bubbleWidth / 2),
                    Math.floor(bubbleY - bubbleHeight / 2),
                    bubbleWidth,
                    bubbleHeight
                );

                // Draw the specific drink inside the thought bubble
                const orderImage = itemImages[order.itemIndex];
                if (orderImage && orderImage.complete && orderImage.width > 0) {
                    // Scale the drink to fit inside the bubble
                    const drinkScale = (bubbleHeight * 0.5) / orderImage.height;
                    const drinkWidth = orderImage.width * drinkScale;
                    const drinkHeight = orderImage.height * drinkScale;

                    const destX = charX - drinkWidth / 2;
                    const destY = (bubbleY - bubbleHeight / 2) + (bubbleHeight * 0.38) - (drinkHeight / 2);

                    const revealProgress = order.revealProgress;

                    if (revealProgress < 1.0) {
                        // 1. Draw black silhouette
                        ctx.filter = 'brightness(0)';
                        ctx.drawImage(orderImage, Math.floor(destX), Math.floor(destY), drinkWidth, drinkHeight);
                        ctx.filter = 'none';

                        // 2. Draw revealed colored portion (bottom to top)
                        if (revealProgress > 0) {
                            const sourceRevealH = orderImage.height * revealProgress;
                            const destRevealH = drinkHeight * revealProgress;

                            ctx.drawImage(
                                orderImage,
                                0, orderImage.height - sourceRevealH, orderImage.width, sourceRevealH, // Source
                                Math.floor(destX), Math.floor(destY + drinkHeight - destRevealH), drinkWidth, destRevealH      // Dest
                            );
                        }
                    } else {
                        // Fully revealed
                        ctx.drawImage(orderImage, Math.floor(destX), Math.floor(destY), drinkWidth, drinkHeight);
                    }
                }
            });
        }
    }

    const activeImage = isGrabbing ? grabImage : spriteImage;
    const activeFrame = isGrabbing ? currentGrabFrame : currentFrame;
    const activeCols = isGrabbing ? GRAB_COLS : COLS;

    if (activeImage.complete && activeImage.width > 0) {
        // Scaled up to be twice as big (70% of the game height)
        const scale = (GAME_HEIGHT * 0.70) / FRAME_HEIGHT;

        const scaledWidth = FRAME_WIDTH * scale;
        const scaledHeight = FRAME_HEIGHT * scale;

        // Calculate the position of the current frame on the sprite sheet
        const col = activeFrame % activeCols;
        const row = Math.floor(activeFrame / activeCols);

        // Apply offsets if currently grabbing, else 0
        const currentOffsetX = isGrabbing ? grabOffsetX : 0;
        const currentOffsetY = isGrabbing ? grabOffsetY : 0;

        // Draw just the current frame, properly scaled
        ctx.drawImage(
            activeImage,
            col * FRAME_WIDTH, row * FRAME_HEIGHT, // Source x, y
            FRAME_WIDTH, FRAME_HEIGHT,             // Source width, height
            Math.floor(characterX - scaledWidth / 2 + currentOffsetX),
            Math.floor(characterY - scaledHeight / 2 + currentOffsetY),         // Destination x, y
            scaledWidth,
            scaledHeight                           // Destination width, height
        );

    }

    // ==========================================
    // 🔧 STATIC COUNTER BOTTLES CONTROLS 🔧
    // ==========================================
    // Increase this number to make the bottles on the counter brighter (100% is normal)
    const STATIC_BOTTLE_BRIGHTNESS = '70%'; // Was previously 50%
    // ==========================================

    // Set filter to apply the brightness
    ctx.filter = `brightness(${STATIC_BOTTLE_BRIGHTNESS})`;

    // Draw the fairy bottle
    if (fairyImage.complete && fairyImage.width > 0) {
        const fWidth = fairyImage.width * fairyScale;
        const fHeight = fairyImage.height * fairyScale;

        ctx.drawImage(
            fairyImage,
            fairyX - fWidth / 2,
            fairyY - fHeight / 2,
            fWidth,
            fHeight
        );
    }

    // Draw the blue lightning
    if (lightningImage.complete && lightningImage.width > 0) {
        const lWidth = lightningImage.width * lightningScale;
        const lHeight = lightningImage.height * lightningScale;

        ctx.drawImage(
            lightningImage,
            lightningX - lWidth / 2,
            lightningY - lHeight / 2,
            lWidth,
            lHeight
        );
    }

    // Draw the red white and boom
    if (boomImage.complete && boomImage.width > 0) {
        const bWidth = boomImage.width * boomScale;
        const bHeight = boomImage.height * boomScale;

        ctx.drawImage(
            boomImage,
            boomX - bWidth / 2,
            boomY - bHeight / 2,
            bWidth,
            bHeight
        );
    }

    // Draw the mermaid lagoon
    if (lagoonImage.complete && lagoonImage.width > 0) {
        const mWidth = lagoonImage.width * lagoonScale;
        const mHeight = lagoonImage.height * lagoonScale;

        ctx.drawImage(
            lagoonImage,
            lagoonX - mWidth / 2,
            lagoonY - mHeight / 2,
            mWidth,
            mHeight
        );
    }

    // Reset filter so streak text and animated sprites are not darkened
    ctx.filter = 'none';

    // Draw Streak text
    if (document.fonts.check('12px Bangers')) {
        // ==========================================
        // 🔧 STREAK TEXT CONTROLS (TWEAK THESE!) 🔧
        // ==========================================
        const STREAK_COLOR = '#39FF14'; // Base neon green color
        const STREAK_BRIGHTNESS = '60%'; // Lower this to make it darker (was 100%)
        // ==========================================
        
        ctx.filter = `brightness(${STREAK_BRIGHTNESS})`;
        ctx.fillStyle = STREAK_COLOR; 
        ctx.strokeStyle = '#000000'; // Black outline
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const startX = 140; // Moved a little to the left
        const startY = 200; // Lowered further

        // Draw "Streak"
        ctx.font = '100px Bangers'; // Made slightly bigger
        ctx.lineWidth = 6;
        ctx.strokeText("Streak", startX, startY);
        ctx.fillText("Streak", startX, startY);

        // Draw "X  [number]" below, significantly bigger
        const numberText = `X  ${currentStreak}`; // Added spaces
        const lineSpacing = 100; // Adjusted space between lines for smaller top word

        ctx.font = '180px Bangers';
        ctx.lineWidth = 10; // Thicker outline for larger text
        ctx.strokeText(numberText, startX, startY + lineSpacing);
        ctx.fillText(numberText, startX, startY + lineSpacing);
        
        // Reset filter so we don't accidentally darken the animated sprites next
        ctx.filter = 'none';
    }

        // Draw the fairy sprite above Rezzy's head if playing
        if (isPlayingFairy && fairySpriteImage.complete && fairySpriteImage.width > 0) {
            const fScale = (GAME_HEIGHT * 0.40) / FAIRY_SPRITE_HEIGHT;
            const fScaledWidth = FAIRY_SPRITE_WIDTH * fScale;
            const fScaledHeight = FAIRY_SPRITE_HEIGHT * fScale;

            const fCol = currentFairyFrame % FAIRY_SPRITE_COLS;
            const fRow = Math.floor(currentFairyFrame / FAIRY_SPRITE_COLS);

            const fx = slotPositions[0] - fScaledWidth / 2;
            const fy = characterY - (GAME_HEIGHT * 0.70) / 2 - fScaledHeight + fairySpriteOffsetY;

            ctx.drawImage(
                fairySpriteImage,
                fCol * FAIRY_SPRITE_WIDTH, fRow * FAIRY_SPRITE_HEIGHT,
                FAIRY_SPRITE_WIDTH, FAIRY_SPRITE_HEIGHT,
                Math.floor(fx), Math.floor(fy),
                fScaledWidth, fScaledHeight
            );
        }

        // Draw the lightning sprite above Rezzy's head if playing
        if (isPlayingLightning && lightningSpriteImage.complete && lightningSpriteImage.width > 0) {
            const lScale = (GAME_HEIGHT * 0.40) / LIGHTNING_SPRITE_HEIGHT; // Scale it to a reasonable size
            const lScaledWidth = LIGHTNING_SPRITE_WIDTH * lScale;
            const lScaledHeight = LIGHTNING_SPRITE_HEIGHT * lScale;

            const lCol = currentLightningFrame % LIGHTNING_SPRITE_COLS;
            const lRow = Math.floor(currentLightningFrame / LIGHTNING_SPRITE_COLS);

            // Position above the item slot
            const lx = slotPositions[1] - lScaledWidth / 2;
            const ly = characterY - (GAME_HEIGHT * 0.70) / 2 - lScaledHeight + lightningSpriteOffsetY;

            ctx.drawImage(
                lightningSpriteImage,
                lCol * LIGHTNING_SPRITE_WIDTH, lRow * LIGHTNING_SPRITE_HEIGHT,
                LIGHTNING_SPRITE_WIDTH, LIGHTNING_SPRITE_HEIGHT,
                Math.floor(lx), Math.floor(ly),
                lScaledWidth, lScaledHeight
            );
        }

        // Draw the boom sprite above Rezzy's head if playing
        if (isPlayingBoom && boomSpriteImage.complete && boomSpriteImage.width > 0) {
            const bScale = (GAME_HEIGHT * 0.40) / BOOM_SPRITE_HEIGHT;
            const bScaledWidth = BOOM_SPRITE_WIDTH * bScale;
            const bScaledHeight = BOOM_SPRITE_HEIGHT * bScale;

            const bCol = currentBoomFrame % BOOM_SPRITE_COLS;
            const bRow = Math.floor(currentBoomFrame / BOOM_SPRITE_COLS);

            const bx = slotPositions[2] - bScaledWidth / 2;
            const by = characterY - (GAME_HEIGHT * 0.70) / 2 - bScaledHeight + boomSpriteOffsetY;

            ctx.drawImage(
                boomSpriteImage,
                bCol * BOOM_SPRITE_WIDTH, bRow * BOOM_SPRITE_HEIGHT,
                BOOM_SPRITE_WIDTH, BOOM_SPRITE_HEIGHT,
                Math.floor(bx), Math.floor(by),
                bScaledWidth, bScaledHeight
            );
        }

        // Draw the lagoon sprite above Rezzy's head if playing
        if (isPlayingLagoon && lagoonSpriteImage.complete && lagoonSpriteImage.width > 0) {
            const mScale = (GAME_HEIGHT * 0.40) / LAGOON_SPRITE_HEIGHT; // Scale it to a reasonable size
            const mScaledWidth = LAGOON_SPRITE_WIDTH * mScale;
            const mScaledHeight = LAGOON_SPRITE_HEIGHT * mScale;

            const mCol = currentLagoonFrame % LAGOON_SPRITE_COLS;
            const mRow = Math.floor(currentLagoonFrame / LAGOON_SPRITE_COLS);

            // Position above the item slot
            const mx = slotPositions[3] - mScaledWidth / 2;
            const my = characterY - (GAME_HEIGHT * 0.70) / 2 - mScaledHeight + lagoonSpriteOffsetY;

            ctx.drawImage(
                lagoonSpriteImage,
                mCol * LAGOON_SPRITE_WIDTH, mRow * LAGOON_SPRITE_HEIGHT,
                LAGOON_SPRITE_WIDTH, LAGOON_SPRITE_HEIGHT,
                Math.floor(mx), Math.floor(my),
                mScaledWidth, mScaledHeight
            );
        }

    // Draw Progress Bar at Top Middle
    if (progressBarImage.complete && progressBarImage.width > 0 &&
        progressBarFilledImage.complete && progressBarFilledImage.width > 0) {
        const pbScale = 0.65; // Adjust this scale if needed
        const pbWidth = progressBarImage.width * pbScale;
        const pbHeight = progressBarImage.height * pbScale;

        const pbX = (GAME_WIDTH - pbWidth) / 2;
        const pbY = 20; // 20 pixels from the top

        // Draw the empty background progress bar
        ctx.drawImage(
            progressBarImage,
            pbX, pbY,
            pbWidth, pbHeight
        );

        // The actual green bar in the image starts at x=433 and is 800 pixels wide (out of 1672)
        const greenStartX = 433;
        const greenWidth = 800;

        if (currentProgressBarFill > 0) {
            // Calculate how much of the image to reveal to show the correct amount of green
            let revealSourceWidth = greenStartX + (greenWidth * currentProgressBarFill);

            // If it's completely full, reveal the whole image to catch the right edge/glow
            if (currentProgressBarFill >= 1.0) {
                revealSourceWidth = progressBarFilledImage.width;
            }

            const revealDestWidth = revealSourceWidth * pbScale;

            // Draw the filled progress bar, revealing from left to right
            ctx.drawImage(
                progressBarFilledImage,
                0, 0, revealSourceWidth, progressBarFilledImage.height, // Source crop
                pbX, pbY, revealDestWidth, pbHeight // Destination bounds
            );
        }
    }

    // Draw Victory Text
    if (isVictoryState && document.fonts.check('12px Bangers')) {
        ctx.fillStyle = '#39FF14'; // Bright neon green
        ctx.strokeStyle = '#000000'; // Black outline
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.font = '150px Bangers';
        ctx.lineWidth = 10;

        const vicX = GAME_WIDTH / 2;
        const vicY = 350; // Moved lower, closer to the clients

        const vicText = `Level ${currentLevel} Complete`;
        ctx.strokeText(vicText, vicX, vicY);
        ctx.fillText(vicText, vicX, vicY);
    }

    // Draw Arrows in bottom corners
    // Draw Arrows in bottom corners
    if (arrowImage.complete && arrowImage.width > 0) {

        // ==========================================
        // 🔧 ARROW CONTROLS (TWEAK THESE NUMBERS!) 🔧
        // ==========================================

        // 1. SIZE: How tall the arrows are (in pixels)
        // Increase this number to make them bigger, decrease to make them smaller.
        const ARROW_SIZE = 400;

        // 2. HORIZONTAL SPACING: How close they are to the left/right edges
        // Positive numbers (e.g., 50) push them IN toward the center.
        // Negative numbers (e.g., -50) push them OUT past the edge (cropping them).
        const HORIZONTAL_PADDING = -160;

        // 3. VERTICAL SPACING: How close they are to the bottom edge
        // Positive numbers (e.g., 50) push them UP from the bottom.
        // Negative numbers (e.g., -20) push them DOWN off the bottom screen.
        const VERTICAL_PADDING = -10;

        // 4. BRIGHTNESS: How bright the arrows glow (100% is normal)
        const ARROW_BRIGHTNESS = '200%';

        // ==========================================

        const arrowScale = ARROW_SIZE / arrowImage.height;
        const arrowWidth = arrowImage.width * arrowScale;
        const arrowHeight = arrowImage.height * arrowScale;

        // Apply brightness filter and a subtle white glow
        ctx.filter = `brightness(${ARROW_BRIGHTNESS}) drop-shadow(0px 0px 10px rgba(255,255,255,0.5))`;

        // Bottom left arrow (flipped horizontally assuming original points right)
        ctx.save();
        ctx.translate(HORIZONTAL_PADDING + arrowWidth / 2, GAME_HEIGHT - VERTICAL_PADDING - arrowHeight / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(
            arrowImage,
            -arrowWidth / 2,
            -arrowHeight / 2,
            arrowWidth,
            arrowHeight
        );
        ctx.restore();

        // Bottom right arrow (normal orientation)
        ctx.drawImage(
            arrowImage,
            GAME_WIDTH - HORIZONTAL_PADDING - arrowWidth,
            GAME_HEIGHT - VERTICAL_PADDING - arrowHeight,
            arrowWidth,
            arrowHeight
        );

        // Reset filter for anything drawn after this
        ctx.filter = 'none';
    }

    // Reset filter
    ctx.filter = 'none';

    // Draw foreground overlay video on canvas (counter, portal, objects)
    // Drawing directly on canvas bypasses Safari's WebM alpha restriction
    const fgVid = document.getElementById('fg-video');
    if (fgVid && fgVid.readyState >= 2) {
        ctx.drawImage(fgVid, 0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}


spriteImage.onload = () => {
    gameLoop();
};

// ─── Mobile video unlock ───────────────────────────────────────────────────
// Mobile browsers (especially Safari) will not autoplay videos unless triggered
// by a user gesture. We detect this silently: if the bg video isn't playing
// after a short delay, we create a transparent overlay. The user taps it once
// (they often do this naturally to start playing), and the overlay vanishes.
const bgVideo = document.getElementById('bg-video');
const fgVideo = document.getElementById('fg-video');

// Attempt to play both videos immediately (works fine on desktop)
bgVideo.play().catch(() => {});
fgVideo.play().catch(() => {});

// After 800ms, check if the video actually started. If not, show unlock overlay.
setTimeout(() => {
    // paused means autoplay was blocked
    if (bgVideo.paused) {
        const overlay = document.createElement('div');
        overlay.id = 'video-unlock-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 9998;
            background: transparent;
            cursor: pointer;
        `;
        document.body.appendChild(overlay);

        const hint = document.createElement('div');
        hint.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            color: rgba(255,255,255,0.7);
            font-family: sans-serif;
            font-size: 18px;
            z-index: 9999;
            text-align: center;
            pointer-events: none;
        `;
        hint.textContent = 'Tap to begin';
        document.body.appendChild(hint);

        overlay.addEventListener('pointerdown', () => {
            bgVideo.play().catch(() => {});
            fgVideo.play().catch(() => {});
            overlay.remove();
            hint.remove();
        }, { once: true });
    }
}, 800);
