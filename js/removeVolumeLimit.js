// // SVG for volume button
// const volumeSvg = `
// <svg id="volumesvg" fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="m18 15.5v-7m0 0-2 2m2-2 2 2m-8 8.5v-14.00001c0-.82404-.9408-1.29442-1.6-.8l-4.4 4.29999h-2c-.55228 0-1 .44772-1 1v5.00002c0 .5523.44772 1 1 1h2l4.3464 4.4451c.0357.0365.0736.0712.1169.0983.6544.4085 1.5367-.2454 1.5367-1.0434z" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>
// `;
// // Function to create control button
// function createControlButton(html, action) {
//     const button = document.createElement('button');
//     button.innerHTML = html;
//     button.className = 'vjs-control vjs-button'; // Add Video.js specific classes for styling
//     button.style.padding = '0 8px';
//     button.style.marginLeft = '5px';
//     button.style.fontSize = '14px';
//     button.style.color = '#FFF';
//     button.style.backgroundColor = 'transparent';
//     button.style.border = 'none';
//     button.style.cursor = 'pointer';
//     button.style.borderRadius = '2px';
//     button.addEventListener('click', action);
//     return button;
// }

// // Select control bar and volume panel
// const controlBar = document.querySelector('.vjs-control-bar');
// const volumePanel = controlBar.querySelector('.vjs-volume-panel.vjs-control.vjs-volume-panel-horizontal');

// // State to track volume boost
// let volumeBoosted = false;

// // Create the gain node and audio context
// let audioContext, gainNode;

// const videonew = document.querySelector('video');
// if (videonew) {
//     console.log('Video element found');

//     // Create an audio context
//     audioContext = new (window.AudioContext || window.webkitAudioContext)();

//     // Create a media element source
//     const source = audioContext.createMediaElementSource(videonew);

//     // Create a gain node
//     gainNode = audioContext.createGain();

//     // Connect the source to the gain node and the gain node to the audio context destination
//     source.connect(gainNode);
//     gainNode.connect(audioContext.destination);

//     // Ensure the audio context is resumed on user interaction
//     document.addEventListener('click', () => {
//         if (audioContext.state === 'suspended') {
//             audioContext.resume().then(() => {
//                 console.log('Audio context resumed');
//             });
//         }
//     });

//     console.log('Audio context and gain node setup complete');
// } else {
//     console.log('No video element found');
// }

// // Function to toggle volume boost
// function toggleVolumeBoost() {
//     if (!gainNode) return;
//     volumeBoosted = !volumeBoosted;
//     gainNode.gain.value = volumeBoosted ? 10 : 1; // 10 times the original volume or normal
//     volumeBoostButton.classList.toggle('flipped-svg', volumeBoosted); // Toggle the flipped class
//     console.log(`Volume boost ${volumeBoosted ? 'enabled' : 'disabled'}`);
// }

// // Create the control button and add it to the control bar
// const volumeBoostButton = createControlButton(volumeSvg, toggleVolumeBoost);
// controlBar.insertBefore(volumeBoostButton, volumePanel);
