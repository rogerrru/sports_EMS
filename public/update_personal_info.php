<?php
require ('db.php');
session_start();

function sanitize($input){
    return htmlspecialchars(strip_tags($input));
}

function updateUser($userID, $newFirstName, $newLastName, $newEmail) {
    $conn = OpenCon();
    // Sanitize inputs
    $userID = sanitize($userID);
    $newFirstName = sanitize($newFirstName);
    $newLastName = sanitize($newLastName);
    $newEmail = sanitize($newEmail);
    // Use prepared statement to update user data in the database
    $stmt = $conn->prepare("UPDATE users SET firstName=?, lastName=?, email=? WHERE userID=?");
    $stmt->bind_param('sssi', $newFirstName, $newLastName, $newEmail, $userID);
    if ($stmt->execute()) {
        echo '<script>
                alert("User data updated successfully.");
                window.location.href = "/public/account.php";
              </script>';
        exit();
    } else {
        echo '<script>
                alert("Error updating user data. Please try again later.");
                window.location.href = "/public/account.php";
              </script>';
        exit();
    }

    // Close the statement
    $stmt->close();
}
function forfeitEvent($eventRegID) {
    $conn = OpenCon();
    $stmt = $conn->prepare("DELETE FROM event_reg WHERE eventRegID = ?");
    $stmt->bind_param('i', $eventRegID);
    if ($stmt->execute()) {
        echo '<script>
                alert("Event forfeited successfully.");
                window.location.href = "/public/myEvents.php"; // Redirect to the dashboard or any other page
              </script>';
        exit();
    } else {
        echo '<script>
                alert("Error forfeiting from event. Please try again later.");
                window.location.href = "/public/myEvents.php"; // Redirect to the dashboard or any other page
              </script>';
        exit();
    }
    // Close the statement
    $stmt->close();
}

if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['forfeitEvent'])) {
    $eventRegID = $_POST['eventRegID'];
    forfeitEvent($eventRegID);
}

if (isset($_POST['firstname']) || $_POST['lastName'] || $_POST['email']){
    $userID = $_SESSION['userID'];
    $newFirstName = $_POST['firstName'];
    $newLastName = $_POST['lastName'];
    $newEmail = $_POST['email'];
    $Result = updateUser($userID, $newFirstName, $newLastName, $newEmail);
    header("Location: account.php");
    } else{
    header("Location: account.php");
    }
