
const tenMinIcon = `<svg width="26" height="18" viewBox="0 0 26 18" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M15.8189 1.43219V3.8397C14.9972 2.60214 13.8687 1.59876 12.5435 0.927454C11.2183 0.256148 9.74168 -0.0601476 8.25778 0.00943265C6.77388 0.0790129 5.33336 0.532092 4.07679 1.32446C2.82022 2.11682 1.79053 3.22141 1.0882 4.53042C0.385858 5.83944 0.0348664 7.30817 0.0694709 8.7933C0.104075 10.2784 0.523094 11.7292 1.28564 13.0041C2.04818 14.279 3.1282 15.3344 4.42031 16.0674C5.71242 16.8004 7.17248 17.1859 8.65801 17.1863V15.7541C7.40115 15.7535 6.16658 15.4221 5.07836 14.7932C3.99015 14.1643 3.08662 13.2601 2.45858 12.1714C1.83053 11.0827 1.5001 9.84787 1.50047 8.59101C1.50084 7.33414 1.83201 6.09951 2.4607 5.01119C3.08939 3.92286 3.99345 3.01918 5.08204 2.39094C6.17063 1.7627 7.40539 1.43204 8.66226 1.43219C9.91912 1.43234 11.1538 1.76329 12.2422 2.39179C13.3307 3.02028 14.2345 3.92418 14.863 5.01266H12.2385V6.44485H15.8189C16.1988 6.44485 16.5631 6.29396 16.8317 6.02537C17.1002 5.75678 17.2511 5.3925 17.2511 5.01266V1.43219H15.8189Z" fill="white"/>
<path d="M9.3741 9.30922H5.07754V7.87704H7.94191V4.29657H9.3741V9.30922Z" fill="white"/>
<path d="M15.1029 17.1863C14.5331 17.1863 13.9867 16.9599 13.5838 16.557C13.1809 16.1542 12.9546 15.6077 12.9546 15.038V12.8897C12.9546 12.3199 13.1809 11.7735 13.5838 11.3706C13.9867 10.9677 14.5331 10.7414 15.1029 10.7414C15.6726 10.7414 16.219 10.9677 16.6219 11.3706C17.0248 11.7735 17.2511 12.3199 17.2511 12.8897V15.038C17.2511 15.6077 17.0248 16.1542 16.6219 16.557C16.219 16.9599 15.6726 17.1863 15.1029 17.1863ZM15.1029 12.1736C14.9129 12.1736 14.7308 12.249 14.5965 12.3833C14.4622 12.5176 14.3868 12.6998 14.3868 12.8897V15.038C14.3868 15.2279 14.4622 15.41 14.5965 15.5443C14.7308 15.6786 14.9129 15.7541 15.1029 15.7541C15.2928 15.7541 15.4749 15.6786 15.6092 15.5443C15.7435 15.41 15.8189 15.2279 15.8189 15.038V12.8897C15.8189 12.6998 15.7435 12.5176 15.6092 12.3833C15.4749 12.249 15.2928 12.1736 15.1029 12.1736Z" fill="white"/>
<path d="M12.2385 17.1863H10.8063V13.1862L9.88038 14.1121L8.86782 13.0995L11.0161 10.9512C11.1163 10.8511 11.2438 10.7829 11.3827 10.7553C11.5216 10.7277 11.6656 10.7419 11.7964 10.7961C11.9272 10.8503 12.0391 10.942 12.1177 11.0597C12.1964 11.1775 12.2384 11.3159 12.2385 11.4575V17.1863Z" fill="white"/>
<path d="M23.7083 17.1863V15.0994C23.7083 14.6765 23.4517 14.4408 23.0635 14.4408C22.6683 14.4408 22.4187 14.6765 22.4187 15.0994V17.1863H21.0598V15.0994C21.0598 14.6765 20.8103 14.4408 20.422 14.4408C20.0199 14.4408 19.7703 14.6765 19.7703 15.0994V17.1863H18.4114V13.2968H19.7703V13.8099C19.9922 13.4979 20.3735 13.2622 20.9004 13.2622C21.4828 13.2622 21.9403 13.5256 22.1969 13.9763C22.4603 13.5811 22.9179 13.2622 23.4933 13.2622C24.4778 13.2622 25.0671 13.9 25.0671 14.9192V17.1863H23.7083Z" fill="white"/>
</svg>


`


function addVideoControlButtons() {
    // Find the video element and control bar
    const video = document.querySelector('video');
    const controlBar = document.querySelector('.vjs-control-bar');
    // Find the fullscreen button to insert custom buttons before it
    const fullscreenButton = controlBar.querySelector('.vjs-volume-panel.vjs-control.vjs-volume-panel-horizontal');
    const screenInScreenButton = controlBar.querySelector('.vjs-picture-in-picture-control.vjs-control.vjs-button');

    if (video && controlBar && fullscreenButton) {
        // Create the Skip Forward +10s Button
        // const skipForwardButton = createControlButton('+10s', () => {
        //     video.currentTime += 10;
        //     ensurePlayback(video);
        // });

        // Create the Skip Backward -10s Button
        // const skipBackwardButton = createControlButton('-10s', () => {
        //     video.currentTime -= 10;
        //     ensurePlayback(video);
        // });

        const skipForward10Button = createControlButton(tenMinIcon, () => {
            video.currentTime += 10*60;
            ensurePlayback(video);
        });

        // Insert buttons before the fullscreen button
        // controlBar.insertBefore(skipBackwardButton, screenInScreenButton);
        // controlBar.insertBefore(skipForwardButton, screenInScreenButton);
        controlBar.insertBefore(skipForward10Button, fullscreenButton);

        // Create the time remaining display
        const timeRemainingDisplay = document.createElement('span');
        timeRemainingDisplay.className = 'vjs-time-remaining vjs-control vjs-button';
        timeRemainingDisplay.style.marginLeft = '10px';
        timeRemainingDisplay.style.color = '#FFF';

        const progBar = document.querySelector('.vjs-progress-control.vjs-control');

        controlBar.insertBefore(timeRemainingDisplay, progBar);

        // Update the time remaining display initially
        updateTimeRemainingDisplay(video, timeRemainingDisplay);

        // Update the time remaining display periodically
        video.addEventListener('timeupdate', () => {
            updateTimeRemainingDisplay(video, timeRemainingDisplay);
        });

        // Add keyboard event listeners for 10s jumps
        document.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowRight') {
                event.preventDefault(); // Prevent default spacebar action (scrolling)
                video.currentTime += 9;
                ensurePlayback(video);
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault(); // Prevent default spacebar action (scrolling)
                video.currentTime -= 9;
                
            }
            else if (event.key === ' ') {
                event.preventDefault(); // Prevent default spacebar action (scrolling)
                if (video.paused) {
                    video.play();
                } else {
                    video.pause();
                }
            }
        });

        // Add keyboard event listeners for changing speed
document.addEventListener('keydown', (event) => {
    event.preventDefault(); // Prevent default action (scrolling)
    const currentSpeed = document.querySelector('.vjs-playback-rate li.vjs-selected');
    const speedlist = document.querySelectorAll('.vjs-playback-rate li');
    
    if (event.key === 'ArrowDown') {
        event.preventDefault(); // Prevent default action (scrolling)
        let nextSpeed = currentSpeed.nextElementSibling;
        
        if (!nextSpeed) {
            // If no next sibling, loop back to the first item
            nextSpeed = speedlist[0];
        }
        
        nextSpeed.click();
        video.focus();
        event.preventDefault(); // Prevent default action (scrolling)
    } else if (event.key === 'ArrowUp') {
        
        event.preventDefault(); // Prevent default action (scrolling)
        let previousSpeed = currentSpeed.previousElementSibling;
        
        if (!previousSpeed) {
            // If no previous sibling, loop to the last item
            previousSpeed = speedlist[speedlist.length - 1];
        }
        event.preventDefault(); // Prevent default action (scrolling)
        previousSpeed.click();
        event.preventDefault(); // Prevent default action (scrolling)
        video.focus();
        event.preventDefault(); // Prevent default action (scrolling)
    }
});


        document.addEventListener('fullscreenchange', () => {

                video.focus();

         
        });

    } else {
    }
}

function createControlButton(label, action) {
    const button = document.createElement('button');
    button.innerHTML = label;
    button.className = 'vjs-control vjs-button'; // Add Video.js specific classes for styling
    button.style.padding = '0 8px';
    button.style.marginLeft = '5px';
    button.style.fontSize = '14px';
    button.style.color = '#FFF';
    button.style.backgroundColor = 'transparent';
    button.style.border = 'none';
    button.style.cursor = 'pointer';
    button.style.borderRadius = '2px';
    button.addEventListener('click', action);
    return button;
}

function ensurePlayback(video) {
    if (video.paused) {
        video.play(); // Optional: start playing if it was paused
    }
}

function updateTimeRemainingDisplay(video, displayElement) {
    const timeRemaining = video.currentTime;
    const hours = Math.floor(timeRemaining / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);
    const seconds = Math.floor(timeRemaining % 60);
    displayElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

setTimeout(() => {
    addVideoControlButtons();
}, 1000); // Adjust delay as necessary based on typical load times



// add explanation about the keys K and J

const h3Element = document.querySelector('#region-main-box form');
const sparkLogo = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M28.6118 15.6062C28.6118 15.6062 27.3476 17.4636 24.6978 19.0357C24.6978 19.0357 26.6169 2.81681 14.1129 0C17.3165 11.7576 10.0379 15.0734 7.38475 8.86162C2.95394 14.7773 6.31813 19.9384 6.31813 19.9384C4.50131 20.2002 2.97519 18.2153 2.97519 18.2153C2.96156 18.4598 2.95394 18.706 2.95394 18.9539C2.95388 26.1591 8.79481 32 16 32C23.2052 32 29.0461 26.1591 29.0461 18.9539C29.0461 17.7965 28.8946 16.6746 28.6118 15.6062Z" fill="#FF6536"/>
<path d="M2.97513 18.2153C2.97513 18.2153 4.50125 20.2002 6.31806 19.9384C6.31806 19.9384 2.95388 14.7773 7.38469 8.86162C10.0379 15.0734 17.3164 11.7576 14.1129 0C14.7826 0.150875 15.4106 0.340437 16 0.563625V32C8.79481 32 2.95388 26.1591 2.95388 18.9539C2.95388 18.7059 2.9615 18.4598 2.97513 18.2153Z" fill="#FF421D"/>
<path d="M21.7215 26.2785C21.7215 29.4384 19.1599 32 16 32C12.8401 32 10.2785 29.4384 10.2785 26.2785C10.2785 24.5872 11.0123 23.0673 12.179 22.0199C14.3911 25.0252 17.5435 20.4664 15.0868 17.1372C15.0868 17.1372 21.7215 17.9687 21.7215 26.2785Z" fill="#FF7E36"/>
<path d="M10.2785 26.2785C10.2785 24.5872 11.0123 23.0673 12.179 22.0199C14.3911 25.0252 17.5435 20.4664 15.0868 17.1372C15.0868 17.1372 15.4473 17.1825 16 17.357V32C12.8401 32 10.2785 29.4384 10.2785 26.2785Z" fill="#FF6E1D"/>
<g clip-path="url(#clip0_126_29)">
<path d="M18.7931 26.5H21.6333C19.7019 24.7274 18.4684 23.0543 20.5597 21.8548L18.7931 21.3339C17.9992 22.0744 16.512 22.9171 18.7931 26.5Z" fill="white"/>
<path d="M14.0134 26.5H11C12.6757 25.6658 14.3246 24.8045 13.1128 21.0299L15.2255 22.5928C15.0677 23.8954 15.0563 25.1976 14.0134 26.5Z" fill="white"/>
<path d="M17.8234 26.5C15.1862 20.7664 20.8077 20.9598 20.8904 17.9497C20.9406 16.1502 19.6222 14.7832 15.5029 12C16.8778 15.8795 7.56 17.1501 15.3644 22.2455C15.4812 21.6231 15.8789 21.001 16.2648 20.3786C14.1944 19.3467 14.2276 18.6448 14.249 18.0341C14.3114 16.2546 16.4097 15.5163 16.2301 13.4326C18.7278 15.6484 18.6921 16.466 18.7105 17.3328C18.7681 20.0232 15.1488 19.0717 15.3987 26.4997H17.8234V26.5Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_126_29">
<rect width="10.6333" height="14.5" fill="white" transform="translate(11 12)"/>
</clipPath>
</defs>
</svg>

`;
if (h3Element) {
    h3Element.insertAdjacentHTML('beforebegin', `
    
        <div class="bgu-spark-notification">
            <div class="warning-icon">
               ` + sparkLogo + `
            </div>
            <div class="warning-text">
            <div class="quick-open">
            <span> :הזזה של 10 שניות קדימה ואחורה באמצעות החצים</span>
                <div class="item-wrapper">
                <div class="item"><i class="fa fa-arrow-left" aria-hidden="true"></i></div>, <div class="item"><i class="fa fa-arrow-right" aria-hidden="true"></i></div>
                </div>
                <span> :הזזה של מהירות הסרטון באמצעות החצים</span>
                <div class="item-wrapper">
                <div class="item"><i class="fa fa-arrow-up" aria-hidden="true"></i></div>, <div class="item"><i class="fa fa-arrow-down" aria-hidden="true"></i></div>
                </div>
                <span>ולהפסקת/הפעלת הסרטון יש ללחוץ רווח</span>
                <div class="item-wrapper">
                <div class="item"><div class='custom-spacebar-icon'></div></div></div>
                </div>
        </div>
            </div>
        </div>
        `
    );
} else {

}



  

//// add download button to the video player

// Function to download the video
function downloadVideo() {
    const video = document.querySelector('video');
    if (!video) return;
    const source = video.querySelector('source');
    if (!source || !source.src) return;

    chrome.runtime.sendMessage({
        action: 'downloadVideo',
        url: source.src
    });
}

// Function to create and insert the HTML structure
function createDownloadWrapper() {
    const h3Element = document.querySelector('#region-main-box form');
    console.log(h3Element);
    if (h3Element) {
        const wrapper = document.createElement('div');
        wrapper.className = 'download-wrapper';
        wrapper.innerHTML = `
            <div class="warning-icon">
            ` + sparkLogo + `
            </div>
            <div class="download-item">
                <div class="item">להורדת הסרטון יש ללחוץ על הכפתור הבא</div>
                <div class="item"><button class="download-button">
                <i class="fa fa-download" aria-hidden="true"></i>
                הורד סרטון
                </button></div>
            </div>
        `;
        
        h3Element.insertAdjacentElement('beforebegin', wrapper);

        // Attach the event listener to the button
        const downloadButton = wrapper.querySelector('.download-button');
        downloadButton.addEventListener('click', downloadVideo);
    } else {
    }
}

// TODO: re-enable once CloudFront download is fixed
// createDownloadWrapper();






