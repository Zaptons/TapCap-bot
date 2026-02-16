// ==UserScript==
// @name         FapCap bot by daddy
// @namespace    http://tampermonkey.net/
// @version      1
// @description  The ultimate fap buddy
// @author       Daddy
// @match        *://*.tapcapgame.com/*
// @match        *://tapcapgame.com/*
// @match        https://play.tapcapgame.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    let hookedPlayer = null;
    let hookedScene = null;
    let debugGraphics = null;
    
    let currentTargetId = null; 
    let reactionLock = 0;       
    let cruisingY = -1;         
    let lastRestartAttempt = 0;

    const originalBind = Function.prototype.bind;
    const originalToString = Function.prototype.bind.toString;

    Function.prototype.bind = function(...args) {
        const context = args[0];
        if (context && typeof context === 'object') {
            if (context.scene && context.playerType && context.body && typeof context.jump === 'function') {
                if (hookedPlayer !== context) {
                    hookedPlayer = context;
                    hookedScene = context.scene;
                }
            }
            if (context.sys && context.sys.settings && context.sys.settings.key === "Home") {
                 hookedScene = context;
            }
        }
        return originalBind.apply(this, args);
    };

    Function.prototype.bind.toString = function() {
        return originalToString.call(originalBind);
    };

    const CONFIG = {
        enabled: false,
        humanity: 0.1, 
        jumpCooldownBase: 60,
        debug: true,
        targetOffset: 20, 
        guiVisible: true,
        targetScore: 0
    };

    let lastJumpTime = 0;
    let guiContainer = null;

    function waitForBody(callback) {
        if (document.body) {
            callback();
        } else {
            const observer = new MutationObserver((mutations, obs) => {
                if (document.body) {
                    obs.disconnect();
                    callback();
                }
            });
            observer.observe(document.documentElement, { childList: true });
        }
    }

    function createGUI() {
        if (document.getElementById('tapcap-bot-gui')) return;

        guiContainer = document.createElement('div');
        guiContainer.id = 'tapcap-bot-gui';
        guiContainer.style.cssText = `
            position: fixed !important;
            top: 50px !important;
            right: 20px !important;
            z-index: 2147483647 !important;
            background: rgba(11, 25, 70, 0.95);
            color: white;
            padding: 15px;
            border-radius: 8px;
            border: 2px solid #00d2ff;
            font-family: Arial, sans-serif;
            box-shadow: 0 0 20px rgba(0,0,0,0.8);
            width: 220px;
            user-select: none;
            pointer-events: auto;
            display: block;
        `;
        
        const title = document.createElement('div');
        title.innerHTML = '🌭 FapCap Bot v1';
        title.style.cssText = 'font-weight: bold; margin-bottom: 12px; text-align: center; color: #00d2ff; font-size: 16px; border-bottom: 1px solid #4a90e2; padding-bottom: 5px;';
        guiContainer.appendChild(title);

        const toggleRow = document.createElement('div');
        toggleRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;';
        
        const label = document.createElement('span');
        label.innerText = 'Auto Play';
        label.style.fontWeight = 'bold';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.cssText = 'cursor: pointer; width: 20px; height: 20px;';
        checkbox.checked = CONFIG.enabled;
        checkbox.addEventListener('change', (e) => {
            CONFIG.enabled = e.target.checked;
            updateStatus();
        });

        toggleRow.appendChild(label);
        toggleRow.appendChild(checkbox);
        guiContainer.appendChild(toggleRow);

        const debugRow = document.createElement('div');
        debugRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;';
        
        const debugLabel = document.createElement('span');
        debugLabel.innerText = 'Show Debug Lines';
        debugLabel.style.fontSize = '12px';
        
        const debugCheckbox = document.createElement('input');
        debugCheckbox.type = 'checkbox';
        debugCheckbox.style.cssText = 'cursor: pointer; width: 16px; height: 16px;';
        debugCheckbox.checked = CONFIG.debug;
        debugCheckbox.addEventListener('change', (e) => {
            CONFIG.debug = e.target.checked;
            if(!CONFIG.debug && debugGraphics) debugGraphics.clear();
        });

        debugRow.appendChild(debugLabel);
        debugRow.appendChild(debugCheckbox);
        guiContainer.appendChild(debugRow);

        const sliderContainer = document.createElement('div');
        sliderContainer.style.marginBottom = '10px';
        
        const sliderLabel = document.createElement('div');
        sliderLabel.id = 'humanity-label';
        sliderLabel.innerText = 'Humanization: ' + (CONFIG.humanity * 100).toFixed(0) + '%';
        sliderLabel.style.cssText = 'font-size: 12px; margin-bottom: 5px; color: #ccc;';
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.value = (CONFIG.humanity * 100).toString();
        slider.style.width = '100%';
        slider.addEventListener('input', (e) => {
            CONFIG.humanity = parseInt(e.target.value) / 100;
            const lbl = document.getElementById('humanity-label');
            if(lbl) lbl.innerText = 'Humanization: ' + e.target.value + '%';
        });

        sliderContainer.appendChild(sliderLabel);
        sliderContainer.appendChild(slider);
        guiContainer.appendChild(sliderContainer);

        const scoreRow = document.createElement('div');
        scoreRow.style.cssText = 'display: flex; flex-direction: column; margin-bottom: 10px;';
        
        const scoreLabel = document.createElement('span');
        scoreLabel.innerText = 'Stop at Score (0 = Infinite)';
        scoreLabel.style.fontSize = '12px';
        scoreLabel.style.marginBottom = '5px';
        scoreLabel.style.color = '#ccc';
        
        const scoreInput = document.createElement('input');
        scoreInput.type = 'number';
        scoreInput.min = '0';
        scoreInput.value = '0';
        scoreInput.style.cssText = 'width: 100%; background: #050f42; color: white; border: 1px solid #4a90e2; padding: 5px; border-radius: 4px;';
        scoreInput.addEventListener('change', (e) => {
            CONFIG.targetScore = parseInt(e.target.value) || 0;
        });

        scoreRow.appendChild(scoreLabel);
        scoreRow.appendChild(scoreInput);
        guiContainer.appendChild(scoreRow);

        const statusDiv = document.createElement('div');
        statusDiv.id = 'bot-status';
        statusDiv.innerText = 'Status: Waiting...';
        statusDiv.style.cssText = 'text-align: center; font-size: 12px; color: #ffff00; margin-top: 8px; font-weight: bold;';
        guiContainer.appendChild(statusDiv);

        document.body.appendChild(guiContainer);
    }

    function updateStatus(text, color) {
        const statusDiv = document.getElementById('bot-status');
        if (!statusDiv) return;
        
        if (text) {
            statusDiv.innerText = text;
            if(color) statusDiv.style.color = color;
            return;
        }

        if (!hookedPlayer) {
            if (hookedScene && hookedScene.playBtn && hookedScene.playBtn.visible) {
                statusDiv.innerText = 'Status: In Menu';
                statusDiv.style.color = '#00ffff';
            } else {
                statusDiv.innerText = 'Status: Waiting for Game...';
                statusDiv.style.color = '#ffff00';
            }
        } else if (CONFIG.enabled) {
            statusDiv.innerText = 'Status: RUNNING';
            statusDiv.style.color = '#00ff00';
        } else {
            statusDiv.innerText = 'Status: IDLE';
            statusDiv.style.color = '#888';
        }
    }

    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 't') {
            CONFIG.guiVisible = !CONFIG.guiVisible;
            if (guiContainer) {
                guiContainer.style.display = CONFIG.guiVisible ? 'block' : 'none';
            }
        }
    });

    function updateDebug(scene, player, targetY, obstacles, gapTop, gapBottom, nextCenter) {
        if (!CONFIG.debug || !scene) return;

        if (!debugGraphics) {
            debugGraphics = scene.add.graphics();
            debugGraphics.setDepth(2147483647);
        }

        debugGraphics.clear();
        
        debugGraphics.lineStyle(2, 0xff0000, 0.8);
        obstacles.forEach(o => {
             if (o.getBounds) {
                 const b = o.getBounds();
                 debugGraphics.strokeRect(b.x, b.y, b.width, b.height);
             }
        });

        debugGraphics.lineStyle(2, 0xffff00, 0.8);
        debugGraphics.beginPath();
        debugGraphics.moveTo(player.x - 50, gapTop);
        debugGraphics.lineTo(player.x + 150, gapTop);
        debugGraphics.moveTo(player.x - 50, gapBottom);
        debugGraphics.lineTo(player.x + 150, gapBottom);
        debugGraphics.strokePath();

        if (nextCenter !== undefined) {
            debugGraphics.lineStyle(2, 0x00ffff, 0.5);
            debugGraphics.beginPath();
            debugGraphics.moveTo(player.x + 100, nextCenter);
            debugGraphics.lineTo(player.x + 400, nextCenter);
            debugGraphics.strokePath();
        }

        debugGraphics.lineStyle(2, 0x00ff00, 1);
        debugGraphics.beginPath();
        debugGraphics.moveTo(player.x, player.y);
        debugGraphics.lineTo(player.x + 100, targetY);
        debugGraphics.strokePath();

        debugGraphics.fillStyle(0x0000ff, 1);
        debugGraphics.fillCircle(player.x, player.y, 5);
    }

    function getGap(player, obstacles, sceneHeight, camera, currentScore) {
        const pWidth = player.width * player.scaleX;
        const playerLeft = player.x - (pWidth / 2);
        const viewRight = camera.scrollX + camera.width;

        const retentionBuffer = 10; 

        const relevant = obstacles.filter(o => {
            if (!o.active || !o.visible) return false;
            
            let rightEdge, leftEdge;
            if (o.getBounds) {
                const b = o.getBounds();
                rightEdge = b.right;
                leftEdge = b.left;
            } else {
                const oWidth = o.width * o.scaleX;
                rightEdge = o.x + (oWidth / 2); 
                leftEdge = o.x - (oWidth / 2);
            }
            
            const isBehind = rightEdge <= (playerLeft - retentionBuffer);
            if (isBehind) return false;

            if (leftEdge > (viewRight + 1200)) return false; 

            return true;
        });
        
        if (relevant.length === 0) {
            return null;
        }

        relevant.sort((a, b) => a.x - b.x);
        const nextX = relevant[0].x;
        const column = relevant.filter(o => Math.abs(o.x - nextX) < 40);
        const gapId = Math.floor(nextX);

        const bounds = column.map(o => {
            if (o.getBounds) {
                const b = o.getBounds();
                return { top: b.top, bottom: b.bottom };
            }
            const h = o.displayHeight;
            const y = o.y;
            return { top: y - (h/2), bottom: y + (h/2) };
        });

        bounds.push({ top: -9999, bottom: 0 });
        bounds.push({ top: sceneHeight, bottom: 9999 });
        bounds.sort((a, b) => a.top - b.top);

        let maxGap = 0;
        let gapInfo = { center: sceneHeight / 2, top: 0, bottom: sceneHeight };

        for (let i = 0; i < bounds.length - 1; i++) {
            const up = bounds[i];
            const down = bounds[i+1];
            const gapSize = down.top - up.bottom;
            if (gapSize > maxGap) {
                maxGap = gapSize;
                gapInfo = {
                    center: up.bottom + (gapSize / 2),
                    top: up.bottom,
                    bottom: down.top
                };
            }
        }
        
        const nextNextX = relevant.find(o => o.x > nextX + 150)?.x;
        let nextGapCenter = undefined;
        
        if (nextNextX) {
            const nextColumn = relevant.filter(o => Math.abs(o.x - nextNextX) < 40);
            
            let nextColLeft = 999999;
            nextColumn.forEach(o => {
                const x = o.getBounds ? o.getBounds().left : o.x;
                if(x < nextColLeft) nextColLeft = x;
            });

            if (nextColLeft < viewRight + 100) {
                const nextBounds = nextColumn.map(o => {
                     const h = o.displayHeight;
                     const y = o.y;
                     return { top: y - (h/2), bottom: y + (h/2) };
                });
                nextBounds.push({ top: -9999, bottom: 0 }, { top: sceneHeight, bottom: 9999 });
                nextBounds.sort((a, b) => a.top - b.top);
                
                let nextMaxGap = 0;
                let nextGapCenter = sceneHeight / 2;
                
                for (let i = 0; i < nextBounds.length - 1; i++) {
                    const gap = nextBounds[i+1].top - nextBounds[i].bottom;
                    if (gap > nextMaxGap) {
                        nextMaxGap = gap;
                        nextGapCenter = nextBounds[i].bottom + (gap / 2);
                    }
                }
                
                const diff = nextGapCenter - gapInfo.center;
                
                let biasFactor = 0;
                
                const urgency = Math.min(1, currentScore / 150);

                if (diff > 0) { 
                    biasFactor = 0.8 + (0.2 * urgency); 
                } else { 
                    biasFactor = 0.4 + (0.2 * urgency);
                }
                
                if (biasFactor > 1.0) biasFactor = 1.0;

                gapInfo.center += diff * biasFactor;

                let safePadding = 45 - (25 * urgency); 
                if (safePadding < 20) safePadding = 20;
                
                const safeCeiling = gapInfo.top + safePadding;
                const safeFloor = gapInfo.bottom - safePadding;
                
                if (safeCeiling > safeFloor) {
                     gapInfo.center = (gapInfo.top + gapInfo.bottom) / 2;
                } else {
                     if (gapInfo.center < safeCeiling) gapInfo.center = safeCeiling;
                     if (gapInfo.center > safeFloor) gapInfo.center = safeFloor;
                }
            }
        }

        return { 
            ...gapInfo, 
            relevant: column, 
            id: gapId,
            nextCenter: nextGapCenter
        };
    }

    function tryRestart(scene) {
        const time = Date.now();
        if (time - lastRestartAttempt < 1000) return; 
        lastRestartAttempt = time;

        const replayBtn = document.querySelector("#replayBtn");
        if (replayBtn && replayBtn.offsetParent !== null) {
            replayBtn.click();
            return;
        }

        if (scene && typeof scene.replayGame === 'function') {
             scene.replayGame();
             return;
        }

        if (scene && scene.sys && scene.sys.settings.key === "Home") {
             if (scene.playBtn && scene.playBtn.visible) {
                 scene.playBtn.emit('pointerdown');
                 return;
             }
        }
    }

    function update() {
        updateStatus();
        
        if (CONFIG.enabled && hookedScene && hookedScene.sys.settings.key === "Home") {
             if (hookedScene.playBtn && hookedScene.playBtn.active) {
                 tryRestart(hookedScene);
             }
             return;
        }

        if (!hookedPlayer || !hookedScene) return;

        const player = hookedPlayer;
        const scene = hookedScene;

        let currentScore = 0;
        if (scene.header && scene.header.scoreText) {
            currentScore = parseInt(scene.header.scoreText.text) || 0;
        }

        if (CONFIG.targetScore > 0 && currentScore >= CONFIG.targetScore) {
            CONFIG.enabled = false;
            const checkbox = document.querySelector('#tapcap-bot-gui input[type="checkbox"]');
            if (checkbox) checkbox.checked = false;
            return;
        }

        let currentHumanity = CONFIG.humanity;
        let currentCooldown = CONFIG.jumpCooldownBase;

        if (currentScore > 150) {
            currentHumanity = 0;
            currentCooldown = 0; 
        } else if (currentScore > 100) {
            currentHumanity *= 0.1;
            currentCooldown = 12;
        } else if (currentScore > 50) {
            currentHumanity *= 0.5;
            currentCooldown = 25;
        }

        if (scene.isGameOver || (scene.gameOver && scene.gameOver.visible)) {
             if (CONFIG.enabled) {
                 tryRestart(scene);
             }
             return;
        }

        if (scene.sys.settings.key !== "Game") {
            return;
        }

        const time = Date.now();

        if (player.isMoving === false) {
             if (CONFIG.enabled) {
                 if (time - lastJumpTime > 1000) {
                     if (typeof player.jump === 'function') {
                         player.jump();
                         lastJumpTime = time;
                     } else {
                         const canvas = document.querySelector('canvas');
                         if (canvas) {
                             const evt = new MouseEvent('pointerdown', {
                                 bubbles: true,
                                 cancelable: true,
                                 view: window
                             });
                             canvas.dispatchEvent(evt);
                             lastJumpTime = time;
                         }
                     }
                 }
             }
             return;
        }

        if (!player.active || !player.body) return;
        if (!scene.obstacleMgr) return;
        if (!CONFIG.enabled) {
             if(debugGraphics) debugGraphics.clear();
             return;
        }

        const obstacles = scene.obstacleMgr.obstacles;
        const sceneHeight = scene.scale.height;
        const camera = scene.cameras.main;
        
        const gap = getGap(player, obstacles, sceneHeight, camera, currentScore);

        let targetY;
        let gapTop = 0;
        let gapBottom = sceneHeight;
        let relevant = [];
        let nextCenter = undefined;

        if (gap) {
            if (gap.id !== currentTargetId) {
                const delay = 5 * currentHumanity;
                reactionLock = time + delay;
                currentTargetId = gap.id;
            }

            if (time > reactionLock) {
                cruisingY = gap.center;
            }

            gapTop = gap.top;
            gapBottom = gap.bottom;
            relevant = gap.relevant;
            nextCenter = gap.nextCenter;
        } else {
            currentTargetId = null;
            if (cruisingY < 0) cruisingY = sceneHeight / 2;
            cruisingY += ((sceneHeight / 2) - cruisingY) * 0.005;
        }

        const perfectTargetY = cruisingY;

        if (currentScore > 180 && CONFIG.debug) {
            CONFIG.debug = false;
            if (debugGraphics) debugGraphics.clear();
            const box = document.querySelector('#tapcap-bot-gui input[type="checkbox"][style*="16px"]');
            if(box) box.checked = false;
        }

        updateDebug(scene, player, perfectTargetY + CONFIG.targetOffset, relevant, gapTop, gapBottom, nextCenter);

        const sway = Math.sin(time / 400) * (20 * currentHumanity);
        const noise = (Math.random() - 0.5) * (30 * currentHumanity);
        
        targetY = perfectTargetY + CONFIG.targetOffset + sway + noise;

        const playerY = player.y;
        const velocityY = player.body.velocity.y;
        const dy = playerY - targetY;
        const cooldown = currentCooldown + (Math.random() * 10 * currentHumanity);

        if (time - lastJumpTime > cooldown) {
            const distToTop = playerY - gapTop;
            
            let shouldJump = false;

            if (dy > 0 && velocityY > -5) {
                shouldJump = true;
            }

            if (dy > 40 && velocityY > -15) {
                shouldJump = true;
            }

            if (shouldJump) {
                const unsafeCeiling = distToTop < 60;
                if (unsafeCeiling && velocityY < -2) {
                    shouldJump = false;
                }
            }

            if (shouldJump) {
                if (typeof player.jump === 'function') {
                    player.jump();
                    lastJumpTime = time;
                } else {
                    const canvas = document.querySelector('canvas');
                    if (canvas) {
                        const evt = new MouseEvent('pointerdown', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        canvas.dispatchEvent(evt);
                        lastJumpTime = time;
                    }
                }
            }
        }
    }

    waitForBody(() => {
        const interval = setInterval(() => {
            if (!document.getElementById('tapcap-bot-gui')) {
                createGUI();
            } else {
                clearInterval(interval);
            }
        }, 1000);
        
        setInterval(update, 16);
    });

})();
