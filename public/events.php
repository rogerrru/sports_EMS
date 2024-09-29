<?php
session_start();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Events | Events Website</title>
    <link rel="stylesheet" href="style.css">
    <link rel="icon" href="assets/media/ScholoLogo.png" type="image/x-icon">
    <script src="assets/script.js" defer></script>
</head>
<?php
include "html/navbar.html";
include "html/header.html";
require('db.php');
$conn = OpenCon();

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
//session_start();
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Function to sanitize user input
function sanitizeInput($input)
{
    return htmlspecialchars($input);
}

function fetchEventsByStatus($status, $conn)
{
    $status = sanitizeInput($status);
    $query = 'SELECT e.*, s.startDate, s.endDate, s.duration, v.venueName, v.venueAddress 
            FROM events e
            LEFT JOIN schedules s ON e.scheduleID = s.scheduleID
            LEFT JOIN venues v ON e.venueID = v.venueID
            WHERE e.eventStatus = ?';
    $stmt = $conn->prepare($query);
    $stmt->bind_param("s", $status);
    $stmt->execute();
    return $stmt->get_result();
}
// Retrieve user's department and organization information from the session or user data
$userDepID = isset($_SESSION['userDet']['depID']) ? $_SESSION['userDet']['depID'] : null;
$userOrgID = isset($_SESSION['userDet']['orgID']) ? $_SESSION['userDet']['orgID'] : null;


// Retrieve search query from the form
$searchQuery = isset($_GET['search']) ? sanitizeInput($_GET['search']) : '';
$sortByName = isset($_GET['sort_by_name']) ? sanitizeInput($_GET['sort_by_name']) : '';
$sortByStatus = isset($_GET['sort_by_status']) ? sanitizeInput($_GET['sort_by_status']) : 'default';

// Create a variable to hold the WHERE condition
$whereCondition = '';

// Create a variable to hold the ORDER BY condition
$orderBy = '';

if ($userDepID !== null && $userOrgID !== null) {
    // Ensure proper escaping and quoting
    $whereCondition .= " WHERE (depID = " . (int)$userDepID . " OR orgID = " . (int)$userOrgID . ") OR eventCategory = 'open'";
} elseif ($userOrgID !== null) {
    // Ensure proper escaping and quoting
    $whereCondition .= " WHERE orgID = " . (int)$userOrgID . " OR eventCategory = 'open'";
} elseif ($userDepID !== null) {
    // Ensure proper escaping and quoting
    $whereCondition .= " WHERE depID = " . (int)$userDepID . " OR eventCategory = 'open'";
} else {
    // If the user is not logged in, only show public events
    $whereCondition .= " WHERE eventCategory = 'open'";
}

// Check if a specific status is selected
if ($sortByStatus !== 'default') {
    // Use the fetchEventsByStatus function
    $result = fetchEventsByStatus($sortByStatus, $conn);
    if ($sortByName === 'asc') {
        $orderBy = ' ORDER BY eventName ASC';
    } elseif ($sortByName === 'desc') {
        $orderBy = ' ORDER BY eventName DESC';
    }
} else {
    if (!empty($searchQuery)) {
        $whereCondition .= " AND eventName LIKE '%" . $searchQuery . "%'";
    }

    // Construct the query
    $query = 'SELECT e.*, s.startDate, s.endDate, s.duration, v.venueName, v.venueAddress FROM events e
            LEFT JOIN schedules s ON e.scheduleID = s.scheduleID
            LEFT JOIN venues v ON e.venueID = v.venueID' . $whereCondition . $orderBy;

    // Prepare and execute the statement
    $stmt = $conn->prepare($query);
    if (!$stmt->execute()) {
        die("Error executing the query: " . $stmt->error);
    }

    // Get the result set
    $result = $stmt->get_result();

}

// Handle the result set (display or process as needed)
function displayEventItem($row, $conn)
{

    echo '
        <div class="eventItem">
       
            <div class="eventImg">
            <button class="Previous-btn">←</button>
                <img src="data:image/jpeg;base64,' . $row["event_img"] . '" alt="' . $row["eventName"] . '">
                <div class="gradient-overlay"></div>
            <button class="slide-btn">→</button>
            </div>
            <div class="eventDetails">
                <div class="eventName">
                    <h1>' . $row["eventName"] . '</h1>
                </div>';

    // Check if there is no venue or schedule information
    if (empty($row["startDate"]) || empty($row["endDate"]) || empty($row["venueName"]) || empty($row["venueAddress"])) {
        echo '<div class="eventSchedule"><p>No venue/schedule yet</p></div>';
    } else {
        // Display venue and schedule information
        echo '
                <div class="eventSchedule">
                    <p class = "date">'. $row["startDate"] . ' to ' . $row["endDate"] . ' ('. $row["duration"] . ')' . '</p>
                    <p class = "venue">'. $row["venueName"] . ' ('. $row["venueAddress"] . ')' . '</p>
                </div>';
    }

    $sessionsQuery = "SELECT * FROM sessions WHERE eventID = ?";
    $sessionsStmt = $conn->prepare($sessionsQuery);
    $sessionsStmt->bind_param("i", $row["eventID"]);
    $sessionsStmt->execute();
    $sessionsResult = $sessionsStmt->get_result();

    if ($sessionsResult->num_rows > 0) {
        echo '<div class="eventSession">
        <table>
                <tr>
                    <th>Duration</th>
                    <th>Date/s</th>
                    <th>Time</th>
                </tr>';

        while ($sessionRow = $sessionsResult->fetch_assoc()) {
            echo '<tr>
                    <td>' . $sessionRow["sessionDesc"] . '</td>
                    <td>' . $sessionRow["firstDay"] . ' to ' . $sessionRow["lastDay"] . '</td>
                    <td>' . $sessionRow["startTime"] . ' to ' . $sessionRow["endTime"] . '</td>
                </tr>';
        }

        echo '</table>';
        echo '</div>';
    } else {
        echo 'No sessions for this event yet.';
    }

    echo '
                <div class="eventDescription">
                    <span>
                        <span>' . $row["description"] . '</span>
                    </span>
                </div>
                <div class="eventStatus">
                    <span>' . $row["eventStatus"] . '</span>
                </div>
                <button class="eventRegister">';

    // Check if event status is 'done' and handle registration
    if ($row["eventStatus"] === 'done') {
        echo '<p>Registration closed for this event</p>';
    } else {
        // Check if the user is already registered for the event
        $checkSql = "SELECT qr_img FROM user_qr WHERE userID = ? AND eventID = ?";
        $checkStmt = $conn->prepare($checkSql);
        $checkStmt->bind_param("ii", $_SESSION['userID'], $row["eventID"]);
        $checkStmt->execute();
        $checkResult = $checkStmt->get_result();

        if ($checkResult->num_rows > 0) {
            // User is already registered, fetch and display QR code
            $qrData = $checkResult->fetch_assoc()['qr_img'];
            echo '<img src="'.$qrData.'">
                        <p>' . $row["eventName"] . '</p>
                        <p class = "date">'. $row["startDate"] . ' to ' . $row["endDate"] . ' ('. $row["duration"] . ')' . '</p>
                        <p class = "venue">'. $row["venueName"] . ' ('. $row["venueAddress"] . ')' . '</p>
                    </img>';
        } else {
            // User is not registered, show registration link
            echo '<a href="register_event.php?eventID=' . $row["eventID"] . '">Register</a>';
        }

        $checkStmt->close();
    }

    echo '
                </button>
            </div>
        </div>';
}

?>
<div class="events">
    <div class="center-container">
    <?php
    include "html/events_filter.html";
    ?>
    </div>
    <div class="eventsContainer" id = "eventsContainer" >
        <?php
            if ($result->num_rows > 0) {
                while ($row = $result->fetch_assoc()) {
                    displayEventItem($row, $conn);
                }

            } else {
                // Close statement and connection
                $stmt->close();
                CloseCon($conn);
                ?>
                <script>

                    // JavaScript code for the pop-up alert
                    window.onload = function() {
                        alert("No events found for the search: <?php echo $userDepID + $userOrgID; ?>");
                        window.history.back(); // Go back to the previous page
                    };
                </script>
                <?php
                // Exit PHP
                exit;
            }
            ?>
        <div class="indicators">
            <!-- Dynamic circles will be generated here -->
        </div>
    </div>
</div>

<!-- Fetch and display upcoming, ongoing, and done events -->
<?php
$upcomingEvents = fetchEventsByStatus('upcoming', $conn);
$ongoingEvents = fetchEventsByStatus('ongoing', $conn);
$doneEvents = fetchEventsByStatus('done', $conn);
include "html/footer.html";
//FUNCTION TO SHOW THE LATEST 3 EVENTS
include 'latest_events.php';
?>





