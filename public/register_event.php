<?php
session_start();
require('db.php');
$conn = OpenCon();

// Check if event_id is set in the URL
if (isset($_GET['eventID'])) {
    if (isset($_SESSION['user'])) {
        $eventID = $_GET['eventID'];
        $userID = $_SESSION['userID'];

        // Check if the user is already registered for the event
        $checkSql = "SELECT * FROM event_reg WHERE userID = ? AND eventID = ?";
        $checkStmt = $conn->prepare($checkSql);
        $checkStmt->bind_param("ii", $userID, $eventID);
        $checkStmt->execute();
        $checkResult = $checkStmt->get_result();

        if ($checkResult->num_rows > 0) {
            //change to popup
            echo "You are already registered for this event.";
        } else {
            // Get the current date for registrationDate
            $registrationDate = date('Y-m-d H:i:s');

            // Insert into EVENT_REG table
            $insertSql = "INSERT INTO event_reg (userID, eventID, registrationDate) VALUES (?, ?, ?)";
            $insertStmt = $conn->prepare($insertSql);
            $insertStmt->bind_param("iis", $userID, $eventID, $registrationDate);

            if ($insertStmt->execute()) {
                echo "Registration successful!";
                $_SESSION['userID'] = $userID;
                $_SESSION['eventID'] = $eventID;
                $_SESSION['eventRegID'] = $insertStmt->insert_id;
                // QR GENERATION SANA HERE
                header('Location: qr_generation.php');
                exit();
            } else {
                echo "Error in registration: " . $insertStmt->error;
            }

            $insertStmt->close();
        }

        $checkStmt->close();
    } else {
?>
        <script>
        alert("Invalid request. USER not logged in.");
        window.location.href = "html/login_form.html";
        </script>
        <?php
    }
} else {
    //change to redirect to login page or popup
    echo "Invalid request. Event ID not provided.";
}

$conn->close();
?>
