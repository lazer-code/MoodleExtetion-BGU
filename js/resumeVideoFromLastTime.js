const video = document.querySelector('video');
const videoId = window.location.href; // Use video URL as a unique identifier


if (video) {
    // Save the current time when the video is paused
    video.addEventListener('pause', function() {
        const videoId = window.location.href;
        // Get video title from the page
        const videoTitleElement = document.querySelector('#region-main h3');
        const videoTitle = videoTitleElement ? videoTitleElement.textContent.trim() : 'Unknown Video';
        
        // Get course name from the page
        const courseNameElement = document.querySelector('h1.h2');
        const courseName = courseNameElement ? courseNameElement.textContent.trim() : 'Unknown Course';

        
        chrome.runtime.sendMessage({
            type: 'videoTimes.upsert',
            data: {
                link: videoId,
                title: videoTitle,
                course_name: courseName,
                seconds: video.currentTime,
                duration: video.duration
            }
        }, (response) => {
            if (!response?.ok) console.error('[videoTimes] save failed:', response?.error);
        });
    });

    // Check if there's a saved time and add a resume button if so
    chrome.runtime.sendMessage({
        type: 'videoTimes.findByLink',
        link: videoId
    }, (response) => {
        if (!response?.ok || !response.row) return;
        const savedData = { seconds: response.row.seconds, duration: response.row.duration, title: response.row.title, course: response.row.course_name };
        if (savedData.seconds !== undefined) {
            const resumeButtonHtml = `
                <button class="sa-button" id="resumeButton" style="
                display: block;
                margin: 10px 0;
                padding: 10px;
                font-size: 14px;
                color: orange;
                background-color: white;
                border: none;
                cursor: pointer;
                border-radius: 5px;
                position: absolute;
                z-index: 1000;
                top: 70%;
                right: 50%;
                transform: translate(50%, -50%);
                ">
                    המשך מנקודת הצפייה האחרונה
                </button>
            `;
            video.insertAdjacentHTML('afterend', resumeButtonHtml);

            const resumeButton = document.getElementById('resumeButton');
            resumeButton.addEventListener('click', () => {
                video.currentTime = parseFloat(savedData.seconds);
                resumeButton.style.display = 'none';
                video.play();
            });
            const playButton = document.querySelector('.vjs-big-play-button');
            playButton.addEventListener('click', () => {
                resumeButton.style.display = 'none';
            });

            const screenButton = document.querySelector('video');
            screenButton.addEventListener('click', (e) => {
                resumeButton.style.display = 'none';
            });
            const poster = document.querySelector('.vjs-poster');
            poster.addEventListener('click', () => {
                resumeButton.style.display = 'none';
            });
        }
    });
} else {
}

// Resume video from last saved time
document.addEventListener('DOMContentLoaded', function() {
    const video = document.querySelector('video');
    if (video) {
        const videoId = window.location.href;
        chrome.runtime.sendMessage({
            type: 'videoTimes.findByLink',
            link: videoId
        }, (response) => {
            if (!response?.ok || !response.row) return;
            if (response.row.seconds !== undefined) {
                video.currentTime = response.row.seconds;
            }
        });
    }
});