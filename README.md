

A quick and easy TapCap game bot, sorry Clix

Hopefully this acts as a guidline for how you can eventually combat this

## Features

* Uses `Function.prototype.bind` hooking to intercept the game's internal Player and Scene objects without exposing global variables.
*   **Adaptive actions**:
    *   **Human-Like Cruising**: Drifts naturally towards the center of gaps rather than snapping robotically.
    *   **Pro Lookahead**: Analyzes future obstacles before they even enter the screen to prepare for steep drops or climbs.
    *   **Gravity Assist**: Intentionally "hugs" the floor or ceiling of pipes to maximize momentum for the next move.
*   **Turbo Mode**: Automatically scales performance based on current score.
    *   *Low Score*: Adds human-like jitter, reaction delays, and sway.
    *   *High Score (150+)*: Removes limits, enabling frame-perfect inputs and zero-cooldown clicking to survive extreme speeds.
*   **Auto-Loop**: Automatically handles the "Tap to Start" screen, Game Over screen, and Main Menu to play infinitely without user input.
*   **Visual Debugger**: Real-time overlay showing the bot's target path, recognized obstacles, and safe corridors (Note* This feature disables at high speeds to ensure it runs smooth at higher speed gameplay.

## Installation

1.  Install the **Tampermonkey** extension for your browser:
    *   [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
    *   [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
    *   [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
2.  Click the Tampermonkey icon and select **"Create a new script..."**.
3.  Delete any default code and paste the content of `tapcap_bot.user.js` into the editor.
4.  File > **Save**.
5.  Navigate to [play.tapcapgame.com](https://play.tapcapgame.com/) and refresh the page.

## Usage

A control panel will appear in the top-right corner of the game screen.

*   **Auto Play**: Toggles the bot on/off.
*   **Show Debug Lines**: Toggles the visualizer (green line = target, red boxes = obstacles).
*   **Humanization**: Slider to adjust how "imperfect" the bot acts at low scores to avoid possible heuristics detections for leaderboards.
*   **Stop at Score**: Enter a number to auto-stop (e.g., `50`). Set to `0` for infinite play.
*   **Hotkey**: Press **`T`** to hide/show the menu.

## Internals

The bot operates by calculating a "Safe Gap" for every column of obstacles.

1.  **Gap Detection**: It identifies the vertical space between the top and bottom pipes.
2.  **Lookahead**: It scans the *next* incoming column to calculate the difference in height.
3.  **Biasing**:
    *   If the next gap is **Lower**, the bot biases its current target downwards (up to 80%) to prepare for the drop.
    *   If the next gap is **Higher**, it biases upwards to reduce the climb distance.
4.  **Execution**: It uses the game's native physics engine methods (`player.jump()`) or simulates raw pointer events to execute jumps only when necessary to maintain the calculated trajectory.

## Disclaimer

This script is for educational purposes only. Using automation tools in competitive games may violate the terms of service of the hosting website. Use responsibly.
