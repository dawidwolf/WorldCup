// --- THE MASTER TIME-TRAVEL SWITCH ---
// Set 'isRealTime' to true when you want the app to use the actual date and time.
// Set 'isRealTime' to false when you want to simulate a specific moment in the tournament!
export const timeTravelConfig = {
  isRealTime: true, 
  mockTime: "2026-06-15T23:45:00Z" // The exact date/time you want to pretend it is
};

// This function replaces "new Date()" across your entire app
export function getAppTime(): Date {
  if (timeTravelConfig.isRealTime) {
    return new Date(); // Returns the actual real-world time right now
  } else {
    return new Date(timeTravelConfig.mockTime); // Returns your time-travel destination
  }
}