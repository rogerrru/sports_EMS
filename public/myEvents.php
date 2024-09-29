<?php
session_start();
require('db.php');
function get_eventsRegistered($userID) {
    $conn = OpenCon();

    // Use a prepared statement to retrieve events registered by the user
    $stmt = $conn->prepare("SELECT event_reg.eventRegID, event_reg.eventID, event_reg.registrationDate, events.eventName, events.description, events.eventStatus, schedules.startDate, venues.venueName, venues.venueAddress
                            FROM event_reg
                            JOIN events ON event_reg.eventID = events.eventID
                            LEFT JOIN schedules ON events.scheduleID = schedules.scheduleID
                            LEFT JOIN venues ON events.venueID = venues.venueID
                            WHERE event_reg.userID = ?");
    $stmt->bind_param('i', $userID);
    $stmt->execute();

    // Bind the result variables
    $stmt->bind_result($eventRegID, $eventID, $registrationDate, $eventName, $description, $eventStatus, $startDate, $venueName, $venueAddress);

    // Fetch the result into an array
    $eventsRegistered = array();
    while ($stmt->fetch()) {
        $eventsRegistered[] = array(
            'eventRegID' => $eventRegID,
            'eventID' => $eventID,
            'registrationDate' => $registrationDate,
            'eventName' => $eventName,
            'description' => $description,
            'eventStatus' => $eventStatus,
            'startDate' => $startDate,
            'venueName' => $venueName,
            'venueAddress' => $venueAddress
        );
    }

    // Close the statement
    $stmt->close();

    // Close the connection
    CloseCon($conn);

    // Return the array of events registered by the user
    return $eventsRegistered;
}

function displayQR($eventID, $userID, $conn)
{
    // Check if the user is registered for the event
    $checkSql = "SELECT qr_img FROM user_qr WHERE userID = ? AND eventID = ?";
    $checkStmt = $conn->prepare($checkSql);
    $checkStmt->bind_param("ii", $userID, $eventID);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    $checkStmt->close();
    $qrData = $checkResult->fetch_assoc()['qr_img'];
    return $qrData;
}



// Check if the user is logged in
if (isset($_SESSION['user'])) {
    $conn = OpenCon();
    // Check if the user is accessing the accounts section
    $currentSection = basename($_SERVER['PHP_SELF']); // Get the current filename
    $allowedSections = ['myEvents.php']; // Add more sections as needed
    if (in_array($currentSection, $allowedSections)) {
        // Get user information for the logged-in user
        $userID = $_SESSION['userID']; // userID is stored in the session ( from login.php)
        $registeredEvents = get_eventsRegistered($userID);
    } else {
        // Redirect to the account page
        header('Location: myEvents.php');
        exit();
    }
} else {
    // If the user is not logged in, redirect to the login page
    header('Location: /public/html/login_form.html');
    exit();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="assets/media/ScholoLogo.png" type="image/x-icon">
    <title>SLU Events</title>
    <link rel="stylesheet" href="style.css">
</head>
<?php
include 'html/navbar.html';
include 'html/myEvents.html';
?>
