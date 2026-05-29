const blocks = document.querySelectorAll('.activity-item .activity-basis');
blocks.forEach(block => {
    const linkElement = block.querySelector('.activityname a');  // Get the link element from the block
    const itemTitleElement = block.querySelector('.activityname a .instancename');

    // Check if either linkElement or itemTitleElement is null and skip to the next block if so
    if (!linkElement || !itemTitleElement) {
        return;  // Continue to the next iteration
    }

    const link = linkElement.href;  // Get the href from the link element


    let instancenameText = '';  // Declare the variable

    // Select the .accesshide span within the .instancename element
    const accesshideElement = itemTitleElement.querySelector('.accesshide') ? itemTitleElement.querySelector('.accesshide') : '';

    // Get the text content of the .accesshide span
    const accesshideText = accesshideElement ? accesshideElement.textContent.trim() : '';

    // Clone the .instancename element to manipulate it without affecting the DOM
    const itemTitleClone = itemTitleElement.cloneNode(true);

    // Remove the .accesshide span from the cloned element
    const accesshideClone = itemTitleClone.querySelector('.accesshide');
    if (accesshideClone) {
        accesshideClone.remove();
    }

    // Get the text content of the modified cloned .instancename element
    instancenameText = itemTitleClone.textContent.trim();

    const courseName = document.querySelector('.page-header-headings').textContent.trim();

    // Create a div to hold the buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.classList.add('button-container');

    // Check if this is a Zoom Links activity
    if (instancenameText === 'Zoom Links') {
        // Extract course ID from current URL
        const courseId = window.location.href.split('id=')[1];
        const zoomButton = document.createElement('a');
        zoomButton.className = 'zoomlinks sa-button';
        zoomButton.innerHTML = '<i class="fa fa-youtube-play"></i> מדיית הקורס';
        zoomButton.style.marginLeft = '5px';
        zoomButton.href = `https://moodle.bgu.ac.il/moodle/blocks/video/videoslist.php?courseid=${courseId}`;
        zoomButton.target = '_blank';
        buttonContainer.appendChild(zoomButton);
    }

    // Create and append "Task It Up" button
    const taskItUpButton = createButton('הוסף למשימות', 'הסר מהמשימות', 'taskItUp', instancenameText, accesshideText, courseName, link);
    buttonContainer.appendChild(taskItUpButton);

    block.appendChild(buttonContainer);

    // Check the current state and update button text if necessary
    updateButtonState(taskItUpButton, 'taskItUp', instancenameText, courseName, link);
});




function createButton(buttonText, toggleText, type, itemTitle, itemType, courseName, link) {
    const button = document.createElement('button');
    button.setAttribute('data-toggle-text', toggleText); // Store the toggle text
    button.setAttribute('data-normal-text', buttonText); // Store the normal text
    button.classList.add(type, 'sa-button');

    // Add icon based on the type
    const icon = document.createElement('i');
    if (type === 'watchLater') {
        icon.className = 'fa fa-eye'; // FontAwesome class for watch later
    } else if (type === 'taskItUp') {
        icon.className = 'fa fa-book'; // FontAwesome class for tasks
    }
    button.appendChild(icon);

    // Add text node for the button text
    const textNode = document.createTextNode(' ' + buttonText);
    button.appendChild(textNode);

    // Event listener to toggle state
    button.addEventListener('click', function() {
        toggleItem(button, type, itemTitle, itemType, courseName, link, button.getAttribute('data-toggle-text'), button.getAttribute('data-normal-text'));
    });

    return button;
}

function toggleItem(button, type, title, itemType, course, link, toggledText, initialText) {
    const icon = button.querySelector('i'); // Reference to the icon inside the button
    const kind = type === 'watchLater' ? 'watch_later' : type === 'readingList' ? 'reading' : 'task';

    // Check current state by listing tasks, then add or remove accordingly
    chrome.runtime.sendMessage({ type: 'tasks.list', kind, includeDone: true }, (response) => {
        if (!response?.ok) {
            console.error('tasks.list failed', response?.error);
            return;
        }
        const match = response.rows.find(r => r.title === title && r.course_name === course);

        if (match) {
            // Item exists, remove it
            chrome.runtime.sendMessage({ type: 'tasks.remove', id: match.id }, (removeResponse) => {
                if (!removeResponse?.ok) console.error('tasks.remove failed', removeResponse?.error);
            });
            button.childNodes[1].nodeValue = ' ' + initialText; // Update text
            icon.className = type === 'watchLater' ? 'fa fa-eye' : 'fa fa-book'; // Set icon for initial state
            button.classList.remove('removefromlist'); // Remove the active class
        } else {
            // Item does not exist, add it
            chrome.runtime.sendMessage({
                type: 'tasks.add',
                kind,
                data: { title, course_name: course, link }
            }, (addResponse) => {
                if (!addResponse?.ok) console.error('tasks.add failed', addResponse?.error);
            });
            button.childNodes[1].nodeValue = ' ' + toggledText; // Update text
            icon.className = 'fa fa-times-circle'; // Set icon for toggled state
            button.classList.add('removefromlist'); // Add the active class
        }
    });
}


function updateButtonState(button, type, title, course, link) {
    const icon = button.querySelector('i'); // Access the icon element within the button
    const kind = type === 'watchLater' ? 'watch_later' : type === 'readingList' ? 'reading' : 'task';

    chrome.runtime.sendMessage({ type: 'tasks.list', kind, includeDone: false }, (response) => {
        if (!response?.ok) return;
        const items = response.rows;

        if (items.some(item => item.title === title && item.course_name === course)) {
            // Update the text and icon when the item is active
            button.childNodes[1].nodeValue = ' הסר ' + (type === 'watchLater' ? 'מצפייה מאוחרת' : 'מהמשימות');
            button.classList.add('removefromlist'); // Ensure button shows as active
            icon.className = 'fa fa-times-circle'; // Change the icon to 'times' for active state
        } else {
            // Restore original text and icon, and remove active class if not found
            button.childNodes[1].nodeValue = ' ' + button.getAttribute('data-normal-text');
            button.classList.remove('removefromlist');
            icon.className = type === 'watchLater' ? 'fa fa-eye' : 'fa fa-book'; // Reset to original icon
        }
    });
}




