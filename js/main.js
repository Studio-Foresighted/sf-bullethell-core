import { Game } from './game.js';

// Bootstrap
window.addEventListener('DOMContentLoaded', async () => {
    const loadingScreen = document.getElementById('loading-screen');
    const startScreen = document.getElementById('start-screen');
    const loadingBar = document.querySelector('.loading-bar-fill');
    const loadingText = document.querySelector('.loading-text');
    const logoScreen = document.getElementById('logo-screen');
    
    // Show loading screen immediately
    logoScreen.style.display = 'none';
    loadingScreen.style.display = 'flex';
    startScreen.style.display = 'none';

    // Animate loading bar while config loads
    let progress = 0;
    const loadingInterval = setInterval(() => {
        if (progress < 90) {
            progress += Math.random() * 30;
            if (progress > 90) progress = 90;
            loadingBar.style.width = progress + '%';
            loadingText.textContent = Math.floor(progress) + '%';
        }
    }, 150);
    
    const game = new Game();
    
    // Wait for game to load config
    await new Promise(resolve => {
        const checkReady = () => {
            if (game.modelSelector.configLoaded) {
                resolve();
            } else {
                setTimeout(checkReady, 50);
            }
        };
        checkReady();
    });

    // Complete loading bar animation
    progress = 100;
    loadingBar.style.width = '100%';
    loadingText.textContent = '100%';
    clearInterval(loadingInterval);

    // Fade out loading screen and show start screen after brief delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    loadingScreen.style.display = 'none';
    startScreen.style.display = 'flex';

    // Update start screen with saved model info
    const display = document.getElementById('selected-model-display');
    const config = game.modelSelector.config;
    if (display && config.playerModel) {
        display.textContent = `Selected Model: ${config.playerModel}`;
    }
    
    // Start Button Logic
    const startBtn = document.getElementById('start-btn');
    const hud = document.getElementById('hud');

    startBtn.addEventListener('click', async () => {
        startScreen.style.display = 'none';
        hud.style.display = 'block';
        await game.start();
    });
});
