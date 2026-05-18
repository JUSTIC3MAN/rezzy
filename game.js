const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const bgVideo = document.getElementById('bg-video');

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
let isCutscenePlaying = false; // Set to true when cutscene is playing
let isModalOpen = false; // Set to true when leaderboard or name entry is open


// Variables for the fairy bottle position and scale
// (Approximate position for the leftmost box on the wagon)
let fairyX = GAME_WIDTH * 0.25;
let fairyY = GAME_HEIGHT * 0.85;
let fairyScale = 0.47; // Adjusted for resized image (was 0.08 for 3046px, now 512px)

// Variables for the blue lightning position and scale (second box)
let lightningX = GAME_WIDTH * 0.40; // Shifted right from the first box
let lightningY = GAME_HEIGHT * 0.85; // Same height
let lightningScale = 0.47;

// Variables for the red white and boom position and scale (third box)
let boomX = GAME_WIDTH * 0.55; // Shifted right from the second box
let boomY = GAME_HEIGHT * 0.85; // Same height
let boomScale = 0.47;

// Variables for the mermaid lagoon position and scale (fourth box)
let lagoonX = GAME_WIDTH * 0.70; // Shifted right from the third box
let lagoonY = GAME_HEIGHT * 0.85; // Same height
let lagoonScale = 0.47;

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
// NOTE: FRAME_WIDTH/HEIGHT are computed dynamically after images load to ensure perfect alignment
const COLS = 5;
const ROWS = 11;
const TOTAL_FRAMES = 52;
let FRAME_WIDTH = 320;  // Initial fallback (updated on load)
let FRAME_HEIGHT = 178; // Initial fallback (updated on load)

// Animation variables for the 5x9 sprite sheet (Grab)
const GRAB_COLS = 5;
const GRAB_ROWS = 9;
const GRAB_TOTAL_FRAMES = 43; // Based on 9 rows, stopping before the empty frames at the end
let GRAB_FRAME_HEIGHT = 177.56; // Exact fallback (1598/9); recomputed dynamically on load
let isGrabbing = false;
let currentGrabFrame = 0;
let grabFrameTimer = 0;
const grabFrameDelay = 4; // Faster grab animation
// Offsets to fine-tune the alignment between Grab and Idle if needed
let grabOffsetX = 0;
let grabOffsetY = 0;

// Fairy Sprite animation variables
// NOTE: Sprite sheets resized from 2000px to 800px wide, frames are now 160x160 (was 400x400)
const FAIRY_SPRITE_WIDTH = 160;
const FAIRY_SPRITE_HEIGHT = 160;
const FAIRY_SPRITE_COLS = 5;
const FAIRY_SPRITE_TOTAL_FRAMES = 81;
let isPlayingFairy = false;
let currentFairyFrame = 0;
let fairyFrameTimer = 0;
const fairySpriteDelay = 4;
let fairySpriteOffsetY = 250;

// Lightning Sprite animation variables
const LIGHTNING_SPRITE_WIDTH = 160;
const LIGHTNING_SPRITE_HEIGHT = 160;
const LIGHTNING_SPRITE_COLS = 5;
const LIGHTNING_SPRITE_TOTAL_FRAMES = 51;
let isPlayingLightning = false;
let currentLightningFrame = 0;
let lightningFrameTimer = 0;
const lightningSpriteDelay = 4;
let lightningSpriteOffsetY = 250;

// Boom Sprite animation variables
const BOOM_SPRITE_WIDTH = 160;
const BOOM_SPRITE_HEIGHT = 160;
const BOOM_SPRITE_COLS = 5;
const BOOM_SPRITE_TOTAL_FRAMES = 81;
let isPlayingBoom = false;
let currentBoomFrame = 0;
let boomFrameTimer = 0;
const boomSpriteDelay = 4;
let boomSpriteOffsetY = 250;

// Lagoon Sprite animation variables
const LAGOON_SPRITE_WIDTH = 160;
const LAGOON_SPRITE_HEIGHT = 160;
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
    freezeTimer = 20; // Reduced freeze input to 1/3 second (20 frames) for snappier gameplay
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
                                let cutsceneSrc = null;
                                let nextBgSrc = 'backgroundloop/Level2Background.webm';
                                
                                if (currentLevel === 1) {
                                    cutsceneSrc = 'backgroundloop/Cutscene.webm';
                                } else if (currentLevel === 2) {
                                    cutsceneSrc = 'backgroundloop/cutscene2.webm';
                                } else if (currentLevel === 3) {
                                    cutsceneSrc = 'backgroundloop/Cutscene3.webm';
                                }

                                if (cutsceneSrc) {
                                    // Start cutscene
                                    isCutscenePlaying = true;
                                    canvas.style.display = 'none';
                                    const trophyBtn = document.getElementById('trophy-btn');
                                    if (trophyBtn) trophyBtn.style.display = 'none';

                                    bgVideo.src = cutsceneSrc;
                                    bgVideo.loop = false;
                                    bgVideo.load();
                                    bgVideo.play();

                                    bgVideo.onended = () => {
                                        bgVideo.src = nextBgSrc;
                                        bgVideo.loop = true;
                                        bgVideo.load();
                                        bgVideo.play();
                                        
                                        canvas.style.display = 'block';
                                        if (trophyBtn) trophyBtn.style.display = 'block';
                                        
                                        isCutscenePlaying = false;
                                        isVictoryState = false;
                                        
                                        currentLevel++;
                                        maxOrdersForLevel = 15;
                                        totalCorrectOrders = 0;
                                        currentProgressBarFill = 0; // Reset visual gauge instantly
                                        
                                        // Generate the first order for the new level
                                        let newItemIndex = Math.floor(Math.random() * 4);
                                        activeOrders.push({
                                            customerIndex: nextCustomerIndex,
                                            itemIndex: newItemIndex,
                                            revealProgress: 0
                                        });
                                        nextCustomerIndex = (nextCustomerIndex + 1) % 5;
                                    };
                                } else {
                                    currentLevel++;
                                    maxOrdersForLevel = 15;
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
                                }
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
                        if (currentStreak > 0) {
                            showNameEntryModal(currentStreak);
                        }
                        currentStreak = 0;
                    }
                }
}

window.addEventListener('keydown', (e) => {
    // Prevent any input if the player is currently frozen, in victory state, or a modal is open
    if (freezeTimer > 0 || isVictoryState || isCutscenePlaying || isModalOpen) return;

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
                isGrabbing = false;
            }
        } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
            if (currentSlot < 3) {
                currentSlot++;
                targetX = slotPositions[currentSlot];
                isGrabbing = false;
            }
        }
    }
});

// Mobile support: listen to pointerdown events (mouse or touch)
window.addEventListener('pointerdown', (e) => {
    // If the game hasn't started yet, tapping the screen handles start logic, not gameplay
    if (freezeTimer > 0 || isVictoryState || isCutscenePlaying || isModalOpen) return;
    
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
            isGrabbing = false;
        }
    }
    // Hitbox for Right Arrow (bottom right, roughly right 25%)
    else if (x > GAME_WIDTH * 0.75 && y > GAME_HEIGHT * 0.70) {
        if (currentSlot < 3) {
            currentSlot++;
            targetX = slotPositions[currentSlot];
            isGrabbing = false;
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

    // Update animations — full idle + grab cycles restored.
    // Vertical stability is now guaranteed by using exact float FRAME_HEIGHT (no Math.floor)
    // in the draw call, so row * FRAME_HEIGHT is always precise with zero accumulation error.
    if (!isGrabbing) {
        frameTimer++;
        if (frameTimer >= frameDelay) {
            frameTimer = 0;
            currentFrame = (currentFrame + 1) % TOTAL_FRAMES;
        }
    } else {
        grabFrameTimer++;
        if (grabFrameTimer >= grabFrameDelay) {
            grabFrameTimer = 0;
            currentGrabFrame++;
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


    // ── Draw thought bubbles FIRST (behind Rezzy) ──────────────────────────────
    // Draw active thought bubbles
    if (!isVictoryState && thoughtBubbleImage.complete && thoughtBubbleImage.width > 0) {
        const customerOffsets = [0.35, 0.47, 0.58, 0.70, 0.82];
        const itemImages = [fairyImage, lightningImage, boomImage, lagoonImage];

        activeOrders.forEach((order, index) => {
            const offset = customerOffsets[order.customerIndex];
            const charX = GAME_WIDTH * offset;

            const bubbleScale = (GAME_HEIGHT * 0.22) / thoughtBubbleImage.height;
            const bubbleWidth = thoughtBubbleImage.width * bubbleScale;
            const bubbleHeight = thoughtBubbleImage.height * bubbleScale;
            const bubbleY = (GAME_HEIGHT * 0.515) - 220;

            ctx.drawImage(
                thoughtBubbleImage,
                Math.floor(charX - bubbleWidth / 2),
                Math.floor(bubbleY - bubbleHeight / 2),
                bubbleWidth,
                bubbleHeight
            );

            const orderImage = itemImages[order.itemIndex];
            if (orderImage && orderImage.complete && orderImage.width > 0) {
                const drinkScale = (bubbleHeight * 0.5) / orderImage.height;
                const drinkWidth = orderImage.width * drinkScale;
                const drinkHeight = orderImage.height * drinkScale;
                const destX = charX - drinkWidth / 2;
                const destY = (bubbleY - bubbleHeight / 2) + (bubbleHeight * 0.38) - (drinkHeight / 2);
                const revealProgress = order.revealProgress;

                if (revealProgress < 1.0) {
                    ctx.filter = 'brightness(0)';
                    ctx.drawImage(orderImage, Math.floor(destX), Math.floor(destY), drinkWidth, drinkHeight);
                    ctx.filter = 'none';
                    if (revealProgress > 0) {
                        const sourceRevealH = orderImage.height * revealProgress;
                        const destRevealH = drinkHeight * revealProgress;
                        ctx.drawImage(
                            orderImage,
                            0, orderImage.height - sourceRevealH, orderImage.width, sourceRevealH,
                            Math.floor(destX), Math.floor(destY + drinkHeight - destRevealH), drinkWidth, destRevealH
                        );
                    }
                } else {
                    ctx.drawImage(orderImage, Math.floor(destX), Math.floor(destY), drinkWidth, drinkHeight);
                }
            }
        });
    }

    // ── Draw Rezzy SECOND (in front of customers) ──────────────────────────────
    const activeImage = isGrabbing ? grabImage : spriteImage;
    const activeFrame = isGrabbing ? currentGrabFrame : currentFrame;
    const activeCols = isGrabbing ? GRAB_COLS : COLS;

    if (activeImage.complete && activeImage.width > 0) {
        const activeFrameH = isGrabbing ? GRAB_FRAME_HEIGHT : FRAME_HEIGHT;
        const scale = (GAME_HEIGHT * 0.70) / activeFrameH;
        const scaledWidth = FRAME_WIDTH * scale;
        const scaledHeight = activeFrameH * scale;
        const col = activeFrame % activeCols;
        const row = Math.floor(activeFrame / activeCols);
        const currentOffsetX = isGrabbing ? grabOffsetX : 0;
        const currentOffsetY = isGrabbing ? grabOffsetY : 0;

        ctx.drawImage(
            activeImage,
            col * FRAME_WIDTH, row * activeFrameH,
            FRAME_WIDTH, activeFrameH,
            Math.floor(characterX - scaledWidth / 2 + currentOffsetX),
            Math.floor(characterY - scaledHeight / 2 + currentOffsetY),
            scaledWidth,
            scaledHeight
        );
    }

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
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}


// ─── Asset Loading & Game Start ─────────────────────────────────────────────
// Wait for ALL critical images to load before starting the game loop.
// On mobile, we can't start until everything is ready or items will be invisible.

const criticalImages = [
    spriteImage,
    grabImage,
    fairyImage,
    lightningImage,
    boomImage,
    lagoonImage,
    thoughtBubbleImage,
    progressBarImage,
    progressBarFilledImage,
    arrowImage,
];

// Removed Safari / iOS fix since WebM alpha issue is resolved by removing fg-video

let loadedCount = 0;
let gameLoopStarted = false;

function tryStartGame() {
    if (gameLoopStarted) return;
    loadedCount++;
    if (loadedCount >= criticalImages.length) {
        gameLoopStarted = true;

        // Compute exact (float) frame dimensions from actual image pixels.
        // Do NOT use Math.floor — the sheet heights (1954, 1598) are not evenly
        // divisible by their row counts (11, 9), so flooring causes accumulating
        // source-Y error that manifests as vertical drift during animation.
        if (spriteImage.naturalWidth > 0) {
            FRAME_WIDTH       = spriteImage.naturalWidth  / COLS; // 1600/5 = 320 exactly
            FRAME_HEIGHT      = spriteImage.naturalHeight / ROWS; // 1954/11 = 177.636...
        }
        if (grabImage.naturalWidth > 0) {
            GRAB_FRAME_HEIGHT = grabImage.naturalHeight / GRAB_ROWS; // 1598/9 = 177.556...
        }

        gameLoop();
    }
}

criticalImages.forEach(img => {
    if (img.complete && img.naturalWidth > 0) {
        tryStartGame(); // Already loaded (e.g. from cache)
    } else {
        img.addEventListener('load', tryStartGame);
        img.addEventListener('error', tryStartGame); // Don't block on broken assets
    }
});

// ─── Mobile video unlock ─────────────────────────────────────────────────────
// Mobile Safari blocks autoplay. We detect this and show a subtle "Tap to begin"
// prompt. On desktop this never appears.
// bgVideo is already declared at the top of the file

// Try to play immediately (works on desktop and Android Chrome)
bgVideo.play().catch(() => {});

setTimeout(() => {
    if (!bgVideo.paused) return; // Already playing - no need for overlay

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0;
        width: 100%; height: 100%;
        z-index: 9998; background: transparent; cursor: pointer;
    `;
    document.body.appendChild(overlay);

    const hint = document.createElement('div');
    hint.style.cssText = `
        position: fixed; bottom: 40px; left: 50%;
        transform: translateX(-50%);
        color: rgba(255,255,255,0.85); font-family: sans-serif;
        font-size: 22px; z-index: 9999; text-align: center;
        pointer-events: none; text-shadow: 0 0 10px #000;
        background: rgba(0,0,0,0.5); padding: 12px 24px; border-radius: 30px;
    `;
    hint.textContent = '▶  Tap to begin';
    document.body.appendChild(hint);

    overlay.addEventListener('pointerdown', () => {
        bgVideo.play().catch(() => {});
        overlay.remove();
        hint.remove();
    }, { once: true });
}, 1200);

// ─── Leaderboard & Modals Logic ──────────────────────────────────────────────
const trophyBtn = document.getElementById('trophy-btn');
const nameModal = document.getElementById('name-modal');
const leaderboardModal = document.getElementById('leaderboard-modal');
const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
const submitScoreBtn = document.getElementById('submit-score-btn');
const skipScoreBtn = document.getElementById('skip-score-btn');
const playerNameInput = document.getElementById('player-name');
const finalStreakSpan = document.getElementById('final-streak');
const leaderboardList = document.getElementById('leaderboard-list');

let scoreToSubmit = 0;

function resetGame() {
    currentLevel = 1;
    maxOrdersForLevel = 10;
    totalCorrectOrders = 0;
    currentProgressBarFill = 0;
    currentStreak = 0;
    
    // Clear active orders
    activeOrders.length = 0;
    nextCustomerIndex = 0;
    
    // Generate new first order
    let newItemIndex = Math.floor(Math.random() * 4);
    activeOrders.push({
        customerIndex: nextCustomerIndex,
        itemIndex: newItemIndex,
        revealProgress: 0
    });
    nextCustomerIndex = (nextCustomerIndex + 1) % 5;
}

function showNameEntryModal(streak) {
    scoreToSubmit = streak;
    finalStreakSpan.textContent = streak;
    nameModal.style.display = 'flex';
    isModalOpen = true;
    playerNameInput.value = '';
    playerNameInput.focus();
    resetGame();
}

function showLeaderboardModal() {
    leaderboardModal.style.display = 'flex';
    isModalOpen = true;
    fetchLeaderboard();
}

function closeModals() {
    nameModal.style.display = 'none';
    leaderboardModal.style.display = 'none';
    isModalOpen = false;
}

trophyBtn.addEventListener('click', () => {
    if (!isModalOpen) showLeaderboardModal();
});

closeLeaderboardBtn.addEventListener('click', closeModals);

skipScoreBtn.addEventListener('click', closeModals);

submitScoreBtn.addEventListener('click', async () => {
    const name = playerNameInput.value.trim().substring(0, 7);
    if (!name) {
        alert('Please enter a name!');
        return;
    }

    submitScoreBtn.disabled = true;
    submitScoreBtn.textContent = 'Submitting...';

    try {
        const response = await fetch('/api/submit-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, score: scoreToSubmit })
        });
        
        if (response.ok) {
            nameModal.style.display = 'none';
            showLeaderboardModal();
        } else {
            console.error('Failed to submit score');
        }
    } catch (e) {
        console.error(e);
    } finally {
        submitScoreBtn.disabled = false;
        submitScoreBtn.textContent = 'Submit Score';
    }
});

async function fetchLeaderboard() {
    leaderboardList.innerHTML = '<p>Loading scores...</p>';
    try {
        const response = await fetch('/api/get-scores');
        const data = await response.json();
        
        if (data.success && data.scores.length > 0) {
            leaderboardList.innerHTML = '';
            data.scores.forEach((entry, index) => {
                const div = document.createElement('div');
                div.className = 'leaderboard-entry';
                div.innerHTML = `<span>#${index + 1} ${entry.name}</span><span>${entry.score}</span>`;
                leaderboardList.appendChild(div);
            });
        } else {
            leaderboardList.innerHTML = '<p>No scores yet! Be the first!</p>';
        }
    } catch (e) {
        console.error(e);
        leaderboardList.innerHTML = '<p>Error loading scores.</p>';
    }
}
