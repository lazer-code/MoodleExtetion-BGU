function observeDOMChanges() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0) {
                const addedNodes = Array.from(mutation.addedNodes);
                addedNodes.forEach((node) => {
                    if (node.nodeName === 'VIDEO') {
                        attachListenersToVideos([node]);
                    }
                });
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}


function initializeVideoTracking() {

    const videoElements = document.querySelectorAll('video');
    if (videoElements.length === 0) {

    } else {

        attachListenersToVideos(videoElements);
    }
}

function attachListenersToVideos(videos) {
    videos.forEach((video) => {
        if (video.readyState >= 1) {  // If metadata is already loaded

            handleVideoCompletion(video);
        } else {
            video.addEventListener('loadedmetadata', () => {

                handleVideoCompletion(video);
            });
        }
    });
}

function handleVideoCompletion(video) {

    video.addEventListener('timeupdate', function() {
        const timeLeft = video.duration - video.currentTime;  // Time left in seconds


        if (timeLeft <= 600 && !video.dataset.aboutToEndTriggered) {  // 600 seconds is 10 minutes
            video.dataset.aboutToEndTriggered = true;


            const videoTitleElement = document.querySelector('#region-main h3');
            const videoTitle = videoTitleElement ? videoTitleElement.textContent.trim() : null;
            const currentPageLink = window.location.href; // Capture the current page URL

            if (videoTitle) {


                saveWatchedState(videoTitle, currentPageLink); // Adjusted to pass link along with title

                // Update the video title element to show the video is about to end and link it
                videoTitleElement.style.color = 'orange'; // Change title color to orange
            }
        }
    });
}

function saveWatchedState(videoTitle, videoLink) {
    chrome.runtime.sendMessage({
        type: 'videos.markWatched',
        data: { link: videoLink, title: videoTitle, course_name: null }
    }, (response) => {
        if (!response?.ok) console.error('[videos] markWatched failed:', response?.error);
        else console.log('[videos] watched:', videoTitle);
    });
}


observeDOMChanges();
initializeVideoTracking();