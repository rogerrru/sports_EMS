<?php
session_start();

require('db.php');
function getUserInfo($userID) {
    $conn = OpenCon();
    $stmt = $conn->prepare("SELECT * FROM USERS WHERE userID = ?");
    $stmt->bind_param('i', $userID);
    $stmt->execute();
    $stmt->bind_result($userID, $depID, $orgID, $firstName, $lastName, $password, $email, $userType, $registrationDate);
    $stmt->fetch();
    $stmt->close();
    CloseCon($conn);

    return [
        'userID' => $userID,
        'depID' => $depID,
        'orgID' => $orgID,
        'firstName' => $firstName,
        'lastName' => $lastName,
        'password' => $password,
        'email' => $email,
        'userType' => $userType,
        'registrationDate' => $registrationDate,
    ];
}

function getOrganizationInfo($orgID) {
    $conn = OpenCon();
    $stmt = $conn->prepare("SELECT orgName FROM ORGANIZATIONS WHERE orgID = ?");
    $stmt->bind_param('i', $orgID);
    $stmt->execute();
    $stmt->bind_result($orgName);
    $stmt->fetch();
    $stmt->close();
    CloseCon($conn);

    return $orgName;
}

function getDepartmentInfo($depID) {
    $conn = OpenCon();
    $stmt = $conn->prepare("SELECT depName, depDesc FROM DEPARTMENTS WHERE depID = ?");
    $stmt->bind_param('i', $depID);
    $stmt->execute();
    $stmt->bind_result($depName, $depDesc);
    $stmt->fetch();
    $stmt->close();
    CloseCon($conn);

    return [
        'depName' => $depName,
        'depDesc' => $depDesc,
    ];
}

// Check if the user is logged in
if (isset($_SESSION['user'])) {
    // Check if the user is accessing the accounts section
    $currentSection = basename($_SERVER['PHP_SELF']); // Get the current filename
    $allowedSections = ['account.php']; // Add more sections as needed
    if (in_array($currentSection, $allowedSections)) {
        // Get user information for the logged-in user
        $userID = $_SESSION['userID']; // userID is stored in the session ( from login.php)
        $userInfo = getUserInfo($userID);
        $departmentInfo = getDepartmentInfo($userInfo['depID']);
        $organizationInfo = getOrganizationInfo($userInfo['orgID']);

    } else {
        // Redirect to the account page
        header('Location: account.php');
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
include 'html/account.html';
?>
