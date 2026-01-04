let tasksDone = [];
let progressBarNumSteps = 5;
let progressBarError = false;
let progressBarCurrentStep = 0;
let currentProgressMessage = '';

/**
 * Mark a task complete and update the progress bar. Prints to console with what task finished and how long it took to complete.
 * @param {*} task
 * @param {*} timeTaken
 */
function completeTask(task, timeTaken) {
    tasksDone.push(task);
    console.log("Task " + task + " completed in " + timeTaken + " milliseconds");

    // Allow the browser to repaint after the task completes
    setTimeout(updateProgressBar, 0);
}

/**
 * Set the progress bar message
 * @param {string} message - The message to display
 */
function setProgressMessage(message) {
    currentProgressMessage = message;
    const messageEl = document.getElementById("progressBarMessage");
    if (messageEl) {
        messageEl.textContent = message;
    }
}

/**
 * Return num of completed tasks
 * @returns number of completed tasks
 */
function getNumTasksDone() {
    return tasksDone.length;
}

/**
 * Updates the progress bar based on the number of tasks completed
 * Changes color based on status
 */
async function updateProgressBar() {

    let totalTasks = progressBarNumSteps;

    let progress = Math.round((getNumTasksDone() / totalTasks) * 100);

    document.getElementById("progressBarInner").style.width = progress + "%";

    if (progressBarError) {
        document.getElementById("progressBarInner").style.backgroundColor = "#FF0000";
    }
    else if (progress >= 100) {
        document.getElementById("progressBarInner").style.backgroundColor = "#04AA6D";
        console.log("All tasks completed, task number was " + getNumTasksDone());
        console.log("Progress bar length was set to " + progressBarNumSteps);
    }
    else {
        document.getElementById("progressBarInner").style.backgroundColor = "#4870AF";
    }

    // Add a small delay to allow the browser to repaint the UI
    await new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Set how many tasks are required for "complete" status of progress bar, so far it's 5 for simple route planner and 6 for complex. 
 * Complex has the extra step of drawing the route.
 * @param {*} num 
 */
function setProgressBarNumSteps(num) {
    progressBarNumSteps = num;
}

/**
 * Set the progress bar to error status
 */
function setProgressBarError() {
    progressBarError = true;
}

/**
 * Reset the progress bar to 0%
 */
function resetProgressBar() {
    tasksDone = [];
    progressBarError = false;
    setProgressMessage('');
    updateProgressBar();
}