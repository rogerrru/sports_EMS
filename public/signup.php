<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Signup | Events Website</title>
    <link rel="icon" href="assets/media/ScholoLogo.png" type="image/x-icon">
    <link rel="stylesheet" href="style.css">
</head>
<body class="signupBody">
<?php
include 'db.php';
$conn = OpenCon();

function sanitize($input)
{
    return htmlspecialchars(strip_tags($input));
}

function getOrganizations()
{
    global $conn;
    $result = $conn->query("SELECT * FROM `dynamite-database`.organizations");
    $organizations = [];
    while ($row = $result->fetch_assoc()) {
        $organizations[] = array(
            'orgName' => $row['orgName'],
            'orgID' => $row['orgID']
        );
    }
    return $organizations;
}

function getDepartments()
{
    global $conn;
    $result = $conn->query("SELECT * FROM `dynamite-database`.departments");
    $departments = [];
    while ($row = $result->fetch_assoc()) {
        $departments[] = array(
            'depName' => $row['depName'],
            'depID' => $row['depID']
        );
    }
    return $departments;
}

//Checks if the user is already registered using the email
function isEmailRegistered($email)
{
    global $conn;
    $stmt = $conn->prepare("SELECT COUNT(*) FROM users WHERE email = ?");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $stmt->bind_result($count);
    $stmt->fetch();
    $stmt->close();
    return $count > 0;
}

// Check if the form is submitted
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get user input and sanitize
    $firstName = sanitize($_POST['firstName']);
    $lastName = sanitize($_POST['lastName']);
    $depID = ($_POST['depName'] === '') ? null : sanitize($_POST['depName']);
    $orgID = ($_POST['orgName'] === '') ? null : sanitize($_POST['orgName']);
    $email = sanitize($_POST['email']);
    $password = sanitize($_POST['password']);

    // Check if the email already exists in the database
    if (isEmailRegistered($email)) {
        echo '<script>
                alert("This email is already registered! Please use a different email address.");
                window.location.href = "signup.php";
               </script>';
        exit();
    }


    // Use prepared statement to insert user data into the database
    $stmt = $conn->prepare("INSERT INTO users (depID, orgID, firstName, lastName, email, password, userType, registrationDate) 
                                VALUES (?,?,?, ?, ?, ?, 2, NOW())");
    $stmt->bind_param('ssssss', $depID, $orgID, $firstName, $lastName, $email, $password);


    // Execute the prepared statement
    if ($stmt->execute()) {
        echo '<script>
                alert("Registration successful! Please log in.");
                window.location.href = "html/login_form.html";
               </script>';
        exit();
    } else {
        echo '<script>
                alert("Error occurs while trying to create a profile! Try again!");
                window.location.href = "signup.php";
               </script>';
        exit();
        }

        // Close the statement
        $stmt->close();
}
include "html/signup_form.html";
?>
</body>
</html>


